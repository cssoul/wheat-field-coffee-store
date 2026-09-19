/**
 * 配色表 —— 全部色值直接从参考图 preview/ref_scene.png 上采样得到，
 * 不是凭感觉配的。
 *
 * 整体基调：暖白墙 + 金黄茅草屋顶 + 黄绿麦田，柔和的上午阳光，
 * 低对比、微暖白平衡。禁止赛博朋克 / 强科技蓝。
 */

export const PAL = {
  /* ---------------- 天空与环境（只保留天空和云，不做山/村/树林） --------- */
  skyTop: 0x3a8fc9, // 天顶：够蓝才有晴天感
  skyMid: 0x74b6da,
  skyHorizon: 0xc4dcE8, // 近地平线发白（大气散射）
  cloud: 0xfbfbf8,
  cloudShade: 0xd9dfe2,
  fog: 0xc3d5e0,

  /* ---------------- 地台 ---------------- */
  // 土地颜色刻意贴近麦田的暗部：麦子之间的缝隙看上去是"田里的暗处"，
  // 而不是一块块秃掉的泥地
  soilTop: 0x9c8a41,
  soilSide: 0x7a6733,
  soilBase: 0x61512a,

  /* ---------------- 建筑：白色手工砖墙 ---------------- */
  wallBrick: 0xe4dccb, // 暖白（比纯白多一层暖调，受光后才不会死白）
  wallBrickAlt: 0xd8cfba,
  wallCore: 0xded5c2,
  wallInner: 0x8c8478, // 门窗内侧的暗面
  wallGrout: 0xb2a894, // 砖缝，比砖略深

  /* ---------------- 屋顶：厚麦草（全图最大的视觉重点，颜色要够足） ------- */
  thatchLit: 0xd8ac57, // 受光的草面
  thatchMid: 0xc2954a, // 主体
  thatchDark: 0x9a7433,
  thatchTip: 0xe6c877, // 草尖高光
  thatchRoot: 0x85642c,

  /* ---------------- 木作 ---------------- */
  wood: 0xa97a45, // 采样 #c7a377 压深作木本色
  woodLit: 0xc7a377, // 采样值，用于木板受光面
  woodDark: 0x715322, // 采样自木栅栏
  woodFrame: 0x8a6034, // 门窗框
  woodTrim: 0xbf9159,
  plank: 0xb98e58,

  /* ---------------- 门窗玻璃 / 室内 ---------------- */
  glassDark: 0x52391e, // 采样自窗内 #52391e
  glassDeep: 0x3a2814,
  doorInner: 0x684422, // 采样自门内 #684422
  interiorWarm: 0xffd9a0, // 窗内暖光

  /* ---------------- 布帘 / 招牌 ---------------- */
  cloth: 0xe4dace, // 采样自 COFFEE 布帘
  clothShade: 0xcfc3b2,
  chalkboard: 0x2f3630,
  chalkFrame: 0x8a6a42,
  chalk: 0xe8ece4,

  /* ---------------- 户外家具 ---------------- */
  loungerOrange: 0xad6a2f, // 采样自橙色懒人沙发
  loungerOrangeLit: 0xc47f3c,
  loungerOrangeDark: 0x8d5322,
  loungerCream: 0xe8dcc6,
  loungerCreamDark: 0xcec0a4,
  umbrella: 0xeee8da, // 采样自白伞 #c3bdaf 提亮
  umbrellaAlt: 0xc9c0ac, // 扇叶交替色：差值要够大，伞面才有编织条纹感
  chairWhite: 0xe4ddcc,
  tableWhite: 0xe8e2d4,

  /* ---------------- 环境小物 ---------------- */
  plant: 0x69803f,
  plantLit: 0x8a9e58,
  plantDark: 0x4d5f30,
  pot: 0xd8cfc0,
  potDark: 0x8a8175, // 采样自陶盆
  flowerWhite: 0xf2efe2,

  /* ---------------- 麦田 ---------------- */
  wheatStalk: 0x9a8f2e,
  wheatStalkGreen: 0x93902f, // 青麦：黄绿而不是纯绿
  wheatStalkDry: 0xbb9c31, // 干麦：金黄
  wheatEar: 0xd9b747, // 穗部主色
  wheatEarLit: 0xf0d465,
  wheatEarDark: 0xb8933a,
  wheatGround: 0x9aa04a,

  /* ---------------- 铺装与小路 ---------------- */
  paving: 0xc1b2a0, // 采样自碎石铺装
  pavingAlt: 0xb3a492,
  pavingJoint: 0x9c8f7e,
  dirtPath: 0xc0a274, // 门前土路
  dirtPathDark: 0xa2864f,

  /* ---------------- 电力设施 ---------------- */
  poleWood: 0x8a8175, // 采样自电线杆
  poleWoodDark: 0x6e6558,
  crossArm: 0x7a7164,
  insulator: 0xbfc4bd,
  wire: 0x2b2b28,

  /* ---------------- 金属 / 陶 / 咖啡设备 ---------------- */
  steel: 0x9aa0a2,
  steelDark: 0x5c6265,
  ceramic: 0xf1ede4,
  coffeeBean: 0x4a2f1c,
  fridge: 0xeceae4,
  counterTop: 0xd9c9a8,
}

/** HUD 的绿色科技线（呼应数字孪生，但压低饱和避免突兀） */
export const HUD = {
  line: 0x5fbf8a,
  dim: 0x7f8c86,
}
