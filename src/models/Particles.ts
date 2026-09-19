import * as THREE from 'three'
import { makeRng } from '../utils/rng'
import { mergeGeometries } from '../shaders/wind'
import { VOX } from '../utils/layout'

/**
 * ============================================================================
 *  空中元素
 * ============================================================================
 *
 * 提示词允许的"背景"只有云 —— 山、村庄、树林、其他建筑一律不做。
 * 云按体素风格做成一团团方块棉絮，缓慢横移，飘出画面后从另一侧绕回来。
 *
 * 另外加一层极淡的空中飞絮（麦田上被风吹起来的花粉/绒毛），
 * 让静止的画面有一点点呼吸感，但要压到几乎察觉不到的程度 ——
 * 提示词要求"安静治愈"，不是"特效大片"。
 */

export interface Particles {
  group: THREE.Group
  update: (dt: number) => void
  clouds: number
}

/** 一朵体素云：中间厚、边缘薄的一团方块 */
function makeCloudGeometry(rng: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const lobes = 5 + Math.floor(rng() * 4)

  for (let l = 0; l < lobes; l++) {
    const lx = (rng() - 0.5) * 10
    const lz = (rng() - 0.5) * 5
    const lr = 1.6 + rng() * 2.4
    const steps = Math.ceil(lr * 2)
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        for (let k = 0; k < steps; k++) {
          const x = (i / steps - 0.5) * lr * 2
          const y = (j / steps - 0.5) * lr * 1.5
          const z = (k / steps - 0.5) * lr * 2
          if (Math.hypot(x / lr, y / (lr * 0.9), z / lr) > 1) continue
          // 底面压平（云底是平的）
          if (y < -lr * 0.35) continue
          const s = 1 + rng() * 0.5
          const g = new THREE.BoxGeometry(s, s, s)
          g.translate(lx + x, y + lr * 0.5, lz + z)
          parts.push(g)
        }
      }
    }
  }
  return mergeGeometries(parts)
}

export function buildParticles(ctx: BuildCtxLike): Particles {
  const group = new THREE.Group()
  group.name = 'particles'
  const rng = makeRng(7788)

  /* ---------------- 云 ---------------- */
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    // 云要"自体发亮"，不然会被场景的光照压成灰块
    emissive: new THREE.Color(0xd6e6f0),
    emissiveIntensity: 0.3,
  })

  const cloudGeo = makeCloudGeometry(rng)
  const clouds: THREE.Mesh[] = []
  const cloudData: Array<{ speed: number; scale: number }> = []

  const CLOUD_N = 5
  for (let i = 0; i < CLOUD_N; i++) {
    const mesh = new THREE.Mesh(cloudGeo, cloudMat)
    const scale = 0.9 + rng() * 1.3
    mesh.scale.setScalar(scale)
    // 相机是近地平线的低视角，能看到的天空只有地平线以上 0~14° 那一条带。
    // 云如果按"真实高度"放（20~37 世界单位），全部跑到画框外面去了。
    // 正确做法是把它推到 65~105 世界单位之外，再按 4~11° 仰角反算高度：
    // 云看着小、位置也自然，又不会像近处的大方块那样把整片天糊白。
    mesh.position.set(
      (-240 + rng() * 480) * VOX,
      (48 + rng() * 40) * VOX,
      (-420 + rng() * 160) * VOX,
    )
    mesh.rotation.y = rng() * Math.PI * 2
    mesh.castShadow = false
    mesh.receiveShadow = false
    group.add(mesh)
    clouds.push(mesh)
    cloudData.push({ speed: 0.55 + rng() * 0.75, scale })
  }

  /* ---------------- 空中飞絮 ---------------- */
  const MOTE_N = 420
  const moteGeo = new THREE.BufferGeometry()
  const motePos = new Float32Array(MOTE_N * 3)
  const moteSeed = new Float32Array(MOTE_N)
  for (let i = 0; i < MOTE_N; i++) {
    motePos[i * 3] = (-70 + rng() * 140) * VOX
    motePos[i * 3 + 1] = (2 + rng() * 46) * VOX
    motePos[i * 3 + 2] = (-50 + rng() * 100) * VOX
    moteSeed[i] = rng() * Math.PI * 2
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3))

  const moteMat = new THREE.PointsMaterial({
    map: makeMoteTexture(),
    color: 0xfff6dd,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const motes = new THREE.Points(moteGeo, moteMat)
  motes.frustumCulled = false
  group.add(motes)

  const basePos = motePos.slice()

  /* ---------------- 更新 ---------------- */
  let t = 0
  const update = (dt: number) => {
    t += dt

    // 云：整体缓慢横移，出界后从左绕回
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]
      c.position.x += cloudData[i].speed * dt * VOX
      if (c.position.x > 240 * VOX) c.position.x -= 480 * VOX
    }

    // 飞絮：整体随风漂，同时逐个轻微上下浮沉
    const p = moteGeo.getAttribute('position') as THREE.BufferAttribute
    const arr = p.array as Float32Array
    const dx = Math.sin(t * 0.25) * 0.06
    for (let i = 0; i < MOTE_N; i++) {
      const o = i * 3
      let x = arr[o] + dx * dt
      if (x > 72 * VOX) x -= 144 * VOX
      arr[o] = x
      arr[o + 1] = basePos[o + 1] + Math.sin(t * 0.7 + moteSeed[i]) * 0.035
      arr[o + 2] = basePos[o + 2] + Math.cos(t * 0.5 + moteSeed[i] * 1.3) * 0.03
    }
    p.needsUpdate = true
  }

  return { group, update, clouds: CLOUD_N }
}

/** 飞絮用的圆形柔边贴图 */
function makeMoteTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Particles 只需要随机源，用一个最小接口约束，避免和 VoxelBatch 强耦合 */
interface BuildCtxLike {
  b: { rnd: () => number }
}
