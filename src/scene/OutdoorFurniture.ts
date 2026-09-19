/**
 * OutdoorFurniture —— 室外家具（与 Asset Sheet 对应）：
 * 遮阳伞（伞面褶皱）/ 木桌 / 木椅 / 橙色懒人沙发（视觉识别元素）/ 小茶几 / 花盆
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import { LightingManager } from '../three/LightingManager'
import type { AssetInfo } from '../types/twin'
import { SIDE_SEATING, UMBRELLA, VOX } from './layout'

const W = (g: number): number => g * VOX

function box(w: number, h: number, d: number, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.castShadow = true
  m.receiveShadow = true
  m.name = name
  return m
}
function cyl(rt: number, rb: number, h: number, mat: THREE.Material, name: string, seg = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.castShadow = true
  m.name = name
  return m
}

/** 遮阳伞：伞面用 LatheGeometry + 径向褶皱（8 道波浪），伞杆 + 底座 */
function makeUmbrella(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'outdoor_umbrella'
  const R = 1.25
  const H = 2.45
  const drop = R * 0.42

  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    pts.push(new THREE.Vector2(0.06 + (R - 0.06) * t, H - drop * t * t))
  }
  const geo = new THREE.LatheGeometry(pts, 48)
  // 径向褶皱：顶点沿半径做 8 道正弦收缩 + 边缘荷叶边下垂
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > 0.1) {
      const th = Math.atan2(z, x)
      const fold = 1 + 0.055 * Math.sin(th * 8)
      const scallop = r > R * 0.9 ? Math.max(0, Math.sin(th * 8)) * 0.09 * (r / R) : 0
      pos.setX(i, x * fold)
      pos.setZ(i, z * fold)
      pos.setY(i, y - scallop)
    }
  }
  geo.computeVertexNormals()
  const canopyMat = mats.cloth.clone()
  ;(canopyMat as THREE.MeshStandardMaterial).color.set(0xefe6d2) // 米白偏暖，避免死白
  const canopy = new THREE.Mesh(geo, canopyMat)
  ;(canopy.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  canopy.name = 'umbrella_canopy'
  canopy.castShadow = true
  g.add(canopy)
  // 伞顶尖
  const tip = cyl(0.02, 0.035, 0.18, mats.woodDark, 'umbrella_tip', 8)
  tip.position.y = H + 0.08
  g.add(tip)
  // 伞杆 + 底座
  const pole = cyl(0.035, 0.045, H, mats.woodDark, 'umbrella_pole', 10)
  pole.position.y = H / 2
  g.add(pole)
  const baseW = cyl(0.3, 0.36, 0.14, mats.stone, 'umbrella_base', 14)
  baseW.position.y = 0.07
  g.add(baseW)
  return g
}

/** 木桌：厚桌面 + 斜腿 */
function makeTable(mats: MaterialLibrary, w = 1.15, h = 0.62): THREE.Group {
  const g = new THREE.Group()
  g.name = 'outdoor_table'
  const top = box(w, 0.07, w * 0.78, mats.wood, 'table_top')
  top.position.y = h
  g.add(top)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = box(0.06, h, 0.06, mats.woodDark, 'table_leg')
    leg.position.set((sx * w) / 2 - sx * 0.07, h / 2, (sz * w * 0.78) / 2 - sz * 0.05)
    leg.rotation.z = sx * 0.06
    g.add(leg)
  }
  return g
}

/** 木椅：座板 + 靠背 + 四腿 */
function makeChair(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'outdoor_chair'
  const seat = box(0.42, 0.05, 0.4, mats.wood, 'chair_seat')
  seat.position.y = 0.4
  g.add(seat)
  const back = box(0.42, 0.42, 0.05, mats.wood, 'chair_back')
  back.position.set(0, 0.62, -0.18)
  back.rotation.x = -0.08
  g.add(back)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = box(0.05, 0.4, 0.05, mats.woodDark, 'chair_leg')
    leg.position.set(sx * 0.17, 0.2, sz * 0.15)
    g.add(leg)
  }
  return g
}

/** 橙色懒人沙发（视觉识别元素：米白+橙+原木；座体压扁 + 靠背竖长贴在后面） */
function makeBeanSofa(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'outdoor_sofa'
  const seat = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 14), mats.orange)
  seat.scale.set(1.35, 0.5, 1.05)
  seat.position.y = 0.3
  seat.castShadow = true
  seat.name = 'sofa_seat'
  g.add(seat)
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), mats.orange)
  back.scale.set(1.3, 0.62, 0.42)
  back.position.set(0, 0.62, -0.38)
  back.rotation.x = -0.35
  back.castShadow = true
  back.name = 'sofa_back'
  g.add(back)
  // 扶手卷（两端小圆卷，读作"沙发"而不是球）
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mats.orange)
    arm.scale.set(0.8, 0.8, 1.4)
    arm.position.set(sx * 0.62, 0.45, -0.1)
    arm.castShadow = true
    arm.name = 'sofa_arm'
    g.add(arm)
  }
  // 米白靠垫
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mats.cream)
  cushion.scale.set(1.05, 0.9, 0.5)
  cushion.position.set(-0.3, 0.85, -0.45)
  cushion.rotation.z = 0.3
  cushion.castShadow = true
  cushion.name = 'sofa_cushion'
  g.add(cushion)
  return g
}

/** 米白小沙发（长凳加软垫） */
function makeWhiteSofa(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'outdoor_white_sofa'
  const seat = box(1.05, 0.28, 0.55, mats.cream, 'wsofa_seat')
  seat.position.y = 0.3
  g.add(seat)
  const back = box(1.05, 0.42, 0.16, mats.cream, 'wsofa_back')
  back.position.set(0, 0.62, -0.22)
  g.add(back)
  for (const sx of [-1, 1]) {
    const leg = box(0.06, 0.16, 0.5, mats.woodDark, 'wsofa_leg')
    leg.position.set(sx * 0.44, 0.08, 0)
    g.add(leg)
  }
  return g
}

/** 小茶几（矮圆几） */
function makeTeaTable(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'outdoor_tea_table'
  const top = cyl(0.32, 0.32, 0.05, mats.wood, 'tea_top', 16)
  top.position.y = 0.34
  g.add(top)
  const leg = cyl(0.045, 0.06, 0.32, mats.woodDark, 'tea_leg', 10)
  leg.position.y = 0.16
  g.add(leg)
  const foot = cyl(0.18, 0.2, 0.04, mats.woodDark, 'tea_foot', 12)
  foot.position.y = 0.02
  g.add(foot)
  return g
}

/** 花盆：陶盆 + 绿植团 + 花点 */
function makeFlowerPot(mats: MaterialLibrary, s = 1): THREE.Group {
  const g = new THREE.Group()
  g.name = 'flower_pot'
  const pot = cyl(0.16 * s, 0.12 * s, 0.22 * s, new THREE.MeshStandardMaterial({ color: 0xa5714b, roughness: 0.9 }), 'pot_body', 12)
  pot.position.y = 0.11 * s
  g.add(pot)
  const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 12, 10), new THREE.MeshStandardMaterial({ color: 0x5f7d3a, roughness: 1 }))
  foliage.scale.set(1, 0.85, 1)
  foliage.position.y = 0.34 * s
  foliage.castShadow = true
  foliage.name = 'pot_plant'
  g.add(foliage)
  for (let i = 0; i < 5; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 8, 6), new THREE.MeshStandardMaterial({ color: [0xe8e4da, 0xd98f4e, 0xc96f6f][i % 3], roughness: 0.8 }))
    const a = (i / 5) * Math.PI * 2
    fl.position.set(Math.cos(a) * 0.12 * s, 0.36 * s + (i % 2) * 0.08 * s, Math.sin(a) * 0.12 * s)
    fl.name = 'pot_flower'
    g.add(fl)
  }
  return g
}

/** 木箱（堆叠两只） */
function makeCrates(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'wooden_crates'
  const mk = (w: number, h: number, d: number, y: number, ry: number) => {
    const c = box(w, h, d, mats.wood, 'crate')
    c.position.y = y
    c.rotation.y = ry
    g.add(c)
    const band = box(w + 0.02, h * 0.12, d + 0.02, mats.woodDark, 'crate_band')
    band.position.y = y
    band.rotation.y = ry
    g.add(band)
  }
  mk(0.66, 0.4, 0.46, 0.2, 0.12)
  mk(0.5, 0.34, 0.4, 0.57, -0.2)
  return g
}

export interface OutdoorResult {
  group: THREE.Group
  interactives: Array<{ object: THREE.Object3D; info: AssetInfo }>
}

export function buildOutdoorFurniture(mats: MaterialLibrary): OutdoorResult {
  const g = new THREE.Group()
  g.name = 'outdoor'
  const interactives: OutdoorResult['interactives'] = []
  const reg = (obj: THREE.Object3D, info: AssetInfo) => interactives.push({ object: obj, info })
  const deckTop = W(1.2)

  // ---- 遮阳伞（平台上，参考位置） ----
  const umb = makeUmbrella(mats)
  umb.position.set(W(UMBRELLA.x), deckTop, W(UMBRELLA.z))
  g.add(umb)
  reg(umb, {
    id: 'outdoor_umbrella',
    name: 'UMBRELLA',
    rows: [
      { label: 'STATUS', value: 'OPEN' },
      { label: 'SHADE AREA', value: '4.5 m²' },
      { label: 'CANVAS', value: 'BEIGE' },
    ],
  })
  umb.add(LightingManager.makeContactShadow(2.2, 2.2, 0.22))

  // ---- 木桌 + 两椅（伞下） ----
  const table = makeTable(mats)
  table.position.set(W(UMBRELLA.x) + 0.15, deckTop, W(UMBRELLA.z) + 1.5)
  table.rotation.y = 0.2
  g.add(table)
  reg(table, {
    id: 'outdoor_table',
    name: 'WOOD TABLE',
    rows: [
      { label: 'STATUS', value: 'IN USE' },
      { label: 'SEATS', value: '2' },
      { label: 'ORDERS', value: 'Ice Latte ×1' },
    ],
  })
  const ch1 = makeChair(mats)
  ch1.position.set(W(UMBRELLA.x) - 0.7, deckTop, W(UMBRELLA.z) + 1.9)
  ch1.rotation.y = 2.5
  g.add(ch1)
  const ch2 = makeChair(mats)
  ch2.position.set(W(UMBRELLA.x) + 1.0, deckTop, W(UMBRELLA.z) + 1.7)
  ch2.rotation.y = -0.9
  g.add(ch2)
  // 桌上杯子
  const cup = cyl(0.045, 0.035, 0.08, mats.cream, 'table_cup', 10)
  cup.position.set(W(UMBRELLA.x) + 0.05, deckTop + 0.69, W(UMBRELLA.z) + 1.45)
  g.add(cup)

  // ---- 橙色懒人沙发（平台上靠建筑一侧） ----
  const sofa = makeBeanSofa(mats)
  sofa.position.set(W(-14), deckTop, W(18))
  sofa.rotation.y = 0.5
  g.add(sofa)
  reg(sofa, {
    id: 'outdoor_sofa',
    name: 'BEAN SOFA',
    rows: [
      { label: 'STATUS', value: 'OCCUPIED SEATS 0/2' },
      { label: 'COLOR', value: 'ORANGE' },
      { label: 'COMFORT', value: 'MAX' },
    ],
  })
  sofa.add(LightingManager.makeContactShadow(1.7, 1.4, 0.26))

  // ---- 白色小沙发 + 小茶几 ----
  const wsofa = makeWhiteSofa(mats)
  wsofa.position.set(W(-24), deckTop, W(20.5))
  wsofa.rotation.y = -0.35
  g.add(wsofa)
  const tea = makeTeaTable(mats)
  tea.position.set(W(-19.5), deckTop, W(20))
  g.add(tea)
  const teacup = cyl(0.04, 0.03, 0.07, mats.white, 'tea_cup', 10)
  teacup.position.set(W(-19.5), deckTop + 0.4, W(20))
  g.add(teacup)

  // ---- 花盆（平台两端 + 窗前/门口铺装上） ----
  for (const [x, z, s, onDeck] of [
    [W(-32), W(5), 1.1, 1], [W(-5.5), W(4), 0.9, 1],
    [W(5.6), W(4.5), 1.0, 0], [W(19.5), W(4), 1.15, 0],
  ] as const) {
    const pot = makeFlowerPot(mats, s)
    pot.position.set(x, onDeck ? deckTop : 0, z)
    g.add(pot)
  }

  // ---- 木箱（平台左角） ----
  const crates = makeCrates(mats)
  crates.position.set(W(-31), deckTop, W(20))
  crates.rotation.y = -0.3
  g.add(crates)

  // ---- 门外右侧小桌椅（SIDE_SEATING） ----
  const st = makeTable(mats, 0.85, 0.55)
  st.position.set(W(SIDE_SEATING.x), 0, W(SIDE_SEATING.z))
  st.rotation.y = -0.4
  g.add(st)
  for (const [dx, rz] of [[-0.75, 1.2], [0.75, -1.9]] as const) {
    const c = makeChair(mats)
    c.position.set(W(SIDE_SEATING.x) + dx, 0, W(SIDE_SEATING.z) + 0.2)
    c.rotation.y = rz
    g.add(c)
  }
  st.add(LightingManager.makeContactShadow(1.6, 1.3, 0.24))

  return { group: g, interactives }
}
