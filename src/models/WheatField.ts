import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { applyWindShader, makeGrassTuftGeometry, makeWheatGeometry } from '../shaders/wind'
import { BASE } from '../utils/layout'
import { mixHex, shade, shiftHsl } from '../utils/rng'
import type { BuildCtx } from './voxel'

/**
 * ============================================================================
 *  麦田系统
 * ============================================================================
 *
 * 提示词的硬要求：
 *   · 整个矩形底座覆盖麦田，不是草坪
 *   · 每株麦子由「麦秆 + 麦穗」两段组成，禁止用一张贴图糊过去
 *   · 高度不同、密度不同、自然排列
 *   · InstancedMesh，60FPS
 *
 * 实现：
 *   在底座上按抖动网格撒点 → 查占地表剔除建筑/平台/路面 → 每点生成
 *   一株麦子。麦秆和麦穗各是一个 InstancedMesh，但**共用同一批实例矩阵**，
 *   所以位置、朝向、风摆相位完全同步，看上去就是一株植物。
 *
 *   颜色不做成统一的黄：按世界坐标在"青麦 → 干麦"之间插值，
 *   再叠一层低频噪声 —— 于是田里自然出现一片片偏青、一片片偏金的色块，
 *   跟参考图里左右两侧色调不同的感觉一致。
 */

/**
 * 株距（网格单位）。1 grid = 0.25 世界单位。
 *
 * 这个值是反复调出来的：麦田稀了就不成"田"，只剩一根根孤立的草；
 * 密到 0.5 左右时，相邻麦秆在屏幕上互相重叠，才连成参考图里那片金黄的"面"。
 * 代价是实例数翻倍，但麦子是 InstancedMesh + 顶点风摆，GPU 完全吃得下。
 */
const SPACING = 0.5
/** 麦秆基准高度（世界单位） */
const STALK_H = 0.98
/** 麦穗长度（世界单位） */
const EAR_L = 0.24

export interface WheatFieldResult {
  group: THREE.Group
  plants: number
  tufts: number
  flowers: number
}

export function buildWheatField(ctx: BuildCtx): WheatFieldResult {
  const { occ } = ctx
  const group = new THREE.Group()
  group.name = 'wheat-field'

  /* ---------------- 1. 撒点 ---------------- */
  const plants: Array<{ x: number; z: number; s: number; ry: number; tilt: number }> = []
  const { x0, x1, z0, z1 } = BASE

  for (let gx = x0 + 1; gx < x1 - 1; gx += SPACING) {
    for (let gz = z0 + 1; gz < z1 - 1; gz += SPACING) {
      // 抖动网格：每一株都偏离格点，避免出现"排队"的机械感
      const jx = gx + (ctx.b.rnd() - 0.5) * SPACING * 1.05
      const jz = gz + (ctx.b.rnd() - 0.5) * SPACING * 1.05

      if (occ.test(jx, jz)) continue

      // 密度调制：低频波浪，让田里有的地方密、有的地方稀。
      // 下限压在 0.88 —— 再低就会出现一块块"秃斑"，那不像麦田，像没种活
      const dens =
        0.88 +
        0.12 *
          (Math.sin(jx * 0.052) * Math.cos(jz * 0.041) * 0.5 + 0.5)
      if (ctx.b.rnd() > dens) continue

      // 高度差异：大部分中等，少数特别高/矮
      const r = ctx.b.rnd()
      const s =
        r < 0.12
          ? 0.62 + ctx.b.rnd() * 0.16 // 矮小的一撮
          : r > 0.88
            ? 1.28 + ctx.b.rnd() * 0.24 // 冒尖的几株
            : 0.88 + ctx.b.rnd() * 0.34

      plants.push({
        x: jx * 0.25,
        z: jz * 0.25,
        s,
        ry: ctx.b.rnd() * Math.PI * 2,
        tilt: (ctx.b.rnd() - 0.5) * 0.16,
      })
    }
  }

  /* ---------------- 2. 麦秆 + 麦穗 ---------------- */
  const { stalk: stalkGeo, ear: earGeo } = makeWheatGeometry(STALK_H, EAR_L, 0.03)

  // 麦穗顶端烤一层更亮的顶点色 —— 阳光打透穗尖的那种通透感
  bakeVerticalTint(earGeo, STALK_H, 0.84, 1.16)

  const stalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
  })
  const earMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0,
    vertexColors: true,
    // 极弱的自发光模拟麦穗透光，让穗部在背光面也不死黑
    emissive: new THREE.Color(0x4a3410),
    emissiveIntensity: 0.32,
  })

  const total = plants.length
  const stalkMesh = new THREE.InstancedMesh(stalkGeo, stalkMat, total)
  const earMesh = new THREE.InstancedMesh(earGeo, earMat, total)

  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()

  for (let i = 0; i < total; i++) {
    const p = plants[i]
    dummy.position.set(p.x, 0, p.z)
    dummy.rotation.set(p.tilt, p.ry, p.tilt * 0.7)
    dummy.scale.set(p.s * (0.88 + ctx.b.rnd() * 0.26), p.s, p.s)
    dummy.updateMatrix()
    stalkMesh.setMatrixAt(i, dummy.matrix)
    earMesh.setMatrixAt(i, dummy.matrix)

    // 青麦 ↔ 干麦 的插值：用两个低频波当成"地块感"的噪声。
    // 整体往金黄偏（参考图里麦田是金黄的，青只出现在边缘和背阴处）
    const n =
      Math.sin(p.x * 0.19 + p.z * 0.07) * 0.5 +
      Math.cos(p.z * 0.16 - p.x * 0.06) * 0.5
    const dryness = Math.min(1, Math.max(0, n * 0.5 + 0.62))

    let stalkC = mixHex(PAL.wheatStalkGreen, PAL.wheatStalkDry, dryness)
    stalkC = shade(stalkC, 1 + (ctx.b.rnd() * 2 - 1) * 0.1)
    tmpColor.setHex(stalkC)
    stalkMesh.setColorAt(i, tmpColor)

    let earC = mixHex(PAL.wheatEarDark, PAL.wheatEarLit, dryness * 0.8 + p.s * 0.12)
    earC = shade(earC, 1 + (ctx.b.rnd() * 2 - 1) * 0.09)
    tmpColor.setHex(earC)
    earMesh.setColorAt(i, tmpColor)
  }

  // 风摆：两段共用同一套 uniform，相位由实例世界坐标决定 —— 摆动天然同步
  const totalHeight = STALK_H + EAR_L
  applyWindShader(stalkMat, totalHeight, 0.13)
  applyWindShader(earMat, totalHeight, 0.13)

  for (const m of [stalkMesh, earMesh]) {
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    // 麦田不投影：上万实例进阴影 pass 性价比很低，阴影交给建筑与家具
    m.castShadow = false
    m.receiveShadow = true
    m.frustumCulled = false
    group.add(m)
  }

  /* ---------------- 3. 田埂杂草 ---------------- */
  const tufts = buildTufts(ctx, occ)
  group.add(tufts.group)

  /* ---------------- 4. 白色野花 ---------------- */
  const flowers = buildFlowers(ctx, occ)
  group.add(flowers.group)

  return {
    group,
    plants: total,
    tufts: tufts.count,
    flowers: flowers.count,
  }
}

/* ---------------------------------------------------------------------- */

/** 田埂与平台边缘的杂草丛：贴着建筑、木平台、栅栏长一圈 */
function buildTufts(
  ctx: BuildCtx,
  occ: { test: (x: number, z: number) => boolean },
): { group: THREE.Group; count: number } {
  const group = new THREE.Group()
  group.name = 'grass-tufts'
  const geo = makeGrassTuftGeometry(() => ctx.b.rnd())
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  applyWindShader(mat, 0.26, 0.05)

  const spots: Array<{ x: number; z: number; s: number }> = []
  const { x0, x1, z0, z1 } = BASE

  // 离建筑/平台 3~14 grid 的"边缘带"上撒草
  for (let i = 0; i < 6000; i++) {
    const x = x0 + ctx.b.rnd() * (x1 - x0)
    const z = z0 + ctx.b.rnd() * (z1 - z0)
    // 用两个半径不同的采样环，草长在结构边缘附近
    const nearEdge = occ.test(x + 3, z) !== occ.test(x - 3, z) ||
                     occ.test(x, z + 3) !== occ.test(x, z - 3)
    if (!nearEdge && ctx.b.rnd() > 0.25) continue
    if (occ.test(x, z)) continue
    spots.push({ x, z, s: 0.7 + ctx.b.rnd() * 0.8 })
  }

  const mesh = new THREE.InstancedMesh(geo, mat, spots.length)
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  spots.forEach((p, i) => {
    dummy.position.set(p.x * 0.25, 0.02, p.z * 0.25)
    dummy.rotation.set(0, ctx.b.rnd() * Math.PI * 2, 0)
    dummy.scale.setScalar(p.s)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    const c = shade(
      mixHex(PAL.plantDark, PAL.wheatStalkGreen, ctx.b.rnd()),
      1 + (ctx.b.rnd() * 2 - 1) * 0.12,
    )
    col.setHex(c)
    mesh.setColorAt(i, col)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  group.add(mesh)
  return { group, count: spots.length }
}

/** 白色小野花：田间星星点点的白点，参考图里很显眼的一层细节 */
function buildFlowers(
  ctx: BuildCtx,
  occ: { test: (x: number, z: number) => boolean },
): { group: THREE.Group; count: number } {
  const group = new THREE.Group()
  group.name = 'wild-flowers'

  // 花 = 细茎 + 一个白色小方块（体素花），合并成一个几何体
  const stem = new THREE.BoxGeometry(0.012, 0.24, 0.012)
  stem.translate(0, 0.12, 0)
  const head = new THREE.BoxGeometry(0.05, 0.035, 0.05)
  head.translate(0, 0.26, 0)

  const parts: THREE.BufferGeometry[] = []
  const stemColored = tintGeometry(stem, new THREE.Color(PAL.plantDark))
  const headColored = tintGeometry(head, new THREE.Color(PAL.flowerWhite))
  parts.push(stemColored, headColored)

  const geo = mergeParts(parts)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    vertexColors: true,
    emissive: new THREE.Color(0x2a2a20),
    emissiveIntensity: 0.25,
  })
  applyWindShader(mat, 0.26, 0.04)

  const spots: Array<{ x: number; z: number; s: number }> = []
  const { x0, x1, z0, z1 } = BASE
  for (let i = 0; i < 900; i++) {
    const x = x0 + ctx.b.rnd() * (x1 - x0)
    const z = z0 + ctx.b.rnd() * (z1 - z0)
    if (occ.test(x, z)) continue
    // 成簇生长：50% 的花会带 2~4 个邻居
    spots.push({ x, z, s: 0.7 + ctx.b.rnd() * 1.5 })
    if (ctx.b.rnd() < 0.5) {
      const n = 2 + Math.floor(ctx.b.rnd() * 3)
      for (let k = 0; k < n; k++) {
        const nx = x + (ctx.b.rnd() - 0.5) * 5
        const nz = z + (ctx.b.rnd() - 0.5) * 5
        if (!occ.test(nx, nz)) spots.push({ x: nx, z: nz, s: 0.6 + ctx.b.rnd() * 1.2 })
      }
    }
  }

  const mesh = new THREE.InstancedMesh(geo, mat, spots.length)
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  spots.forEach((p, i) => {
    dummy.position.set(p.x * 0.25, 0.02, p.z * 0.25)
    dummy.rotation.set(
      (ctx.b.rnd() - 0.5) * 0.3,
      ctx.b.rnd() * Math.PI * 2,
      (ctx.b.rnd() - 0.5) * 0.3,
    )
    dummy.scale.setScalar(p.s)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    // 大部分纯白，少数偏米黄
    const c = ctx.b.rnd() < 0.78 ? PAL.flowerWhite : 0xeee1b8
    col.setHex(shade(c, 1 + (ctx.b.rnd() * 2 - 1) * 0.06))
    mesh.setColorAt(i, col)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  group.add(mesh)
  return { group, count: spots.length }
}

/* ---------------------------------------------------------------------- */

/** 给几何体逐顶点写入一个固定色（用于把两段不同颜色的部件合并后仍各自着色） */
function tintGeometry(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r
    arr[i * 3 + 1] = color.g
    arr[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

/** 按 y 高度烤一条明暗渐变进顶点色（穗尖更亮） */
function bakeVerticalTint(
  geo: THREE.BufferGeometry,
  fromY: number,
  bottom: number,
  top: number,
): void {
  const pos = geo.getAttribute('position')
  const arr = new Float32Array(pos.count * 3)
  let maxY = 0
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i))
  for (let i = 0; i < pos.count; i++) {
    const t = maxY > fromY ? (pos.getY(i) - fromY) / (maxY - fromY) : 0
    const v = Math.max(0.1, Math.min(1.6, bottom + (top - bottom) * t))
    arr[i * 3] = v
    arr[i * 3 + 1] = v * 0.99
    arr[i * 3 + 2] = v * 0.92
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
}

/** 局部合并（和 shaders/wind 里的 mergeGeometries 同源，避免循环依赖这里再写一份轻量版） */
function mergeParts(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vCount = 0
  let iCount = 0
  for (const g of list) {
    const pos = g.getAttribute('position')
    vCount += pos.count
    iCount += g.index ? g.index.count : pos.count
    if (!g.getAttribute('color')) tintGeometry(g, new THREE.Color(0xffffff))
  }
  const position = new Float32Array(vCount * 3)
  const normal = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const color = new Float32Array(vCount * 3)
  const index = new Uint16Array(iCount)
  let vOff = 0
  let iOff = 0
  for (const g of list) {
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    const txc = g.getAttribute('uv')
    const col = g.getAttribute('color')
    position.set(pos.array as Float32Array, vOff * 3)
    if (nor) normal.set(nor.array as Float32Array, vOff * 3)
    if (txc) uv.set(txc.array as Float32Array, vOff * 2)
    if (col) color.set(col.array as Float32Array, vOff * 3)
    const idx = g.index
    if (idx) {
      for (let i = 0; i < idx.count; i++) index[iOff + i] = idx.getX(i) + vOff
      iOff += idx.count
    } else {
      for (let i = 0; i < pos.count; i++) index[iOff + i] = i + vOff
      iOff += pos.count
    }
    vOff += pos.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(position, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setAttribute('color', new THREE.BufferAttribute(color, 3))
  out.setIndex(new THREE.BufferAttribute(index, 1))
  out.computeBoundingSphere()
  return out
}

/** 供 HUD 展示的麦田色板快照 */
export const WHEAT_TINT = {
  green: shiftHsl(PAL.wheatStalkGreen, 0, 0, 0),
  dry: PAL.wheatStalkDry,
}
