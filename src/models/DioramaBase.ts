import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { BASE, PATH, PATH_WIDTH, PAVING } from '../utils/layout'
import { shade, shiftHsl } from '../utils/rng'
import type { BuildCtx } from './voxel'

/**
 * ============================================================================
 *  矩形地台
 * ============================================================================
 *
 * 按提示词要求：整个场景是一块**矩形底座**，不是圆形岛。
 *
 * 结构分三层：
 *   1. 底板（plinth）—— 比土体略大一圈的深色底，做出"桌上模型底座"的感觉
 *   2. 土体 —— 侧面的土层
 *   3. 地表 —— 用 3×3 网格的土块拼出来，每块单独抖色，
 *      近处看是一格格的土，远处看是自然的土地色斑
 *
 * 屋前另铺碎石地坪、一条从右后方绕过来的土路。
 */

/** 地表土块尺寸（网格单位） */
const TILE = 3

export function buildDioramaBase(ctx: BuildCtx): void {
  const { b, occ } = ctx
  const { x0, x1, z0, z1, thick, rim } = BASE

  /* ---------------- 1. 底板 ---------------- */
  b.box(
    x0 - rim, -(thick + rim), z0 - rim,
    x1 + rim, -thick, z1 + rim,
    PAL.soilBase,
  )
  // 底板顶面的一圈浅色边线，让"模型底座"的层次更清楚
  b.box(
    x0 - rim, -thick - 0.9, z0 - rim,
    x1 + rim, -thick, z1 + rim,
    shade(PAL.soilBase, 1.22),
  )

  /* ---------------- 2. 土体 ---------------- */
  b.box(x0, -thick, z0, x1, 0, z1, PAL.soilSide)

  /* ---------------- 3. 地表土块 ---------------- */
  // 越靠场景边缘越"野"（偏绿），建筑周围偏土黄 —— 呼应参考图里
  // 远处麦田偏青、近处偏金黄的色彩关系
  const nx = Math.ceil((x1 - x0) / TILE)
  const nz = Math.ceil((z1 - z0) / TILE)
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const tx0 = x0 + i * TILE
      const tz0 = z0 + j * TILE
      const tx1 = Math.min(x1, tx0 + TILE)
      const tz1 = Math.min(z1, tz0 + TILE)

      // 距建筑的距离：近处土黄，远处带青
      const cx = (tx0 + tx1) / 2
      const cz = (tz0 + tz1) / 2
      const far = Math.min(1, Math.hypot(cx, cz - 6) / 78)
      let c = shiftHsl(PAL.soilTop, -0.035 * far, 0.05 * far, -0.02 * far)

      // 田埂的隐约走向：斜向的暗条纹，让土地不是一坨纯色
      if ((Math.round((cx + cz * 1.7) / TILE) % 9) === 0) c = shade(c, 0.9)

      c = shade(c, 1 + b.jit() * 0.09)
      b.box(tx0, -1, tz0, tx1, 0, tz1, c)
    }
  }

  /* ---------------- 4. 屋前碎石铺装 ---------------- */
  buildPaving(ctx)

  /* ---------------- 5. 门前土路 ---------------- */
  buildDirtPath(ctx)

  /* ---------------- 占地登记 ---------------- */
  occ.poly(PATH, PATH_WIDTH / 2 + 3)
  occ.rect(PAVING.x0, PAVING.z0, PAVING.x1, PAVING.z1, 2)
}

/* ---------------------------------------------------------------------- */

/** 碎石地坪：先铺一层砖缝色，再一块块错落铺石板，做出不规则的石砌感 */
function buildPaving(ctx: BuildCtx): void {
  const { b } = ctx
  const { x0, x1, z0, z1, y } = PAVING

  // 砖缝底色
  b.box(x0, -0.3, z0, x1, y * 0.5, z1, PAL.pavingJoint)

  const step = 3
  for (let x = x0; x < x1; x += step) {
    for (let z = z0; z < z1; z += step) {
      // 每块石板自己的尺寸略有出入，避免网格感
      const w = step - 0.5 - b.rnd() * 0.9
      const d = step - 0.5 - b.rnd() * 0.9
      const sx = x + 0.2 + b.rnd() * 0.4
      const sz = z + 0.2 + b.rnd() * 0.4
      const ex = Math.min(x1, sx + w)
      const ez = Math.min(z1, sz + d)
      if (ex - sx < 1 || ez - sz < 1) continue

      const tone = b.rnd()
      let c = tone < 0.5 ? PAL.paving : PAL.pavingAlt
      if (tone > 0.87) c = shade(PAL.paving, 0.86) // 偶尔一块深色石
      c = shade(c, 1 + b.jit() * 0.07)

      // 石板顶面高度随机起伏 ±0.15，肉眼看去是凹凸不平的碎石地
      const top = y + (b.rnd() - 0.4) * 0.3
      b.box(sx, -0.2, sz, ex, top, ez, c)
    }
  }
}

/** 门前土路：沿折线一路铺过去，边缘随机缺角，不做成一条硬边色带 */
function buildDirtPath(ctx: BuildCtx): void {
  const { b } = ctx
  const half = PATH_WIDTH / 2

  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i]
    const [bx, bz] = PATH[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.ceil(len / 1.5)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = ax + (bx - ax) * t
      const cz = az + (bz - az) * t
      for (let ox = -half; ox <= half; ox += 1.5) {
        for (let oz = -half; oz <= half; oz += 1.5) {
          const d = Math.hypot(ox, oz)
          // 边缘随机缺角，让路沿毛糙
          if (d > half - 0.5 - b.rnd() * 2.4) continue
          const px = cx + ox
          const pz = cz + oz
          let c = b.rnd() < 0.32 ? PAL.dirtPathDark : PAL.dirtPath
          c = shade(c, 1 + b.jit() * 0.1)
          // 路中间被踩得更实、更浅
          if (d < half * 0.55) c = shade(c, 1.06)
          b.box(px, -0.4, pz, px + 1.5, 0.35, pz + 1.5, c, 'matte')
        }
      }
    }
  }
}

/* ---------------------------------------------------------------------- */
/* 说明：这里刻意不做"假的接触阴影贴片"。                                  */
/* 场景用的是真实的方向光阴影贴图（PCFSoft），再叠一层半透明黑斑只会把     */
/* 麦田压出莫名其妙的暗块 —— 参考图里没有这种东西。                       */
