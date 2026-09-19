/**
 * Decoration —— 装饰道具（只在参考图对应位置使用，克制）：
 * 屋顶旗帜（布料波动）/ 黑板菜单（A 字架）/ COFFEE 挂牌 / 门灯 / 木凳
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import { makeClothWave } from '../three/AnimationManager'
import type { AnimationManager } from '../three/AnimationManager'
import { CAFE, VOX } from './layout'

const W = (g: number): number => g * VOX

export function buildDecoration(mats: MaterialLibrary, anim: AnimationManager): THREE.Group {
  const g = new THREE.Group()
  g.name = 'decoration'

  /* ---- 屋顶旗帜：杆 + 波动旗面（Asset Sheet 蓝底旗帜）；杆加高避免被麦穗顶埋住 ---- */
  const flagX = W(6)
  const flagY = W(CAFE.ridgeTopY) + 0.55
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.1, 8), mats.woodDark)
  pole.name = 'flag_pole'
  pole.position.set(flagX, flagY + 1.0, W(CAFE.ridgeZ))
  pole.castShadow = true
  g.add(pole)
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.52, 12, 6), mats.flag)
  flag.name = 'flag'
  flag.position.set(flagX + 0.49, flagY + 1.75, W(CAFE.ridgeZ))
  flag.castShadow = true
  g.add(flag)
  anim.add(makeClothWave(flag, { amp: 0.09, freq: 2.2, speed: 3.2 }))

  /* ---- 黑板菜单（A 字架，路径边） ---- */
  const bb = new THREE.Group()
  bb.name = 'blackboard_menu'
  const boardGeo = new THREE.BoxGeometry(0.62, 0.88, 0.04)
  const faceMat = mats.blackboard
  const sideMat = mats.woodDark
  for (const s of [-1, 1]) {
    // 前后两块斜板，外侧面贴黑板面
    const mats6: THREE.Material[] = [sideMat, sideMat, sideMat, sideMat, sideMat, sideMat]
    mats6[s > 0 ? 4 : 5] = faceMat
    const b = new THREE.Mesh(boardGeo, mats6)
    b.name = 'blackboard_face'
    b.position.set(0, 0.62, s * 0.12)
    b.rotation.x = s * 0.14
    b.castShadow = true
    bb.add(b)
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.06, 0.05), mats.woodDark)
    leg.name = 'blackboard_leg'
    leg.position.set(s * 0.27, 0.53, s * 0.17)
    leg.rotation.x = s * 0.14
    leg.castShadow = true
    bb.add(leg)
  }
  bb.position.set(W(16), W(0.5) /* paving 上 */, W(8.5))
  bb.rotation.y = -0.45
  bb.scale.setScalar(1.3)
  g.add(bb)

  /* ---- COFFEE 挂牌：墙面托架 + 吊绳 + 招牌面 ---- */
  const signX = W(19), signY = W(11.2)
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.55), mats.woodDark)
  bracket.name = 'sign_bracket'
  bracket.position.set(signX, signY, W(CAFE.z1) + 0.28)
  g.add(bracket)
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.04), [
    mats.woodDark, mats.woodDark, mats.woodDark, mats.woodDark,
    mats.coffeeSign, // +z 面贴 COFFEE
    mats.coffeeSign, // -z 面（背面同图，转过去也认得）
  ])
  board.name = 'coffee_sign'
  board.position.set(signX, signY - 0.5, W(CAFE.z1) + 0.5)
  board.castShadow = true
  g.add(board)
  for (const sx of [-0.18, 0.18]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), mats.woodDark)
    rope.name = 'sign_rope'
    rope.position.set(signX + sx, signY - 0.18, W(CAFE.z1) + 0.5)
    g.add(rope)
  }
  // 挂牌轻微摆动（绕顶部悬点）
  const pivot = new THREE.Group()
  pivot.position.set(signX, signY - 0.02, W(CAFE.z1) + 0.5)
  anim.add((t) => {
    board.rotation.x = Math.sin(t * 1.1) * 0.06
    board.rotation.z = Math.sin(t * 0.7 + 1) * 0.04
    void pivot
  })

  /* ---- 门灯（门侧壁挂黑笼灯） ---- */
  const lampX = W(17.6)
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.5, metalness: 0.4 }))
  cage.name = 'door_lantern'
  cage.position.set(lampX, W(10), W(CAFE.z1) + 0.18)
  g.add(cage)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.lampGlow)
  bulb.name = 'door_lantern_bulb'
  bulb.position.set(lampX, W(10), W(CAFE.z1) + 0.18)
  g.add(bulb)
  const topCap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 4), new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.5 }))
  topCap.position.set(lampX, W(10) + 0.15, W(CAFE.z1) + 0.18)
  g.add(topCap)

  /* ---- 白色木凳（平台边，参考图室外家具） ---- */
  const bench = new THREE.Group()
  bench.name = 'white_bench'
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.28), mats.white)
  seat.position.y = 0.36
  seat.castShadow = true
  bench.add(seat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.05), mats.white)
  back.position.set(0, 0.55, -0.12)
  back.castShadow = true
  bench.add(back)
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.24), mats.white)
    leg.position.set(sx * 0.35, 0.18, 0)
    bench.add(leg)
  }
  bench.position.set(W(-9), W(1.2), W(20.5))
  bench.rotation.y = 0.25
  g.add(bench)

  /* ---- 自行车（靠东墙，参考图右侧可见）——低模：双轮 + 三角架 + 车座车把 ---- */
  const bike = new THREE.Group()
  bike.name = 'bicycle'
  const frameMat = mats.metal.clone()
  ;(frameMat as THREE.MeshStandardMaterial).color.set(0x9fb4a8)
  for (const sx of [-0.52, 0.52]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 8, 20), mats.black)
    wheel.name = 'bike_wheel'
    wheel.position.set(sx, 0.3, 0)
    wheel.rotation.y = Math.PI / 2
    wheel.castShadow = true
    bike.add(wheel)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), mats.metal)
    hub.rotation.z = Math.PI / 2
    hub.position.set(sx, 0.3, 0)
    bike.add(hub)
  }
  // 车架斜梁
  const tube = (from: [number, number], to: [number, number]) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, Math.hypot(to[0] - from[0], to[1] - from[1]), 6), frameMat)
    t.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0)
    t.rotation.z = Math.atan2(to[1] - from[1], to[0] - from[0]) - Math.PI / 2
    t.castShadow = true
    bike.add(t)
  }
  tube([-0.52, 0.3], [-0.1, 0.72])
  tube([-0.1, 0.72], [0.34, 0.66])
  tube([0.34, 0.66], [0.52, 0.3])
  tube([-0.52, 0.3], [0.1, 0.34])
  tube([0.1, 0.34], [0.34, 0.66])
  tube([0.1, 0.34], [-0.1, 0.72])
  // 车座 + 车把
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.08), mats.black)
  saddle.position.set(-0.14, 0.78, 0)
  bike.add(saddle)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), mats.metal)
  bar.rotation.x = Math.PI / 2
  bar.position.set(0.42, 0.86, 0)
  bike.add(bar)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6), frameMat)
  stem.position.set(0.44, 0.74, 0)
  stem.rotation.z = 0.3
  bike.add(stem)
  // 靠东墙平行停放：轮距地面 = 砾石面高 0.1（+ 侧倾补偿），微倾靠墙不陷地
  bike.position.set(W(23.2), 0.13, W(-2.5))
  bike.rotation.set(0, Math.PI / 2 - 0.3, -0.04)
  bike.traverse((o) => {
    o.castShadow = true
  })
  g.add(bike)

  /* ---- 邮筒（橙红，房子前面碎石地上） ---- */
  const mailbox = new THREE.Group()
  mailbox.name = 'mailbox'
  const mpost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), mats.woodDark)
  mpost.position.y = 0.35
  mailbox.add(mpost)
  const mbody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.22), new THREE.MeshStandardMaterial({ color: 0xc4502e, roughness: 0.6 }))
  mbody.position.y = 0.95
  mbody.castShadow = true
  mailbox.add(mbody)
  const mslot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), mats.black)
  mslot.position.set(0, 1.08, 0.11)
  mailbox.add(mslot)
  mailbox.position.set(W(20), 0, W(8))
  mailbox.rotation.y = 0.15
  g.add(mailbox)

  return g
}
