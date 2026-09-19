/**
 * CafeBuilding —— 建筑主体拆解复刻：
 * Wall / Roof / Window / Door / WindowFrame / WoodenBeam / Curtain / Sign(Banner)
 *
 * 白砖墙贴 white_brick，厚麦草顶 = 斜置厚板(straw 贴图) + 檐口随机散草 + 屋脊草卷。
 * 体量比例沿用参考图实测：屋檐跨 53 : 屋脊高 21.2 ≈ 2.5 : 1。
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import { makeClothWave } from '../three/AnimationManager'
import type { AnimationManager } from '../three/AnimationManager'
import { makeCrossGeometry, makePlantTexture } from './WheatField'
import { CAFE, OPENINGS, VOX } from './layout'

const W = (g: number): number => g * VOX

function box(w: number, h: number, d: number, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.castShadow = true
  m.receiveShadow = true
  m.name = name
  return m
}

export function buildCafeBuilding(
  mats: MaterialLibrary,
  anim: AnimationManager,
): { group: THREE.Group; interiorAnchor: THREE.Vector3 } {
  const g = new THREE.Group()
  g.name = 'cafe_building'

  const x0 = W(CAFE.x0), x1 = W(CAFE.x1)
  const zF = W(CAFE.z1)          // 前墙面 2.5
  const zB = W(CAFE.z0)          // 后墙面 -3.0
  const wallT = W(CAFE.wallT)    // 0.5
  const wallH = W(CAFE.wallH)    // 3.575

  /* ---------------- 墙体（含洞口分段；砖纹按段尺寸设 repeat，避免拉伸） ---------------- */
  const brickBase = mats.whiteBrick
  const wallSeg = (xa: number, xb: number, ya: number, yb: number, zc: number, name: string) => {
    if (xb - xa < 0.01 || yb - ya < 0.01) return
    const mat = brickBase.clone()
    const t = brickBase.map!.clone()
    t.repeat.set(Math.max(1, (xb - xa) / 1.6), Math.max(1, (yb - ya) / 1.6))
    mat.map = t
    mat.bumpMap = t
    const m = box(xb - xa, yb - ya, wallT, mat, name)
    m.position.set((xa + xb) / 2, (ya + yb) / 2, zc)
    g.add(m)
  }

  const win = OPENINGS.window
  const door = OPENINGS.door
  // 南墙（正面）：大窗 + 门
  wallSeg(x0, W(win.a0), 0, wallH, zF - wallT / 2, 'wall_s_left')
  wallSeg(W(win.a0), W(win.a1), 0, W(win.y0), zF - wallT / 2, 'wall_s_under_win')
  wallSeg(W(win.a0), W(win.a1), W(win.y1), wallH, zF - wallT / 2, 'wall_s_over_win')
  wallSeg(W(win.a1), W(door.a0), 0, wallH, zF - wallT / 2, 'wall_s_mid')
  wallSeg(W(door.a0), W(door.a1), W(door.y1), wallH, zF - wallT / 2, 'wall_s_over_door')
  wallSeg(W(door.a1), x1, 0, wallH, zF - wallT / 2, 'wall_s_right')
  // 北墙（背面）
  wallSeg(x0, x1, 0, wallH, zB + wallT / 2, 'wall_north')
  // 西墙（含侧窗）—— 同样按尺寸设砖纹 repeat
  const sw = OPENINGS.sideWindow
  const zcW = x0 + wallT / 2
  const sideSeg = (za: number, zb: number, ya: number, yb: number, name: string) => {
    if (zb - za < 0.01 || yb - ya < 0.01) return
    const mat = brickBase.clone()
    const t = brickBase.map!.clone()
    t.repeat.set(Math.max(1, (zb - za) / 1.6), Math.max(1, (yb - ya) / 1.6))
    mat.map = t
    mat.bumpMap = t
    const m = box(wallT, yb - ya, zb - za, mat, name)
    m.position.set(zcW, (ya + yb) / 2, (za + zb) / 2)
    g.add(m)
  }
  sideSeg(zB, W(sw.a0), 0, wallH, 'wall_w_back')
  sideSeg(W(sw.a0), W(sw.a1), 0, W(sw.y0), 'wall_w_under_win')
  sideSeg(W(sw.a0), W(sw.a1), W(sw.y1), wallH, 'wall_w_over_win')
  sideSeg(W(sw.a1), W(CAFE.z1), 0, wallH, 'wall_w_front')
  // 东墙（实墙 + 山墙）
  const east = box(wallT, wallH, W(CAFE.z1 - CAFE.z0), mats.whiteBrick, 'wall_east')
  east.position.set(x1 - wallT / 2, wallH / 2, (zB + zF) / 2)
  g.add(east)

  /* ---------------- 山墙三角 ---------------- */
  const gableZ0 = zB, gableZ1 = zF
  const ridgeZw = W(CAFE.ridgeZ)
  const gableTop = W(CAFE.ridgeTopY) - W(2.2) // 屋面下皮附近的三角形顶点
  const gableShape = new THREE.Shape([
    new THREE.Vector2(gableZ0, wallH),
    new THREE.Vector2(gableZ1, wallH),
    new THREE.Vector2(ridgeZw, gableTop),
  ])
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: wallT, bevelEnabled: false })
  for (const side of [-1, 1]) {
    const gm = new THREE.Mesh(gableGeo, mats.whiteBrick)
    gm.name = side < 0 ? 'gable_west' : 'gable_east'
    // rotation.y = -PI/2：Shape 的 x（世界 z）保持同向，挤出沿 -x；
    // 西墙占据 [x0, x0+wallT]，东墙占据 [x1-wallT, x1]
    gm.rotation.y = -Math.PI / 2
    gm.position.set(side < 0 ? x0 + wallT : x1, 0, 0)
    gm.castShadow = true
    gm.receiveShadow = true
    g.add(gm)
  }

  /* ---------------- 厚麦草屋顶 ---------------- */
  const roofGroup = new THREE.Group()
  roofGroup.name = 'roof'
  const slopeDz = W(15)
  const slopeDy = W(CAFE.ridgeTopY - CAFE.eaveTopY)
  const slopeLen = Math.hypot(slopeDz, slopeDy) + W(2.5)
  const alpha = Math.atan2(slopeDy, slopeDz)
  const roofW = W(CAFE.roofX1 - CAFE.roofX0)
  const thick = W(CAFE.roofThick)

  const slabFront = box(roofW, thick, slopeLen, mats.straw, 'roof_slab_front')
  slabFront.position.set(0, W((CAFE.ridgeTopY + CAFE.eaveTopY) / 2), W((CAFE.ridgeZ + CAFE.roofZ1) / 2))
  slabFront.rotation.x = alpha
  const slabBack = slabFront.clone()
  slabBack.name = 'roof_slab_back'
  slabBack.position.z = W((CAFE.ridgeZ + CAFE.roofZ0) / 2)
  slabBack.rotation.x = -alpha
  roofGroup.add(slabFront, slabBack)

  // 屋脊草卷（两根错叠圆木）
  for (const [r, dz] of [[0.5, 0], [0.38, 0.35]] as const) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, roofW + 0.3, 10), mats.strawEdge)
    cap.name = 'roof_ridge'
    cap.rotation.z = Math.PI / 2
    cap.position.set(0, W(CAFE.ridgeTopY) - 0.05 + dz * 0.2, ridgeZw + dz)
    cap.castShadow = true
    roofGroup.add(cap)
  }

  // 檐口散草盒已移除（块状感太重）：两坡麦穗铺层 + 侧缘裙边负责收边

  // ---- 屋面麦穗铺层：两坡满铺交叉面片（麦穗 alpha 贴图），厚草屋质感 ----
  {
    const rngT = (() => {
      let a = 20260919 >>> 0
      return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    })()
    const tGeo = makeCrossGeometry()
    const tTex = makePlantTexture('mature', 42)
    const tMat = new THREE.MeshStandardMaterial({
      map: tTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0,
      color: 0xf3dda2, // 整体压成干草金，和 straw 顶协调
    })
    const kSlope = slopeDy / W(CAFE.roofZ1 - CAFE.ridgeZ)
    const yOff = thick / 2 / Math.cos(alpha) + 0.03
    const stepX = 0.16
    const stepZ = 0.17
    // 先数一遍确定容量
    let cap = 0
    const zsFront: number[] = []
    for (let z = ridgeZw - 0.25; z < W(CAFE.roofZ1) + 0.45; z += stepZ) zsFront.push(z)
    for (let z = ridgeZw; z > W(CAFE.roofZ0) - 0.45; z -= stepZ) zsFront.push(z)
    cap = zsFront.length * Math.ceil(roofW / stepX) + 64
    const thatch = new THREE.InstancedMesh(tGeo, tMat, cap)
    thatch.name = 'roof_thatch'
    thatch.castShadow = true
    const tm = new THREE.Matrix4()
    const tq = new THREE.Quaternion()
    const te = new THREE.Euler()
    const tup = new THREE.Vector3(0, 1, 0)
    const tint = new THREE.Color()
    let ti = 0
    const putSprig = (x: number, z: number, tiltX: number, tiltZ = 0, hBase = 0.3, hVar = 0.2) => {
      if (ti >= cap) return
      const yTop = W(CAFE.ridgeTopY) - Math.abs(z - ridgeZw) * kSlope + yOff
      const h = hBase + rngT() * hVar
      te.set(tiltX + (rngT() - 0.5) * 0.24, rngT() * Math.PI * 2, tiltZ + (rngT() - 0.5) * 0.3)
      tq.setFromEuler(te)
      tm.compose(new THREE.Vector3(x, yTop - 0.06, z), tq, new THREE.Vector3(h * 0.9, h, h * 0.9))
      thatch.setMatrixAt(ti, tm)
      const l = 0.88 + rngT() * 0.24
      tint.setRGB(l, l * (0.97 + rngT() * 0.05), l * 0.9)
      thatch.setColorAt(ti, tint)
      ti++
    }
    // 前坡（檐口方向 z+）
    for (const z of zsFront) {
      if (z <= ridgeZw) continue
      if (rngT() < 0.06) continue
      for (let x = -roofW / 2 + 0.1; x < roofW / 2 - 0.05; x += stepX) {
        if (rngT() < 0.05) continue
        putSprig(x + (rngT() - 0.5) * 0.08, z + (rngT() - 0.5) * 0.08, -alpha * 0.55)
      }
    }
    // 后坡
    for (let z = ridgeZw; z > W(CAFE.roofZ0) - 0.45; z -= stepZ) {
      if (rngT() < 0.06) continue
      for (let x = -roofW / 2 + 0.1; x < roofW / 2 - 0.05; x += stepX) {
        if (rngT() < 0.05) continue
        putSprig(x + (rngT() - 0.5) * 0.08, z + (rngT() - 0.5) * 0.08, alpha * 0.55)
      }
    }
    // 两坡侧缘麦穗裙边：盖住屋面板端面（原"白色板"穿帮处）
    for (const sx of [-1, 1]) {
      for (const dir of [1, -1]) {
        const tiltX = dir > 0 ? -alpha * 0.55 : alpha * 0.55
        for (let z = ridgeZw; dir > 0 ? z < W(CAFE.roofZ1) + 0.35 : z > W(CAFE.roofZ0) - 0.35; z += dir * stepZ * 1.2) {
          if (rngT() < 0.08) continue
          putSprig(
            sx * (roofW / 2 + 0.05 + rngT() * 0.06), z + (rngT() - 0.5) * 0.1,
            tiltX, sx * (0.55 + rngT() * 0.3), 0.4, 0.3,
          )
        }
      }
    }
    thatch.count = ti
    thatch.instanceMatrix.needsUpdate = true
    if (thatch.instanceColor) thatch.instanceColor.needsUpdate = true
    roofGroup.add(thatch)
  }
  g.add(roofGroup)

  /* ---------------- 大窗（木框 + 深 interior + 窗台 + 窗帘） ---------------- */
  const wx0 = W(win.a0), wx1 = W(win.a1)
  const wy0 = W(win.y0), wy1 = W(win.y1)
  const frameT = 0.16
  const frameD = 0.3
  const zWin = zF
  const frameParts: Array<[number, number, number, number, number, number]> = [
    // w h d  x y z（局部于窗中心）
    [wx1 - wx0 + frameT * 2, frameT, frameD, (wx0 + wx1) / 2, wy1 + frameT / 2, zWin], // 顶
    [wx1 - wx0 + frameT * 2, frameT, frameD, (wx0 + wx1) / 2, wy0 - frameT / 2, zWin], // 底(被窗台盖)
    [frameT, wy1 - wy0, frameD, wx0 - frameT / 2, (wy0 + wy1) / 2, zWin],
    [frameT, wy1 - wy0, frameD, wx1 + frameT / 2, (wy0 + wy1) / 2, zWin],
    [0.09, wy1 - wy0, frameD * 0.7, wx0 + (wx1 - wx0) / 3, (wy0 + wy1) / 2, zWin], // 中梃×2
    [0.09, wy1 - wy0, frameD * 0.7, wx0 + ((wx1 - wx0) * 2) / 3, (wy0 + wy1) / 2, zWin],
  ]
  for (const [w2, h2, d2, px, py, pz] of frameParts) {
    const m = box(w2, h2, d2, mats.woodDark, 'window_frame')
    m.position.set(px, py, pz - frameD / 2 + 0.05)
    g.add(m)
  }
  // 窗内暗色（室内模块再放设备）
  const inner = box(wx1 - wx0, wy1 - wy0, 0.05, mats.interiorDark, 'window_inner')
  inner.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, zB + 0.4)
  g.add(inner)
  // 窗台（外挑木板）
  const sill = box(wx1 - wx0 + 0.55, 0.14, 0.75, mats.wood, 'window_sill')
  sill.position.set((wx0 + wx1) / 2, wy0 - 0.07, zF + 0.12)
  g.add(sill)

  // 白窗帘（窗内左右各一块，轻微摆动）
  const curGeo = new THREE.PlaneGeometry(0.62, wy1 - wy0 - 0.1, 8, 4)
  for (const sx of [-1, 1]) {
    const cur = new THREE.Mesh(curGeo, mats.cloth.clone())
    cur.name = 'curtain'
    ;(cur.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    cur.position.set(sx < 0 ? wx0 + 0.34 : wx1 - 0.34, (wy0 + wy1) / 2, zF - 0.28) // 贴窗平面，不缩在室内深处
    cur.rotation.y = sx < 0 ? 0.18 : -0.18
    g.add(cur)
    anim.add(makeClothWave(cur, { amp: 0.04, freq: 1.1, speed: 1.1 }))
  }

  /* ---------------- 门（木板 + 框 + 把手） ---------------- */
  const dx0 = W(door.a0), dx1 = W(door.a1)
  const dh = W(door.y1)
  const doorFrame = (w2: number, h2: number, px: number, py: number) => {
    const m = box(w2, h2, 0.34, mats.woodDark, 'door_frame')
    m.position.set(px, py, zF - 0.02)
    g.add(m)
  }
  doorFrame(dx1 - dx0 + 0.3, 0.18, (dx0 + dx1) / 2, dh + 0.09)
  doorFrame(0.18, dh + 0.18, dx0 - 0.09, dh / 2)
  doorFrame(0.18, dh + 0.18, dx1 + 0.09, dh / 2)
  // 门板：竖向木板拼装
  const plankN = 4
  for (let i = 0; i < plankN; i++) {
    const pw = (dx1 - dx0) / plankN
    const plank = box(pw - 0.02, dh - 0.04, 0.16, i % 2 === 0 ? mats.woodDark : mats.wood, `door_plank_${i}`)
    plank.position.set(dx0 + pw * (i + 0.5), dh / 2, zF - 0.12)
    g.add(plank)
  }
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.metal)
  handle.name = 'door_handle'
  handle.position.set(dx0 + 0.22, dh * 0.48, zF - 0.24)
  g.add(handle)
  // 门前石阶
  const doorStep = box(W(9), 0.22, 0.9, mats.stone, 'door_step')
  doorStep.position.set((dx0 + dx1) / 2, 0.11, zF + 0.55)
  g.add(doorStep)

  /* ---------------- 室内暗空间 + 暖灯 ---------------- */
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(x1 - x0 - 0.2, wallH - 0.05, zF - zB - 0.3),
    new THREE.MeshBasicMaterial({ color: 0x453a31, side: THREE.BackSide }), // 不受光照的暗棕，窗内读作"深色店内"
  )
  room.name = 'interior_room'
  room.position.set(0, (wallH - 0.05) / 2, (zF + zB) / 2 - 0.05)
  g.add(room)
  const floor = box(x1 - x0 - 0.3, 0.05, zF - zB - 0.4, mats.woodFloor, 'interior_floor')
  floor.position.set(0, 0.03, (zF + zB) / 2)
  floor.castShadow = false
  g.add(floor)
  const lamp = new THREE.PointLight(0xffd9a0, 6, 9, 1.8)
  lamp.name = 'interior_lamp'
  lamp.position.set(-1.2, wallH * 0.78, -0.2)
  g.add(lamp)

  /* ---------------- 外露木梁（檐下托梁，参考图门窗上方可见） ---------------- */
  for (const bx of [wx0 - 0.4, (wx0 + wx1) / 2, wx1 + 0.4]) {
    const beam = box(0.14, 0.14, 0.7, mats.woodDark, 'eave_beam')
    beam.position.set(bx, wy1 + 0.35, zF + 0.18)
    g.add(beam)
  }

  return { group: g, interiorAnchor: new THREE.Vector3(0, 0, zF - 1.2) }
}
