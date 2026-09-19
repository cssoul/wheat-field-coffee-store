/**
 * 场景总布局 —— 所有建模模块共用的唯一坐标来源。
 *
 * 单位：网格单位 grid（1 grid = VOX = 0.25 世界单位），与参考图实测值一一对应。
 * 原点：地台顶面中心。y = 0 即地面，建筑、家具都站在 y ≥ 0。
 * 朝向：建筑正面（主立面）朝 +Z。
 *
 * 全部数值按 assets.png 左上角「整体场景效果」量出：
 *   屋檐总跨度 : 屋脊总高 = 2.5 : 1（又长又矮的茅草棚）
 *   窗占正面宽 41%（22%~63%），门占 15%（73%~88%）
 *   电线杆高 ≈ 屋脊 × 1.45，挂在建筑右后方
 */

/** 一个网格单位对应的世界尺寸 */
export const VOX = 0.25

/** 地台（矩形微缩底座，不是圆形岛） */
export const BASE = {
  x0: -60, x1: 60,
  z0: -44, z1: 30,
  /** 土层厚度（参考图底沿是薄薄一条深色边） */
  thick: 2.5,
  /** 底座侧沿（模型底板感）外扩 */
  rim: 2,
} as const

/** 咖啡馆主体；墙/檐/脊整体加高 1m（4 格），屋顶板减薄为 1/3，整体后移 2m（z - 8 格） */
export const CAFE = {
  x0: -22, x1: 22,
  z0: -20, z1: 2,
  wallH: 18.3,
  wallT: 2,
  ridgeZ: -9,
  roofX0: -26.5, roofX1: 26.5,
  roofZ0: -24, roofZ1: 6,
  eaveTopY: 19.7,
  ridgeTopY: 25.2,
  roofThick: 1.35,
} as const

/** 主立面（南墙）上的洞口；窗台随墙加高 +1m */
export const OPENINGS = {
  window: { a0: -12, a1: 6, y0: 6.5, y1: 15 },
  door: { a0: 10, a1: 16.5, y0: 0, y1: 12.6 },
  sideWindow: { a0: -6, a1: -1, y0: 9.6, y1: 14.4 }, // 西山墙
} as const

/** 木平台（建筑左前方，橙沙发区；随建筑后移 2m） */
export const DECK = {
  x0: -33, x1: -4,
  z0: 3, z1: 22,
  y: 1.2,
} as const

/** 窗下与门前碎石铺装（随建筑后移 2m；z1 扩到 20，屋前留出开阔空地） */
export const PAVING = {
  x0: -15, x1: 22,
  z0: 3, z1: 20,
  y: 0.5,
} as const

/** 屋子右侧碎石空地（缩小一半：10×10 格，不长麦） */
export const GRAVEL_PATCH = { x0: 24, x1: 34, z0: -2, z1: 8 } as const

/** 白色遮阳伞（木平台上，秀气小太阳伞） */
export const UMBRELLA = { x: -27, z: 13, r: 5 } as const

/** 木栅栏（场景左侧靠后） */
export const FENCE = { x: -50, z0: -6, z1: 10 } as const

/** 电线杆 */
export const POLE = { x: 30, z: -8, h: 30 } as const

/** 门外右侧小桌椅 */
export const SIDE_SEATING = { x: 27, z: -5 } as const

/** 青苗/野花区（建筑右侧靠后一小片） */
export const SEEDLING_ZONE = { x0: 24, x1: 56, z0: -38, z1: -12 } as const
