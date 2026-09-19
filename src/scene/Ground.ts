/**
 * Ground —— 矩形微缩底座 + 木平台 + 石子铺装。
 * 底座侧沿是深色木（"模型底板"），顶面是土壤。
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import { BASE, DECK, GRAVEL_PATCH, PAVING, VOX } from './layout'

const W = (g: number): number => g * VOX

export function buildGround(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group()
  g.name = 'ground'

  const bw = W(BASE.x1 - BASE.x0)
  const bd = W(BASE.z1 - BASE.z0)
  const cx = W(BASE.x0 + BASE.x1) / 2
  const cz = W(BASE.z0 + BASE.z1) / 2

  // ---- 底座箱体：顶面土壤 / 侧面深木 ----
  const soilTop = mats.soil.clone()
  soilTop.map = mats.soil.map!.clone()
  soilTop.map.repeat.set(14, 9)
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(bw, W(BASE.thick), bd),
    [mats.woodBase, mats.woodBase, soilTop, mats.woodBase, mats.woodBase, mats.woodBase],
  )
  base.name = 'base'
  base.position.set(cx, -W(BASE.thick) / 2, cz)
  base.receiveShadow = true
  g.add(base)

  // ---- 木平台（左前方，橙沙发区） ----
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(W(DECK.x1 - DECK.x0), W(DECK.y), W(DECK.z1 - DECK.z0)),
    [mats.wood, mats.wood, mats.woodFloor, mats.wood, mats.wood, mats.wood],
  )
  deck.name = 'deck'
  deck.position.set(
    W(DECK.x0 + DECK.x1) / 2,
    W(DECK.y) / 2,
    W(DECK.z0 + DECK.z1) / 2,
  )
  deck.castShadow = true
  deck.receiveShadow = true
  g.add(deck)

  // 平台台阶
  const step = new THREE.Mesh(new THREE.BoxGeometry(W(6), W(0.6), W(2.4)), mats.wood)
  step.name = 'deck_step'
  step.position.set(W(DECK.x1) - W(3), W(0.3), W(DECK.z0 + 4.5))
  step.castShadow = true
  step.receiveShadow = true
  g.add(step)

  // ---- 窗下/门前碎石铺装（浅灰砾石，参考图屋前一圈浅色碎石） ----
  const pavingMat = mats.stone.clone()
  pavingMat.map = mats.stone.map!.clone()
  pavingMat.map.repeat.set(8, 3)
  pavingMat.color.set(0xece7dd)
  const paving = new THREE.Mesh(
    new THREE.BoxGeometry(W(PAVING.x1 - PAVING.x0), W(PAVING.y), W(PAVING.z1 - PAVING.z0)),
    [mats.wood, mats.wood, pavingMat, mats.wood, mats.wood, mats.wood],
  )
  paving.name = 'paving'
  paving.position.set(
    W(PAVING.x0 + PAVING.x1) / 2,
    W(PAVING.y) / 2,
    W(PAVING.z0 + PAVING.z1) / 2,
  )
  paving.receiveShadow = true
  g.add(paving)

  // ---- 屋子右侧碎石空地（浅砾石，不长麦；自行车/桌椅区） ----
  const gravelMat = mats.soil.clone()
  gravelMat.map = mats.soil.map!.clone()
  gravelMat.map.wrapS = gravelMat.map.wrapT = THREE.RepeatWrapping
  gravelMat.map.repeat.set(5, 4)
  gravelMat.color.set(0xeadcbd)
  gravelMat.bumpScale = 0.2
  const gravel = new THREE.Mesh(
    new THREE.BoxGeometry(W(GRAVEL_PATCH.x1 - GRAVEL_PATCH.x0), W(0.4), W(GRAVEL_PATCH.z1 - GRAVEL_PATCH.z0)),
    [mats.wood, mats.wood, gravelMat, mats.wood, mats.wood, mats.wood],
  )
  gravel.name = 'gravel_patch'
  gravel.position.set(
    W(GRAVEL_PATCH.x0 + GRAVEL_PATCH.x1) / 2,
    W(0.2),
    W(GRAVEL_PATCH.z0 + GRAVEL_PATCH.z1) / 2,
  )
  gravel.receiveShadow = true
  g.add(gravel)

  return g
}
