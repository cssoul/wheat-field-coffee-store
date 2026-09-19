/**
 * Electricity —— 电力系统：木电线杆 + 横担 + 绝缘子 + 自然下垂的黑色电缆。
 * 电线用 CatmullRomCurve3 + TubeGeometry，与建筑形成空间关系（一根搭到屋檐）。
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import { CAFE, POLE, VOX } from './layout'

const W = (g: number): number => g * VOX

export function buildElectricity(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'electricity'

  const px = W(POLE.x), pz = W(POLE.z), ph = W(POLE.h)

  // ---- 电线杆（锥度木杆 + 顶帽） ----
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, ph, 10), mats.woodDark)
  pole.name = 'electric_pole'
  pole.position.set(px, ph / 2, pz)
  pole.castShadow = true
  g.add(pole)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), mats.woodDark)
  cap.position.set(px, ph + 0.03, pz)
  g.add(cap)

  // ---- 横担两层 + 白色绝缘子 ----
  const cross = (y: number, len: number, rotY: number) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), mats.woodDark)
    arm.name = 'cross_arm'
    arm.position.set(px, y, pz)
    arm.rotation.y = rotY
    arm.castShadow = true
    g.add(arm)
    for (const s of [-1, 0, 1]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.09, 8), mats.white)
      ins.name = 'insulator'
      const off = s * (len / 2 - 0.15)
      ins.position.set(px + Math.cos(rotY) * off, y + 0.08, pz - Math.sin(rotY) * off)
      g.add(ins)
    }
  }
  cross(ph - 0.15, 1.7, 0)          // 顺电线方向
  cross(ph - 0.75, 1.2, Math.PI / 2) // 横向

  // ---- 电缆：自然下垂弧线 ----
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x232120, roughness: 0.6 })
  const mkWire = (points: THREE.Vector3[], name: string) => {
    const curve = new THREE.CatmullRomCurve3(points)
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.018, 6), wireMat)
    tube.name = name
    g.add(tube)
  }
  const sag = (a: THREE.Vector3, b: THREE.Vector3, k = 0.55): THREE.Vector3 =>
    new THREE.Vector3((a.x + b.x) / 2, Math.min(a.y, b.y) - a.distanceTo(b) * 0.14 * k, (a.z + b.z) / 2)

  const topA = new THREE.Vector3(px - 0.7, ph - 0.1, pz)
  const topB = new THREE.Vector3(px + 0.7, ph - 0.1, pz)
  // 1) 沿 x 正向出画面（右边远去）
  mkWire([topA, sag(topA, new THREE.Vector3(px + 8, ph - 0.4, pz + 0.5)), new THREE.Vector3(px + 8, ph - 0.5, pz + 0.5)], 'electric_wire_1')
  // 2) 沿 x 负向搭到屋檐（与建筑形成空间关系）
  const eave = new THREE.Vector3(W(CAFE.x1) - 0.4, W(CAFE.eaveTopY) + 0.5, W(CAFE.ridgeZ))
  mkWire([topB, sag(topB, eave), eave], 'electric_wire_2')
  // 3) 第二层横担向后
  const back = new THREE.Vector3(px - 0.5, ph - 0.8, pz - 0.9)
  const far = new THREE.Vector3(px - 3.2, ph - 1.5, pz - 2.4)
  mkWire([back, sag(back, far), far], 'electric_wire_3')

  // 杆上小变压器（参考图杆身挂一个灰盒）
  const trans = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.24), new THREE.MeshStandardMaterial({ color: 0x8b8d8a, roughness: 0.5, metalness: 0.3 }))
  trans.name = 'transformer'
  trans.position.set(px + 0.25, ph - 1.5, pz)
  trans.castShadow = true
  g.add(trans)

  return g
}
