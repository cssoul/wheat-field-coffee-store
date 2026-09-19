import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { shade } from '../utils/rng'
import { POLE, VOX } from '../utils/layout'
import type { BuildCtx } from './voxel'

/**
 * ============================================================================
 *  电力线路
 * ============================================================================
 *
 * 参考图里横跨天空的那几根电线是画面的重要构成 —— 它们把"微缩模型"的
 * 尺度感拉了出来（没有它们，天空就太空了）。
 *
 * 按提示词要求：只保留原有的电线杆 + 横梁 + 多根电线，不额外增加设施。
 *
 * 电线用 CatmullRomCurve3 采样的**悬链线**（不是直线也不是二次曲线），
 * 再用 TubeGeometry 扫出细管，这样才有真实电线那种"两端高、中间坠"的垂度。
 * 电线本身不参与阴影计算，纯装饰线条。
 */

/** 电线数量与挂点（相对杆顶的高度、在横梁上的 Z 向偏移） */
const WIRES: Array<{ y: number; dz: number; sag: number; dropToLeft: number }> = [
  { y: POLE.h - 1, dz: -6, sag: 3.0, dropToLeft: 2.5 },
  { y: POLE.h - 1, dz: 6, sag: 3.4, dropToLeft: 3.0 },
  { y: POLE.h - 4.5, dz: -6, sag: 3.8, dropToLeft: 3.6 },
  { y: POLE.h - 4.5, dz: 6, sag: 4.2, dropToLeft: 4.2 },
  { y: POLE.h - 8, dz: -3, sag: 4.6, dropToLeft: 5.0 },
  { y: POLE.h - 8, dz: 3, sag: 5.0, dropToLeft: 5.6 },
]

/** 电线往左右两侧都拉出画面外，避免在空中出现断头 */
const FAR_LEFT = -170
const FAR_RIGHT = 96

export function buildElectricSystem(ctx: BuildCtx): void {
  const { b, occ, group } = ctx

  /* ==================== 1. 电线杆 ==================== */
  const px = POLE.x
  const pz = POLE.z
  const H = POLE.h

  // 杆身：从地面到杆顶，略微收细（分三段）
  b.box(px - 1.5, 0, pz - 1.5, px + 1.5, H * 0.55, pz + 1.5, PAL.poleWood)
  b.box(px - 1.3, H * 0.55, pz - 1.3, px + 1.3, H * 0.82, pz + 1.3, shade(PAL.poleWood, 1.04))
  b.box(px - 1.1, H * 0.82, pz - 1.1, px + 1.1, H + 1.5, pz + 1.1, PAL.poleWoodDark)
  // 杆身的深色纵向纹路，增加木质感
  b.box(px - 1.6, 0, pz - 0.4, px - 1.2, H * 0.55, pz + 0.4, PAL.poleWoodDark)
  b.box(px + 1.2, 0, pz - 0.4, px + 1.6, H * 0.55, pz + 0.4, PAL.poleWoodDark)

  // 基础：地上的一小堆土石
  b.box(px - 3, -0.4, pz - 3, px + 3, 1, pz + 3, shade(PAL.dirtPathDark, 0.92))

  /* ==================== 2. 横梁（两道）+ 斜撑 ==================== */
  for (const [ay, len] of [
    [POLE.h - 1.8, 15],
    [POLE.h - 5.2, 15],
    [POLE.h - 8.8, 13],
  ] as const) {
    b.box(px - 1, ay, pz - len, px + 1, ay + 1.6, pz + len, PAL.crossArm)
    // 梁端倒角
    for (const s of [-1, 1]) {
      b.box(px - 1, ay + 0.4, pz + s * len, px + 1, ay + 1.2, pz + s * (len - 1), shade(PAL.crossArm, 0.9))
    }
    // 绝缘子：每根电线下面一个小瓷瓶
    for (const w of WIRES) {
      const onThisArm = Math.abs(w.y - ay) < 1.6
      if (!onThisArm) continue
      const iz = pz + w.dz
      b.box(px - 1.2, ay + 1.6, iz - 1.2, px + 1.2, ay + 3.2, iz + 1.2, PAL.insulator, 'gloss')
      b.box(px - 0.6, ay + 3.2, iz - 0.6, px + 0.6, ay + 3.8, iz + 0.6, shade(PAL.insulator, 0.85), 'gloss')
    }
    // 斜撑
    b.box(px - 0.6, ay - 3.6, pz - 0.6, px + 0.6, ay, pz + 0.6, PAL.poleWoodDark)
  }

  // 杆顶避雷针
  b.box(px - 0.3, H + 1.5, pz - 0.3, px + 0.3, H + 4, pz + 0.3, PAL.steelDark, 'gloss')

  /* ==================== 3. 电线（悬链线 + 细管） ==================== */
  const wireMat = new THREE.MeshStandardMaterial({
    color: PAL.wire,
    roughness: 0.72,
    metalness: 0.25,
  })

  for (const w of WIRES) {
    const attachY = w.y + 3.6 // 挂在绝缘子顶部
    const az = pz + w.dz

    // 右段：从杆子继续往画面右侧拉出去
    addWire(group, wireMat, px, attachY, az, FAR_RIGHT, attachY - w.dropToLeft * 0.5, az + 2, w.sag, 40)
    // 左段：横跨整个场景往左拉，一路缓降
    addWire(group, wireMat, FAR_LEFT, attachY - w.dropToLeft, az - 2, px, attachY, az, w.sag * 1.35, 64)
  }

  occ.disc(px, pz, 8)
}

/** 用悬链线采样出一条自然下垂的电线 */
function addWire(
  group: THREE.Group,
  mat: THREE.Material,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  sag: number,
  segs: number,
): void {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t)
    const z = z0 + (z1 - z0) * t
    pts.push(new THREE.Vector3(x * VOX, y * VOX, z * VOX))
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
  // 半径 0.022 世界单位 ≈ 屏幕上 2px 的细线 —— 参考图里的电线就是这么细，
  // 太粗会变成一根根横在天空的管子
  const geo = new THREE.TubeGeometry(curve, segs * 2, 0.022, 4, false)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  group.add(mesh)
}
