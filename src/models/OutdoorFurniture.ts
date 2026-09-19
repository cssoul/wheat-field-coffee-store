import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { shade } from '../utils/rng'
import { CAFE, DECK, FENCE, PAVING, SIDE_SEATING, UMBRELLA } from '../utils/layout'
import type { BuildCtx } from './voxel'

/**
 * ============================================================================
 *  室外休息区
 * ============================================================================
 *
 * 按参考图从左到右排：木栅栏 → 白伞 + 圆桌 + 折叠椅 → 木平台（懒人沙发、茶几）
 *   → 建筑 → 右侧另一组小桌椅
 *
 * 所有家具都是低多边形体素，没有一处用贴图 —— 靠"块面转折 + 抖色"出体积。
 */

/**
 * 户外家具的整体缩放系数。
 *
 * 家具的原始尺寸是按"墙高 15 格"配的，结果椅背做到 15.6 格 —— 和房子一样高，
 * 而地里的麦子才 3.9 格，等于说一把椅子有 4 米高。这种错误在俯视图里不明显，
 * 一到低视角就全是巨大的白块，平台完全读不出来。
 *
 * 按参考图重新标定：椅背 ≈ 墙高的 0.42（约 6 格）、桌面 ≈ 0.24（约 3.4 格），
 * 正好也和一株麦子的高度对得上。
 */
const FS = 0.42

/** 世界坐标下的绕 Y 旋转（与 VoxelBatch 的矩阵约定一致） */
function rot2(x: number, z: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a)
  return [x * c + z * s, -x * s + z * c]
}

/**
 * 圆润的团状体（懒人沙发、蒲团、坐垫都用它）。
 * 高度按 1-(d/r)² 衰减 —— 就是个半球，但体素化之后是"堆起来的软包"。
 */
function blob(
  ctx: BuildCtx,
  cx: number, cz: number,
  rx: number, rz: number,
  h: number,
  y0: number,
  color: number,
  squash = 1,
): void {
  const { b } = ctx
  for (let dx = -rx; dx < rx; dx++) {
    for (let dz = -rz; dz < rz; dz++) {
      const d = Math.hypot((dx + 0.5) / rx, (dz + 0.5) / rz)
      if (d > 1) continue
      let hh = h * Math.sqrt(Math.max(0, 1 - d * d))
      if (hh < 0.7) continue
      hh *= 0.86 + b.rnd() * 0.28 // 表面起伏，看起来是软的
      // 顶面中心略微压扁（坐过的人的痕迹）
      if (d < 0.35) hh *= 0.82 * squash
      const c = shade(color, 0.9 + b.rnd() * 0.2)
      b.box(cx + dx, y0, cz + dz, cx + dx + 1, y0 + hh, cz + dz + 1, c)
    }
  }
}

/** 木质平台：一块块木板拼出来，板缝之间留缝 */
function buildDeck(ctx: BuildCtx): void {
  const { b } = ctx
  const { x0, x1, z0, z1, y } = DECK

  // 平台下的支撑：整体垫起来，侧面看是厚厚一块
  b.box(x0, -1.5, z0, x1, y - 1, z1, PAL.woodDark)
  // 边缘围板
  b.box(x0 - 0.6, y - 1.6, z0 - 0.6, x1 + 0.6, y, z0, PAL.woodDark)
  b.box(x0 - 0.6, y - 1.6, z1, x1 + 0.6, y, z1 + 0.6, PAL.woodDark)
  b.box(x0 - 0.6, y - 1.6, z0 - 0.6, x0, y, z1 + 0.6, PAL.woodDark)
  b.box(x1, y - 1.6, z0 - 0.6, x1 + 0.6, y, z1 + 0.6, PAL.woodDark)

  // 木板条：沿 X 方向铺，板与板之间留 0.5 grid 的缝
  for (let z = z0; z < z1; z += 2.5) {
    const c = shade(b.rnd() < 0.5 ? PAL.plank : PAL.woodLit, 0.92 + b.rnd() * 0.16)
    b.box(x0, y - 1, z, x1, y, z + 2, c)
  }
  // 板缝阴影
  for (let z = z0; z < z1; z += 2.5) {
    b.box(x0, y - 1, z + 2, x1, y - 0.35, z + 2.5, shade(PAL.woodDark, 1.05))
  }

  ctx.occ.rect(x0, z0, x1, z1, 1)
}

/**
 * 白色遮阳伞：伞面按 8 个扇叶交替配色，伞骨 + 中柱 + 伞顶。
 *
 * 参考图里这把伞是全场最亮的白色块面，必须干净利落。
 * 尺寸是按参考图反算的：伞高 ≈ 屋脊高的 0.42、伞面直径 ≈ 建筑宽的 0.3，
 * 是一把秀气的小太阳伞 —— 做大了会把咖啡馆压下去，整个构图就散了。
 */
function buildUmbrella(ctx: BuildCtx): void {
  const { b, occ } = ctx
  const cx = UMBRELLA.x
  const cz = UMBRELLA.z
  const R = UMBRELLA.r
  const footY = DECK.y // 伞立在木平台上
  // 伞面高度要压过椅背（椅背约 6.5 格），否则从低视角看椅子会"顶穿"伞面
  const topY = CAFE.ridgeTopY * 0.55
  // 伞面的下垂量要够大，伞才是个"穹顶"而不是一张平桌子 ——
  // 但也不能太陡（>0.7R 就变成巫婆帽了），0.45R 左右最像遮阳伞
  const drop = R * 0.45

  // 中柱
  b.box(cx - 0.4, footY, cz - 0.4, cx + 0.4, topY, cz + 0.4, PAL.woodLit)
  b.box(cx - 0.55, topY, cz - 0.55, cx + 0.55, topY + 1.1, cz + 0.55, PAL.woodDark)

  // 伞面：极坐标撒点，按角度分成 8 个扇叶交替颜色
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const r = Math.hypot(dx, dz)
      if (r > R) continue
      // 伞沿做出轻微的波浪形收边
      const ang = Math.atan2(dz, dx)
      const wave = 1 + Math.sin(ang * 8) * 0.045
      if (r > R * wave) continue

      const t = r / R
      const yTop = topY - Math.pow(t, 1.25) * drop
      const sector = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) % 2
      let c = sector === 0 ? PAL.umbrella : PAL.umbrellaAlt
      // 受光面更亮：伞是从上往下照的
      c = shade(c, 1.06 - t * 0.14 + b.jit() * 0.03)
      b.box(cx + dx, yTop - 0.7, cz + dz, cx + dx + 1, yTop + 0.35, cz + dz + 1, c)
    }
  }

  // 伞骨：8 根木条从顶部放射出去，压在伞面下沿
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    for (let r = 2; r <= R; r += 1) {
      const px = cx + Math.cos(a) * r
      const pz = cz + Math.sin(a) * r
      const yTop = topY - Math.pow(r / R, 1.25) * drop
      b.box(px, yTop - 1.4, pz, px + 0.9, yTop - 0.3, pz + 0.9, PAL.woodDark)
    }
  }

  // 伞沿的垂坠布片：短一点、少一点，不然伞沿会糊成一圈白色碎块，
  // 从远处看像一堆石头而不是一把伞
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const r = R - 0.4
    const px = cx + Math.cos(a) * r
    const pz = cz + Math.sin(a) * r
    const yTop = topY - drop
    const dropH = 0.6 + b.rnd() * 0.9
    b.box(px, yTop - dropH, pz, px + 1, yTop, pz + 1,
      shade(PAL.umbrella, 0.92 + b.rnd() * 0.1))
  }

  occ.disc(cx, cz, R * 0.55)
}

/** 白色小圆桌 */
function buildRoundTable(ctx: BuildCtx, cx: number, cz: number, y0: number, color: number): void {
  const { b } = ctx
  const R = 6 * FS
  const topY = y0 + 8 * FS
  // 桌面：圆形撒点
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (Math.hypot(dx + 0.5, dz + 0.5) > R) continue
      b.box(cx + dx, topY - 1.2, cz + dz, cx + dx + 1, topY, cz + dz + 1,
        shade(color, 0.97 + b.jit() * 0.05))
    }
  }
  // 桌沿
  b.box(cx - 0.5, topY - 1.4, cz - 0.5, cx + 0.5, topY - 0.4, cz + 0.5, shade(color, 0.88))
  // 中柱 + 三脚
  b.box(cx - 0.6, y0, cz - 0.6, cx + 0.6, topY - 1.4, cz + 0.6, shade(color, 0.92))
  b.box(cx - 1.6, y0, cz - 0.4, cx + 1.6, y0 + 0.6, cz + 0.4, shade(color, 0.86))
  b.box(cx - 0.4, y0, cz - 1.6, cx + 0.4, y0 + 0.6, cz + 1.6, shade(color, 0.86))
}

/** 白色折叠椅（参考图里伞下那两把） */
function buildChair(
  ctx: BuildCtx,
  cx: number, cz: number,
  ang: number,
  y0: number,
  color: number,
): void {
  const { b } = ctx
  const put = (lx0: number, ly0: number, lz0: number, lx1: number, ly1: number, lz1: number, c: number) => {
    const [ox0, oz0] = rot2((lx0 + lx1) / 2, (lz0 + lz1) / 2, ang)
    const w = lx1 - lx0, d = lz1 - lz0
    b.box(
      cx + ox0 - w / 2, y0 + ly0, cz + oz0 - d / 2,
      cx + ox0 + w / 2, y0 + ly1, cz + oz0 + d / 2,
      c, 'matte', ang,
    )
  }
  // 座面（略微前倾）
  put(-4 * FS, 6.4 * FS, -4 * FS, 4 * FS, 7.4 * FS, 4 * FS, color)
  put(-4 * FS, 6.4 * FS, -4.4 * FS, 4 * FS, 7.0 * FS, -3.6 * FS, shade(color, 0.9))
  // 靠背
  put(-4 * FS, 7.4 * FS, -5.6 * FS, 4 * FS, 15 * FS, -4.6 * FS, color)
  put(-3.6 * FS, 9.6 * FS, -5.2 * FS, 3.6 * FS, 10.4 * FS, -4.8 * FS, shade(color, 0.92))
  put(-3.6 * FS, 12 * FS, -5.2 * FS, 3.6 * FS, 12.8 * FS, -4.8 * FS, shade(color, 0.92))
  // 靠背立柱
  put(-4.4 * FS, 7.4 * FS, -5.8 * FS, -3.6 * FS, 15.6 * FS, -4.4 * FS, shade(color, 0.95))
  put(3.6 * FS, 7.4 * FS, -5.8 * FS, 4.4 * FS, 15.6 * FS, -4.4 * FS, shade(color, 0.95))
  // 四条腿（外八字）
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    put(sx * 3.2 * FS - 0.5, 0, sz * 3.2 * FS - 0.5, sx * 3.2 * FS + 0.5, 6.4 * FS, sz * 3.2 * FS + 0.5, shade(color, 0.88))
  }
  // 踏脚横档
  put(-3.6 * FS, 2.2 * FS, -3.6 * FS, 3.6 * FS, 2.8 * FS, -2.8 * FS, shade(color, 0.9))
}

/** 木栅栏：竖板 + 两道横杆，最左侧那一排 */
function buildFence(ctx: BuildCtx): void {
  const { b, occ } = ctx
  const x = FENCE.x
  // 栅栏比院墙矮一截（参考图里是齐腰高的木栅栏，不是高墙）
  const H = 7

  for (let z = FENCE.z0; z <= FENCE.z1; z += 4) {
    const h = H + Math.round(b.rnd() * 2) - 1
    b.box(x - 0.8, 0, z, x + 0.8, h, z + 1.6, shade(PAL.woodDark, 0.94 + b.rnd() * 0.16))
  }
  // 横杆
  for (const y of [2.4, 5]) {
    b.box(x - 0.6, y, FENCE.z0, x + 0.6, y + 1.2, FENCE.z1 + 1.6, PAL.woodDark)
  }
  occ.rect(x - 2, FENCE.z0, x + 3, FENCE.z1 + 2, 1)
}

/** 木箱小几（平台上当茶几用的那种） */
function buildCrate(ctx: BuildCtx, cx: number, cz: number, y0: number, size: number): void {
  const { b } = ctx
  const s = size / 2
  b.box(cx - s, y0, cz - s, cx + s, y0 + size, cz + s, PAL.woodLit)
  // 四角包边
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    b.box(cx + sx * s - 0.4, y0, cz + sz * s - 0.4, cx + sx * s + 0.4, y0 + size, cz + sz * s + 0.4, PAL.woodDark)
  }
  b.box(cx - s, y0 + size * 0.42, cz - s, cx + s, y0 + size * 0.58, cz + s, shade(PAL.woodDark, 1.05))
}

/* ====================================================================== */

export function buildOutdoorFurniture(ctx: BuildCtx): void {
  const { b, occ } = ctx
  const deckY = DECK.y

  /* ---------------- 1. 木平台 ---------------- */
  buildDeck(ctx)

  /* ---------------- 2. 平台上的懒人沙发与坐垫 ---------------- */
  // 大号橙色懒人沙发
  blob(ctx, -30, 16, 5, 4.4, 4.2, deckY, PAL.loungerOrange)
  // 米白懒人沙发（在橙色的右后方）
  blob(ctx, -21, 14.5, 4, 3.6, 3.6, deckY, PAL.loungerCream)
  // 橙色长条坐垫（沿平台横铺）
  for (let x = -32; x < -22; x += 2) {
    const h = 1.8 + b.rnd() * 0.6
    b.box(x, deckY, 19.5, x + 2, deckY + h, 24.5,
      shade(b.rnd() < 0.6 ? PAL.loungerOrange : PAL.loungerOrangeLit, 0.9 + b.rnd() * 0.2))
  }
  // 坐垫边缘的滚边
  b.box(-32, deckY + 1.2, 19.5, -22, deckY + 1.8, 20.2, PAL.loungerOrangeDark)
  b.box(-32, deckY + 1.2, 23.8, -22, deckY + 1.8, 24.5, PAL.loungerOrangeDark)
  // 米白蒲团
  blob(ctx, -17, 25, 3, 3, 2.4, deckY, PAL.loungerCream)
  // 木箱茶几 + 上面的小杯
  buildCrate(ctx, -18, 20, deckY, 3)
  b.box(-17.4, deckY + 3, 20.4, -16.8, deckY + 3.6, 21, PAL.ceramic, 'gloss')
  b.box(-18.8, deckY + 3, 20.8, -18.2, deckY + 3.8, 21.4, PAL.ceramic, 'gloss')

  // 平台上的小盆栽（一排，参考图里靠墙摆着）
  for (let i = 0; i < 6; i++) {
    const px = DECK.x0 + 4 + i * 3
    const pz = DECK.z0 + 1.2
    b.box(px, deckY, pz, px + 1.4, deckY + 1.5, pz + 1.4, PAL.pot)
    for (let k = 0; k < 6; k++) {
      b.box(
        px + b.rnd() * 1.4, deckY + 1.5, pz + b.rnd() * 1.4,
        px + b.rnd() * 1.4 + 0.9, deckY + 1.5 + b.rnd() * 2, pz + b.rnd() * 1.4 + 0.9,
        shade(PAL.plantLit, 0.8 + b.rnd() * 0.4),
      )
    }
  }

  occ.rect(DECK.x0, DECK.z0, DECK.x1, DECK.z1, 1)

  /* ---------------- 3. 遮阳伞 + 圆桌 + 折叠椅 ---------------- */
  buildUmbrella(ctx)
  const tblTop = deckY + 8 * FS
  buildRoundTable(ctx, UMBRELLA.x, UMBRELLA.z, deckY, PAL.tableWhite)
  // 桌上的杯子与小花瓶（高度跟着桌面走，不能写死 —— 之前写死 8 格，
  // 桌子和伞都缩小之后，这两个杯子就飘在半空中）
  b.box(UMBRELLA.x - 0.8, tblTop, UMBRELLA.z - 0.8, UMBRELLA.x + 0.1, tblTop + 0.8, UMBRELLA.z + 0.1, PAL.ceramic, 'gloss')
  b.box(UMBRELLA.x + 0.5, tblTop, UMBRELLA.z + 0.5, UMBRELLA.x + 1.3, tblTop + 1.2, UMBRELLA.z + 1.3, PAL.pot)
  b.box(UMBRELLA.x + 0.7, tblTop + 1.2, UMBRELLA.z + 0.7, UMBRELLA.x + 1.1, tblTop + 2, UMBRELLA.z + 1.1, PAL.plant)

  buildChair(ctx, UMBRELLA.x - 4, UMBRELLA.z - 5, -1.05, deckY, PAL.chairWhite)
  buildChair(ctx, UMBRELLA.x + 4, UMBRELLA.z + 5, 1.35, deckY, PAL.chairWhite)
  occ.disc(UMBRELLA.x - 4, UMBRELLA.z - 5, 4)
  occ.disc(UMBRELLA.x + 4, UMBRELLA.z + 5, 4)

  /* ---------------- 4. 木栅栏 ---------------- */
  buildFence(ctx)

  /* ---------------- 5. 右侧另一组小桌 + 两把椅子 ---------------- */
  buildRoundTable(ctx, SIDE_SEATING.x, SIDE_SEATING.z, PAVING.y, PAL.tableWhite)
  buildChair(ctx, SIDE_SEATING.x - 4, SIDE_SEATING.z - 2, -1.3, PAVING.y, PAL.chairWhite)
  buildChair(ctx, SIDE_SEATING.x + 3.5, SIDE_SEATING.z + 4.5, 1.9, PAVING.y, PAL.chairWhite)
  occ.disc(SIDE_SEATING.x, SIDE_SEATING.z, 7)

  /* ---------------- 6. 门前窗下的矮木凳 ---------------- */
  b.box(6, PAVING.y, 14.5, 12, PAVING.y + 1, 17.5, PAL.woodLit)
  for (const lx of [6.4, 10.8]) {
    b.box(lx, PAVING.y + 1, 14.9, lx + 1.2, PAVING.y + 2.6, 16.2, PAL.woodDark)
  }
}
