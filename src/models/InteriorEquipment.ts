import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { shade } from '../utils/rng'
import { CAFE, OPENINGS } from '../utils/layout'
import type { BuildCtx } from './voxel'

/**
 * ============================================================================
 *  室内咖啡设备
 * ============================================================================
 *
 * 数字孪生要"看得进去"，所以室内必须是有内容的，而不是一个空壳。
 *
 * 每件设备都拆成独立的构件函数（主机/出水头/手柄/按钮…），
 * 这样后续要做"点击某台设备弹出信息卡"时，只要给对应构件挂 raycast 目标即可，
 * 不需要重新建模。
 *
 * 从窗口平视进去的视线顺序（从远到近）：
 *   墙面搁板与杯子 → 咖啡机 / 磨豆机 / 水槽 → 窗内吧台
 */

export function buildInteriorEquipment(ctx: BuildCtx): void {
  const { b } = ctx

  /* ==================== 0. 地面与内衬 ==================== */
  const ix0 = CAFE.x0 + CAFE.wallT
  const ix1 = CAFE.x1 - CAFE.wallT
  const iz0 = CAFE.z0 + CAFE.wallT
  const iz1 = CAFE.z1 - CAFE.wallT

  // 木地板：一条条铺
  for (let z = iz0; z < iz1; z += 3) {
    b.box(ix0, 0, z, ix1, 0.6, z + 2.6, shade(PAL.woodLit, 0.86 + b.rnd() * 0.16))
  }
  // 内墙木衬板（让室内是暖木色，而不是白墙的背面）
  const lining = shade(PAL.woodDark, 1.05)
  b.box(ix0, 0.6, iz0, ix1, CAFE.wallH, iz0 + 0.8, lining)
  b.box(ix0, 0.6, iz0, ix0 + 0.8, CAFE.wallH, iz1, lining)
  b.box(ix1 - 0.8, 0.6, iz0, ix1, CAFE.wallH, iz1, lining)
  // 南墙内侧衬板要绕开窗洞，否则会把窗口堵死
  const win = OPENINGS.window
  const sw = iz1 - 0.8
  b.box(ix0, 0.6, sw, ix1, win.y0, iz1, lining) // 窗台以下
  b.box(ix0, win.y1, sw, ix1, CAFE.wallH, iz1, lining) // 窗楣以上
  b.box(ix0, win.y0, sw, win.a0, win.y1, iz1, lining) // 窗左侧
  b.box(win.a1, win.y0, sw, ix1, win.y1, iz1, lining) // 窗右侧

  // 顶棚：封住阁楼，室内才有天花板；观众从窗口看进去不会看到屋顶背面
  b.box(ix0, CAFE.wallH - 1.6, iz0, ix1, CAFE.wallH - 0.4, iz1, shade(PAL.woodDark, 1.12))

  // 顶面横梁
  for (let x = ix0 + 4; x < ix1 - 2; x += 8) {
    b.box(x, CAFE.wallH - 2.6, iz0, x + 1.4, CAFE.wallH - 1.6, iz1, shade(PAL.woodDark, 1.2))
  }

  /* ==================== 1. 后吧台 + 台下木柜 ==================== */
  const bcZ0 = iz0 + 1
  const bcZ1 = iz0 + 7
  const bcTop = 8.6
  // 柜体
  b.box(ix0 + 1, 0.6, bcZ0, ix1 - 1, bcTop - 1, bcZ1, PAL.wood)
  // 柜门分格（竖向深色缝）
  for (let x = ix0 + 1; x < ix1 - 1; x += 6) {
    b.box(x, 0.8, bcZ1 - 0.4, x + 0.6, bcTop - 1.4, bcZ1, shade(PAL.woodDark, 0.95))
    b.box(x + 2.6, 4.2, bcZ1, x + 3.4, 5.0, bcZ1 + 0.6, PAL.steelDark, 'gloss') // 拉手
  }
  // 台面
  b.box(ix0 + 0.4, bcTop - 1, bcZ0 - 0.5, ix1 - 0.4, bcTop, bcZ1 + 2, PAL.counterTop)
  b.box(ix0 + 0.4, bcTop, bcZ0 - 0.5, ix1 - 0.4, bcTop + 0.3, bcZ1 + 2, shade(PAL.counterTop, 1.06))

  /* ==================== 2. 意式咖啡机（模块化） ==================== */
  buildEspressoMachine(ctx, -6, bcTop, bcZ1 - 2.4)
  /* ==================== 3. 磨豆机 ==================== */
  buildGrinder(ctx, 1.5, bcTop, bcZ1 - 1.6)
  /* ==================== 4. 水槽 + 龙头 ==================== */
  buildSink(ctx, 11, bcTop, bcZ1 - 2.6)

  /* ==================== 5. 墙面搁板 + 杯子 ==================== */
  for (const shelfY of [13.5, 17.5]) {
    b.box(ix0 + 1, shelfY, iz0 + 1, ix1 - 1, shelfY + 0.8, iz0 + 4, PAL.woodLit)
    // 杯列
    for (let x = ix0 + 2.4; x < ix1 - 3; x += 2.6) {
      b.box(x, shelfY + 0.8, iz0 + 1.6, x + 1.4, shelfY + 2.6, iz0 + 3, PAL.ceramic, 'gloss')
    }
  }
  // 中间层摆咖啡豆罐
  b.box(ix0 + 1, 15.4, iz0 + 1, ix1 - 1, 16.2, iz0 + 4, PAL.woodLit)
  for (let x = ix0 + 3; x < ix1 - 3; x += 5) {
    b.box(x, 16.2, iz0 + 1.8, x + 2, 18.4, iz0 + 3.6, PAL.coffeeBean, 'gloss')
    b.box(x + 0.2, 18.4, iz0 + 2, x + 1.8, 18.8, iz0 + 3.4, PAL.steel, 'gloss')
  }

  /* ==================== 6. 白色冰箱 ==================== */
  buildFridge(ctx, ix1 - 7, 0.6, iz0 + 8)

  /* ==================== 7. 窗内吧台 ==================== */
  const wcZ = CAFE.z1 - CAFE.wallT - 2
  b.box(ix0 + 2, 0.6, wcZ, ix1 - 2, 6.4, wcZ + 2.4, shade(PAL.wood, 1.05))
  b.box(ix0 + 1.6, 6.4, wcZ - 0.6, ix1 - 1.6, 7.0, wcZ + 3.2, PAL.counterTop)
  // 台面小物：杯子、咖啡壶、菜单牌
  for (let i = 0; i < 5; i++) {
    const x = ix0 + 4 + i * 4
    b.box(x, 7, wcZ, x + 1.5, 8.6, wcZ + 1.5, PAL.ceramic, 'gloss')
  }
  buildCoffeePot(ctx, ix1 - 9, 7, wcZ + 0.4)
  // 小菜单立牌
  b.box(-2, 7, wcZ - 0.2, 1.6, 7.4, wcZ + 1.6, PAL.woodDark)
  b.box(-1.6, 7.4, wcZ, 1.2, 11, wcZ + 0.6, shade(PAL.cloth, 0.98))
  // 吧台下的木凳
  for (const sx of [ix0 + 3, ix0 + 11]) {
    b.box(sx, 0.6, wcZ - 4.5, sx + 3, 5.4, wcZ - 1.5, PAL.woodLit)
    b.box(sx + 0.4, 5.4, wcZ - 4.5, sx + 2.6, 6, wcZ - 1.5, shade(PAL.wood, 1.1))
  }

  /* ==================== 8. 顶灯（自发光，室内不至于死黑） ==================== */
  for (const lx of [-8, 6]) {
    b.box(lx - 1.4, CAFE.wallH - 3.2, -2, lx + 1.4, CAFE.wallH - 1.8, 0.6, 0xffd9a0, 'glow')
    b.box(lx - 0.4, CAFE.wallH - 1.8, -1.2, lx + 0.4, CAFE.wallH - 0.6, -0.2, PAL.steelDark)
  }
}

/* ====================================================================== */
/* 单件设备                                                                */
/* ====================================================================== */

/**
 * 意式半自动咖啡机。
 * 构件：主体 / 顶部温杯盘 / 冲煮头 / 手柄 / 双出水嘴 / 按键面板 / 蒸汽棒 / 接水盘
 */
function buildEspressoMachine(ctx: BuildCtx, x: number, y: number, z: number): void {
  const { b } = ctx
  const steel = PAL.steel
  const dark = PAL.steelDark

  // 主体（略后仰的方箱）
  b.box(x, y, z, x + 12, y + 8, z + 7, steel, 'gloss')
  // 前面板：深色玻璃 + 按键
  b.box(x + 0.6, y + 0.6, z - 0.3, x + 11.4, y + 7.4, z + 0.2, dark, 'gloss')
  for (let i = 0; i < 4; i++) {
    const bx = x + 1.6 + i * 2.6
    b.box(bx, y + 5.6, z - 0.7, bx + 1.4, y + 7, z - 0.2, i % 2 === 0 ? 0xe8f0e6 : 0xd8c07a, 'gloss')
  }
  // 顶部温杯盘（带几个倒扣的杯圈）
  b.box(x - 0.6, y + 8, z - 0.6, x + 12.6, y + 8.9, z + 7.6, dark, 'gloss')
  for (let i = 0; i < 4; i++) {
    b.box(x + 1.4 + i * 2.8, y + 8.9, z + 1.4, x + 2.8 + i * 2.8, y + 9.7, z + 3.2, PAL.ceramic, 'gloss')
  }
  // 冲煮头
  b.box(x + 2.4, y + 3.4, z - 2.2, x + 9.6, y + 5, z - 0.2, dark, 'gloss')
  // 手柄（portafilter）：向外的横杆 + 粉碗
  b.box(x + 5.2, y + 3.4, z - 4.6, x + 6.8, y + 4.2, z - 0.4, dark, 'gloss')
  b.box(x + 4.2, y + 3.2, z - 5.6, x + 7.8, y + 4.6, z - 4.2, steel, 'gloss')
  b.box(x + 9.2, y + 3.6, z - 4.2, x + 10.6, y + 5.4, z - 2.6, PAL.woodDark)
  // 双出水嘴
  for (const dx of [5.6, 6.6]) {
    b.box(x + dx, y + 1.6, z - 4, x + dx + 0.7, y + 3.4, z - 3.3, dark, 'gloss')
  }
  // 接水盘
  b.box(x + 2, y + 0.2, z - 4.4, x + 10, y + 1.6, z + 0.4, dark, 'gloss')
  b.box(x + 2.4, y + 1.0, z - 4, x + 9.6, y + 1.4, z, shade(steel, 0.8), 'gloss')
  // 蒸汽棒
  b.box(x + 11.6, y + 2.6, z - 2.2, x + 12.4, y + 5.4, z - 1.2, steel, 'gloss')
  b.box(x + 11.4, y + 1.4, z - 2.4, x + 12.6, y + 2.6, z - 1, dark, 'gloss')
}

/** 磨豆机：豆仓 / 机身 / 出粉口 / 粉碗托 */
function buildGrinder(ctx: BuildCtx, x: number, y: number, z: number): void {
  const { b } = ctx
  // 机身
  b.box(x, y, z, x + 6, y + 9, z + 5.5, PAL.steelDark, 'gloss')
  b.box(x + 0.4, y + 0.4, z - 0.3, x + 5.6, y + 8.6, z + 0.2, shade(PAL.steel, 0.85), 'gloss')
  // 豆仓（半透明观感：用浅亮的米黄块面表示）
  b.box(x + 1.2, y + 9, z + 0.8, x + 4.8, y + 14, z + 4.4, 0xe8dcc0, 'gloss')
  b.box(x + 1.6, y + 9.4, z + 1.2, x + 4.4, y + 12, z + 4, PAL.coffeeBean)
  b.box(x + 1, y + 14, z + 0.6, x + 5, y + 15, z + 4.6, PAL.steelDark, 'gloss')
  // 出粉口 + 粉碗托
  b.box(x + 2.2, y + 5.6, z - 1.8, x + 3.8, y + 7.4, z + 0.2, PAL.steel, 'gloss')
  b.box(x + 1.4, y + 4.6, z - 2.6, x + 4.6, y + 5.4, z - 1.4, PAL.steelDark, 'gloss')
  b.box(x + 2, y + 4.4, z - 2.2, x + 4, y + 4.8, z - 1.6, PAL.coffeeBean)
  // 侧面的调节旋钮
  b.box(x + 6, y + 6, z + 1.6, x + 6.7, y + 7.6, z + 3.6, PAL.steel, 'gloss')
}

/** 水槽 + 龙头 */
function buildSink(ctx: BuildCtx, x: number, y: number, z: number): void {
  const { b } = ctx
  // 槽体：外圈台面 + 内凹盆底
  b.box(x, y - 0.6, z, x + 10, y + 0.4, z + 6, PAL.steel, 'gloss')
  b.box(x + 1, y - 0.5, z + 1, x + 9, y - 0.1, z + 5, shade(PAL.steelDark, 0.8), 'gloss')
  // 沥水板
  for (let i = 0; i < 6; i++) {
    b.box(x + 1.4 + i * 1.4, y + 0.4, z + 1, x + 2 + i * 1.4, y + 0.6, z + 5, shade(PAL.steel, 1.05), 'gloss')
  }
  // 龙头：立柱 + 弯头 + 出水口
  b.box(x + 4.6, y + 0.4, z + 4.6, x + 5.6, y + 7.4, z + 5.6, PAL.steel, 'gloss')
  b.box(x + 4.4, y + 7.4, z + 2.2, x + 5.8, y + 8.4, z + 5.8, PAL.steel, 'gloss')
  b.box(x + 4.4, y + 6.4, z + 2.2, x + 5.8, y + 7.4, z + 3.2, PAL.steel, 'gloss')
  // 冷热水把
  b.box(x + 6, y + 5.6, z + 4.8, x + 7.2, y + 6.6, z + 5.6, PAL.steelDark, 'gloss')
  b.box(x + 3.0, y + 5.6, z + 4.8, x + 4.2, y + 6.6, z + 5.6, PAL.steelDark, 'gloss')
}

/** 白色冰箱 */
function buildFridge(ctx: BuildCtx, x: number, y: number, z: number): void {
  const { b } = ctx
  b.box(x, y, z, x + 9, y + 20, z + 8, PAL.fridge)
  // 门缝
  b.box(x - 0.3, y + 12.4, z + 0.6, x + 9.3, y + 13, z + 8, shade(PAL.fridge, 0.82))
  // 门把手
  for (const hy of [9, 17]) {
    b.box(x + 7.4, y + hy, z - 0.7, x + 8.4, y + hy + 6, z - 0.2, PAL.steel, 'gloss')
  }
  // 顶上的纸盒杂物
  b.box(x + 1, y + 20, z + 1.6, x + 4, y + 22.2, z + 4.4, PAL.woodLit)
  b.box(x + 5, y + 20, z + 2, x + 7.6, y + 21.6, z + 4.6, shade(PAL.cloth, 0.96))
}

/** 玻璃咖啡壶（壶身 + 壶盖 + 手柄 + 里的咖啡液） */
function buildCoffeePot(ctx: BuildCtx, x: number, y: number, z: number): void {
  const { b } = ctx
  // 壶身：下部深（咖啡液），上部浅（玻璃）
  b.box(x, y, z, x + 3.6, y + 2, z + 3.6, PAL.coffeeBean)
  b.box(x, y + 2, z, x + 3.6, y + 5, z + 3.6, 0xd8cfba, 'gloss')
  b.box(x + 0.3, y + 5, z + 0.3, x + 3.3, y + 5.8, z + 3.3, PAL.steelDark, 'gloss')
  // 壶嘴
  b.box(x + 3.6, y + 3.4, z + 1.2, x + 4.6, y + 4.6, z + 2.4, 0xd8cfba, 'gloss')
  // 手柄
  b.box(x - 1.2, y + 2.4, z + 3.6, x + 0.2, y + 3.6, z + 5, PAL.woodDark)
  b.box(x - 1.2, y + 1.2, z + 3.6, x + 0.2, y + 2.4, z + 4.4, PAL.woodDark)
  // 底座加热板
  b.box(x - 0.4, y - 0.4, z - 0.4, x + 4, y, z + 4, PAL.steelDark, 'gloss')
}

/** 供外部查询室内设备清单（数字孪生 HUD / 交互预留） */
export const INTERIOR_UNITS = [
  { id: 'espresso-machine', label: 'Espresso Machine', state: 'ACTIVE' },
  { id: 'grinder', label: 'Coffee Grinder', state: 'READY' },
  { id: 'sink', label: 'Wash Sink', state: 'OK' },
  { id: 'cabinet', label: 'Cup Cabinet', state: 'STOCKED' },
  { id: 'fridge', label: 'Fridge', state: '4°C' },
  { id: 'counter', label: 'Window Bar', state: 'OPEN' },
] as const

/** 把室内设备做成可被射线拾取的目标（后续做点击查看时的挂载点） */
export function tagInteriorPickables(group: THREE.Group): void {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.pickable = true
  })
}
