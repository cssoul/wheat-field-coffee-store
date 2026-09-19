/**
 * WheatField —— 麦田系统（场景的环境主体）。
 *
 * 全部用 InstancedMesh：成熟麦 / 青苗 / 草丛 / 野花 各一个 draw call。
 * 每株是两片交叉面片 + canvas 画的 alpha 麦穗贴图（无外部图片），
 * 风摆走顶点着色器（见 AnimationManager.registerWindMaterial）。
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import type { MaterialLibrary } from '../materials/MaterialLibrary'
import { AnimationManager } from '../three/AnimationManager'
import {
  BASE, CAFE, DECK, GRAVEL_PATCH, PAVING, POLE, SEEDLING_ZONE,
  SIDE_SEATING, UMBRELLA, VOX,
} from './layout'

/** 确定性随机（mulberry32） */
function rng32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type PlantKind = 'mature' | 'seedling' | 'grass' | 'flower'

interface KindStyle {
  height: number
  width: number
  stalks: number
  colors: string[]
  ear: boolean
  flowerColors?: string[]
}

const STYLES: Record<PlantKind, KindStyle> = {
  // 成熟麦：金黄麦穗 + 芒（参考图麦高约为墙高 1/4）
  mature: {
    height: 0.8, width: 0.72, stalks: 6,
    colors: ['#c9a04e', '#d9b45c', '#e3c473', '#caa04a', '#ecd492'],
    ear: true,
  },
  // 青苗：偏绿、矮、无穗
  seedling: {
    height: 0.55, width: 0.7, stalks: 7,
    colors: ['#8ea24e', '#9db25b', '#7d9343', '#aac06a'],
    ear: false,
  },
  // 草丛：绿色团状
  grass: {
    height: 0.38, width: 0.7, stalks: 9,
    colors: ['#7d9343', '#8fa64f', '#6d8339', '#a0b45e'],
    ear: false,
  },
  // 野花：细茎 + 彩点
  flower: {
    height: 0.5, width: 0.6, stalks: 5,
    colors: ['#8ea24e', '#9db25b'],
    ear: false,
    flowerColors: ['#e8e4da', '#d98f4e', '#c96f6f', '#e3c473'],
  },
}

/** canvas 画一株植物的 alpha 贴图（屋顶麦穗层复用） */
export function makePlantTexture(kind: PlantKind, seed: number): THREE.CanvasTexture {
  const s = STYLES[kind]
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 256
  const g = cv.getContext('2d')!
  const rng = rng32(seed)
  const cx = 64

  // 茎：从底部扇形散开
  for (let i = 0; i < s.stalks; i++) {
    const t = s.stalks === 1 ? 0.5 : i / (s.stalks - 1)
    const spread = (t - 0.5) * 1.15
    const topX = cx + spread * 70 + (rng() - 0.5) * 14
    const topY = 30 + rng() * 26
    const col = s.colors[Math.floor(rng() * s.colors.length)]
    g.strokeStyle = col
    g.lineWidth = 3.2 + rng() * 1.6
    g.beginPath()
    g.moveTo(cx + (rng() - 0.5) * 12, 250)
    g.quadraticCurveTo(cx + spread * 20, 150 + rng() * 30, topX, topY)
    g.stroke()

    if (s.ear) {
      // 麦穗：茎顶一串麦粒 + 芒（颗粒小而密）
      const earLen = 26 + rng() * 12
      for (let k = 0; k < 9; k++) {
        const gt = k / 9
        const gx = topX + Math.sin(gt * 5 + i) * 3.5
        const gy = topY + gt * earLen
        const grain = 4.2 + rng() * 2
        g.fillStyle = s.colors[Math.floor(rng() * s.colors.length)]
        g.beginPath()
        g.ellipse(gx, gy, grain * 0.62, grain, (t - 0.5) * 0.9, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = 'rgba(120,84,30,0.55)'
        g.lineWidth = 0.8
        g.stroke()
      }
      // 芒（细长须）
      g.strokeStyle = 'rgba(226,196,120,0.85)'
      g.lineWidth = 1
      for (let a = 0; a < 5; a++) {
        g.beginPath()
        g.moveTo(topX + (rng() - 0.5) * 10, topY + earLen * 0.6)
        g.lineTo(topX + (rng() - 0.5) * 26, topY - 14 - rng() * 18)
        g.stroke()
      }
    }
    if (s.flowerColors) {
      // 野花：茎顶彩点
      for (let f = 0; f < 3; f++) {
        g.fillStyle = s.flowerColors[Math.floor(rng() * s.flowerColors.length)]
        g.beginPath()
        g.arc(topX + (rng() - 0.5) * 18, topY + (rng() - 0.5) * 14, 4.5 + rng() * 2.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** 两片交叉面片，底部对齐 y=0，高度 1（实例缩放定高；屋顶麦穗层复用） */
export function makeCrossGeometry(): THREE.BufferGeometry {
  const p1 = new THREE.PlaneGeometry(1, 1)
  p1.translate(0, 0.5, 0)
  const p2 = p1.clone()
  p2.rotateY(Math.PI / 2)
  return mergeGeometries([p1, p2])!
}

interface Instance {
  x: number
  z: number
  kind: PlantKind
  scale: number
  rotY: number
  tint: THREE.Color
}

/** 某网格点是否被建筑/平台等占用 */
function blocked(x: number, z: number): boolean {
  // 建筑外扩：左右 2 格、前方 5 格（屋前留一圈碎石地，麦子贴边长）
  if (x > CAFE.x0 - 2 && x < CAFE.x1 + 2 && z > CAFE.z0 - 2 && z < CAFE.z1 + 5) return true
  if (x > DECK.x0 - 1 && x < DECK.x1 + 1 && z > DECK.z0 - 1 && z < DECK.z1 + 1) return true
  if (x > PAVING.x0 - 1 && x < PAVING.x1 + 1 && z > PAVING.z0 - 1 && z < PAVING.z1 + 1) return true
  if (x > GRAVEL_PATCH.x0 - 1 && x < GRAVEL_PATCH.x1 + 1 && z > GRAVEL_PATCH.z0 - 1 && z < GRAVEL_PATCH.z1 + 1) return true
  if (Math.hypot(x - POLE.x, z - POLE.z) < 3.5) return true
  if (Math.hypot(x - SIDE_SEATING.x, z - SIDE_SEATING.z) < 6) return true
  if (Math.hypot(x - UMBRELLA.x, z - UMBRELLA.z) < 6.5) return true
  return false
}

export interface WheatFieldResult {
  group: THREE.Group
  count: number
}

export function buildWheatField(mats: MaterialLibrary, anim: AnimationManager): WheatFieldResult {
  const rng = rng32(20260919)
  const group = new THREE.Group()
  group.name = 'wheat_field'

  // ---- 采样所有实例 ----
  const instances: Instance[] = []
  const SPACING = 0.55
  for (let x = BASE.x0 + 1; x < BASE.x1 - 1; x += SPACING) {
    for (let z = BASE.z0 + 1; z < BASE.z1 - 1; z += SPACING) {
      const jx = x + (rng() - 0.5) * SPACING * 0.9
      const jz = z + (rng() - 0.5) * SPACING * 0.9
      if (blocked(jx, jz)) continue
      // 青苗区：边缘用噪声羽化，避免出现笔直的"补丁边"
      const edge = Math.min(
        jx - SEEDLING_ZONE.x0, SEEDLING_ZONE.x1 - jx,
        jz - SEEDLING_ZONE.z0, SEEDLING_ZONE.z1 - jz,
      )
      const inSeedling = edge > 0 && edge / 6 + (rng() - 0.5) * 0.7 > 0.25
      const r = rng()
      if (inSeedling) {
        // 青苗区：青苗为主，混少量草丛
        instances.push(mk(jx, jz, r < 0.82 ? 'seedling' : 'grass', rng))
      } else {
        // 成熟麦为主，混 4% 草丛 + 0.8% 野花
        if (r < 0.04) instances.push(mk(jx, jz, 'grass', rng))
        else if (r < 0.048) instances.push(mk(jx, jz, 'flower', rng))
        else instances.push(mk(jx, jz, 'mature', rng))
      }
    }
  }
  function mk(x: number, z: number, kind: PlantKind, r: () => number): Instance {
    const s = STYLES[kind]
    const h = s.height * (0.85 + r() * 0.3)
    // 颜色扰动：明度 ±8%
    const base = new THREE.Color(0xffffff)
    const l = 0.92 + r() * 0.16
    base.setRGB(l, l * (0.98 + r() * 0.04), l * (0.95 + r() * 0.08))
    return { x, z, kind, scale: h, rotY: r() * Math.PI * 2, tint: base }
  }

  // ---- 按 kind 分桶，各建一个 InstancedMesh ----
  const geo = makeCrossGeometry()
  let total = 0
  const kinds: PlantKind[] = ['mature', 'seedling', 'grass', 'flower']
  for (const kind of kinds) {
    const list = instances.filter((i) => i.kind === kind)
    if (list.length === 0) continue
    const mat = new THREE.MeshStandardMaterial({
      map: makePlantTexture(kind, 7 + kind.length),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0,
    })
    anim.registerWindMaterial(mat)
    const mesh = new THREE.InstancedMesh(geo, mat, list.length)
    mesh.name = `wheat_${kind}`
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    list.forEach((inst, i) => {
      q.setFromAxisAngle(up, inst.rotY)
      const sc = new THREE.Vector3(STYLES[kind].width * inst.scale, inst.scale, STYLES[kind].width * inst.scale)
      m.compose(new THREE.Vector3(inst.x * VOX, 0, inst.z * VOX), q, sc)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, inst.tint)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.instanceMatrix.needsUpdate = true
    group.add(mesh)
    total += list.length
  }
  void mats
  return { group, count: total }
}
