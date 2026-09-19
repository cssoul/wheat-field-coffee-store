/**
 * InteriorEquipment —— 室内设备资产（透过大窗可见，全部独立 3D Asset）：
 * 咖啡机 / 磨豆机 / 水池 / 操作台 / 冰柜 / 木柜 / 杯具 / 手冲 / 收银机 / 菜单牌 / 吊灯
 * 交互资产返回列表由 InteractionManager 注册。
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import type { AssetInfo } from '../types/twin'

function box(w: number, h: number, d: number, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.castShadow = true
  m.receiveShadow = true
  m.name = name
  return m
}
function cyl(rt: number, rb: number, h: number, mat: THREE.Material, name: string, seg = 14): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.castShadow = true
  m.name = name
  return m
}

/** 咖啡机：主机 + 双把手 + 出水口 + 压力表 + 按钮 + 托盘 + 蒸汽棒 */
function makeCoffeeMachine(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'coffee_machine'
  const body = box(0.62, 0.42, 0.42, mats.metal, 'cm_body')
  body.position.y = 0.28
  g.add(body)
  const top = box(0.66, 0.07, 0.46, mats.metal, 'cm_top')
  top.position.y = 0.52
  g.add(top)
  // 出水口组头 ×2 + 把手
  for (const sx of [-0.15, 0.15]) {
    const head = cyl(0.055, 0.07, 0.09, mats.metal, 'cm_group')
    head.position.set(sx, 0.06, 0.16)
    g.add(head)
    const handle = cyl(0.02, 0.025, 0.16, mats.black, 'cm_portafilter')
    handle.rotation.x = Math.PI / 2
    handle.rotation.z = 0.5
    handle.position.set(sx + 0.1, 0.05, 0.26)
    g.add(handle)
    const cup = cyl(0.05, 0.035, 0.06, mats.cream, 'cm_cup')
    cup.position.set(sx, 0.03, 0.22)
    g.add(cup)
  }
  // 压力表
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16), mats.white)
  gauge.rotation.x = Math.PI / 2
  gauge.name = 'cm_gauge'
  gauge.position.set(0.18, 0.36, 0.22)
  g.add(gauge)
  // 按钮 + 蒸汽棒
  for (const sx of [-0.24, -0.16]) {
    const btn = box(0.05, 0.05, 0.03, mats.black, 'cm_button')
    btn.position.set(sx, 0.38, 0.215)
    g.add(btn)
  }
  const wand = cyl(0.012, 0.012, 0.22, mats.metal, 'cm_wand', 8)
  wand.rotation.z = 0.5
  wand.position.set(-0.31, 0.24, 0.2)
  g.add(wand)
  // 托盘 + 支脚
  const tray = box(0.6, 0.03, 0.4, mats.metal, 'cm_tray')
  tray.position.y = 0.015
  g.add(tray)
  return g
}

/** 磨豆机：玻璃豆仓 + 金属机身 + 接粉盒 */
function makeGrinder(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'coffee_grinder'
  const base = box(0.22, 0.3, 0.22, mats.metal, 'gr_body')
  base.position.y = 0.15
  g.add(base)
  const hopper = cyl(0.11, 0.075, 0.22, mats.glass, 'gr_hopper')
  hopper.position.y = 0.41
  g.add(hopper)
  const lid = cyl(0.115, 0.115, 0.03, mats.black, 'gr_lid')
  lid.position.y = 0.53
  g.add(lid)
  const tray = cyl(0.09, 0.07, 0.05, mats.metal, 'gr_tray')
  tray.position.set(0, 0.03, 0.14)
  g.add(tray)
  return g
}

/** 水池：台上盆 + 弯颈龙头 */
function makeSink(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'coffee_sink'
  const basin = box(0.42, 0.16, 0.34, mats.metal, 'sink_basin')
  basin.position.y = 0.08
  g.add(basin)
  const inner = box(0.34, 0.1, 0.26, new THREE.MeshStandardMaterial({ color: 0x8f9498, roughness: 0.3, metalness: 0.7 }), 'sink_inner')
  inner.position.y = 0.1
  g.add(inner)
  const pipe = cyl(0.022, 0.022, 0.34, mats.metal, 'sink_pipe', 8)
  pipe.position.set(0, 0.3, -0.13)
  g.add(pipe)
  const neck = cyl(0.02, 0.02, 0.24, mats.metal, 'sink_neck', 8)
  neck.rotation.z = Math.PI / 2
  neck.position.set(0, 0.46, -0.02)
  g.add(neck)
  const nose = cyl(0.016, 0.016, 0.1, mats.metal, 'sink_nose', 8)
  nose.position.set(0, 0.41, 0.08)
  g.add(nose)
  return g
}

/** 冰柜：奶白箱体 + 门缝 + 金属把手 */
function makeFridge(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'coffee_fridge'
  const body = box(0.62, 1.5, 0.58, mats.white, 'fr_body')
  body.position.y = 0.75
  g.add(body)
  const seam = box(0.6, 0.02, 0.02, mats.metal, 'fr_seam')
  seam.position.set(0, 1.02, 0.29)
  g.add(seam)
  const h1 = box(0.03, 0.34, 0.04, mats.metal, 'fr_handle_top')
  h1.position.set(0.22, 1.26, 0.31)
  g.add(h1)
  const h2 = box(0.03, 0.42, 0.04, mats.metal, 'fr_handle_bottom')
  h2.position.set(0.22, 0.68, 0.31)
  g.add(h2)
  return g
}

/** 木柜：开放格 + 杯子 + 罐子 */
function makeCabinet(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'coffee_cabinet'
  const H = 1.7
  const frame = box(1.05, H, 0.32, mats.wood, 'cab_frame')
  frame.position.y = H / 2
  g.add(frame)
  for (const y of [0.55, 1.1]) {
    const shelf = box(0.98, 0.04, 0.28, mats.woodDark, 'cab_shelf')
    shelf.position.y = y
    g.add(shelf)
  }
  // 格子里的杯子
  for (let i = 0; i < 6; i++) {
    const cup = cyl(0.045, 0.034, 0.08, i % 2 ? mats.cream : mats.white, 'cab_cup', 10)
    cup.position.set(-0.35 + (i % 3) * 0.3, (i < 3 ? 0.61 : 1.16), 0)
    g.add(cup)
  }
  return g
}

/** 手冲套装：滤杯 + 云朵壶 */
function makePourOver(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'pour_over'
  const dripper = cyl(0.075, 0.045, 0.11, mats.cream, 'po_dripper')
  dripper.position.y = 0.16
  g.add(dripper)
  const server = cyl(0.09, 0.06, 0.14, mats.glass, 'po_server')
  server.position.y = 0.07
  g.add(server)
  return g
}

/** 收银机 */
function makeRegister(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'cash_register'
  const body = box(0.3, 0.14, 0.24, mats.cream, 'cr_body')
  body.position.y = 0.07
  g.add(body)
  const screen = box(0.2, 0.14, 0.03, mats.black, 'cr_screen')
  screen.rotation.x = -0.35
  screen.position.set(0, 0.18, -0.06)
  g.add(screen)
  return g
}

export interface InteriorResult {
  group: THREE.Group
  interactives: Array<{ object: THREE.Object3D; info: AssetInfo }>
}

export function buildInteriorEquipment(mats: MaterialLibrary): InteriorResult {
  const g = new THREE.Group()
  g.name = 'interior'
  const interactives: InteriorResult['interactives'] = []
  const reg = (obj: THREE.Object3D, info: AssetInfo) => interactives.push({ object: obj, info })

  // ---- 操作台（沿窗内侧后退 2m，石面木柜） ----
  const CZ = -0.65 // 操作台中心 z（比窗面退进室内 2m）
  const counter = new THREE.Group()
  counter.name = 'counter'
  const cbody = box(4.6, 0.95, 0.85, mats.wood, 'counter_body')
  cbody.position.set(-0.7, 0.475, CZ)
  counter.add(cbody)
  const ctop = box(4.75, 0.07, 0.95, mats.stone.clone(), 'counter_top')
  ;(ctop.material as THREE.MeshStandardMaterial).color.set(0xe8e2d6)
  ctop.position.set(-0.7, 0.99, CZ)
  counter.add(ctop)
  g.add(counter)

  // 台面物品布置（世界坐标）
  const put = (o: THREE.Object3D, x: number, z: number, s = 1) => {
    o.position.set(x, 1.025, z)
    o.scale.setScalar(s)
    g.add(o)
  }
  const cm = makeCoffeeMachine(mats)
  put(cm, -2.6, CZ + 0.05, 1.15)
  reg(cm, {
    id: 'coffee_machine',
    name: 'COFFEE MACHINE',
    rows: [
      { label: 'STATUS', value: 'RUNNING' },
      { label: 'TEMPERATURE', value: '92°C' },
      { label: 'PRESSURE', value: '9 BAR' },
      { label: 'TODAY COFFEE', value: '128 cups' },
    ],
  })

  const grinder = makeGrinder(mats)
  put(grinder, -1.75, CZ, 1.1)
  reg(grinder, {
    id: 'coffee_grinder',
    name: 'COFFEE GRINDER',
    rows: [
      { label: 'STATUS', value: 'STANDBY' },
      { label: 'BEANS', value: 'YIRGACHEFFE' },
      { label: 'GRIND', value: 'ESPRESSO / 0.7s' },
    ],
  })

  const po = makePourOver(mats)
  put(po, -1.25, CZ + 0.05, 1)
  g.children[g.children.length - 1]

  const sink = makeSink(mats)
  put(sink, 0.6, CZ + 0.1, 1)
  reg(sink, {
    id: 'coffee_sink',
    name: 'SINK',
    rows: [
      { label: 'STATUS', value: 'ACTIVE' },
      { label: 'WATER TEMP', value: '18°C' },
      { label: 'TANK', value: '86%' },
    ],
  })

  const regMachine = makeRegister(mats)
  put(regMachine, 1.5, CZ + 0.05, 1)

  // 台面咖啡豆罐 ×2
  for (const [i, x] of [-2.1, -1.95].entries()) {
    const jar = cyl(0.06, 0.06, 0.16, i === 0 ? mats.glass : mats.metal, 'bean_jar', 10)
    jar.position.set(x, 1.1, CZ + 0.3)
    g.add(jar)
  }
  // 台面杯子一排
  for (let i = 0; i < 4; i++) {
    const cup = cyl(0.042, 0.032, 0.075, i % 2 ? mats.cream : mats.white, 'counter_cup', 10)
    cup.position.set(-0.5 + i * 0.14, 1.06, CZ + 0.32)
    g.add(cup)
  }

  // ---- 冰柜（右后角） ----
  const fridge = makeFridge(mats)
  fridge.position.set(3.6, 0, -1.6)
  fridge.rotation.y = -Math.PI / 2
  g.add(fridge)
  reg(fridge, {
    id: 'coffee_fridge',
    name: 'FRIDGE',
    rows: [
      { label: 'STATUS', value: 'COOLING' },
      { label: 'TEMPERATURE', value: '4°C' },
      { label: 'DOOR', value: 'CLOSED' },
    ],
  })

  // ---- 木柜（左后墙） ----
  const cabinet = makeCabinet(mats)
  cabinet.position.set(-3.4, 0, -1.7)
  cabinet.rotation.y = Math.PI / 2
  g.add(cabinet)
  reg(cabinet, {
    id: 'coffee_cabinet',
    name: 'CABINET',
    rows: [
      { label: 'STATUS', value: 'OK' },
      { label: 'CUPS', value: '24 / 24' },
      { label: 'BEANS', value: '3 bags' },
    ],
  })

  // ---- 菜单牌（后墙黑板） ----
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), mats.blackboard)
  menu.name = 'menu_board'
  menu.position.set(-1.4, 2.35, -2.4)
  menu.rotation.y = 0
  g.add(menu)

  // ---- 吊灯 ×2（细杆 + 灯罩 + 暖光球；墙加高 1m 后吊杆接住天花板） ----
  for (const x of [-2.4, 0.4]) {
    const cord = cyl(0.008, 0.008, 2.1, mats.black, 'lamp_cord', 6)
    cord.position.set(x, 3.55, CZ + 0.25)
    g.add(cord)
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 12, 1, true), mats.metal)
    shade.name = 'lamp_shade'
    shade.position.set(x, 2.5, CZ + 0.25)
    g.add(shade)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.lampGlow)
    bulb.name = 'lamp_bulb'
    bulb.position.set(x, 2.44, CZ + 0.25)
    g.add(bulb)
  }

  return { group: g, interactives }
}
