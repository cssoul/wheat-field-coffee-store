/**
 * 材质库 —— 贴图全部从 assets.png 切片而来（见 src/assets/textures/）。
 *
 * 每种材质不是只给一个 Color：BaseColor 贴图 + 同图 bump 造凹凸 + 独立 roughness。
 * 砖/草/木等小块贴图用镜像平铺（MirroredRepeat）隐藏接缝。
 */
import * as THREE from 'three'

import brickUrl from '../assets/textures/white_brick.png'
import strawUrl from '../assets/textures/straw.png'
import woodUrl from '../assets/textures/wood.png'
import woodDarkUrl from '../assets/textures/wood_dark.png'
import woodFloorUrl from '../assets/textures/wood_floor.png'
import clothPlainUrl from '../assets/textures/cloth_plain.png'
import clothCoffeeUrl from '../assets/textures/cloth_coffee.png'
import metalUrl from '../assets/textures/metal.png'
import glassUrl from '../assets/textures/glass.png'
import stoneUrl from '../assets/textures/stone.png'
import grassUrl from '../assets/textures/grass.png'
import soilUrl from '../assets/textures/soil.png'
import blackboardUrl from '../assets/textures/face_blackboard.png'
import coffeeSignUrl from '../assets/textures/face_coffee.png'
import flagUrl from '../assets/textures/face_flag.png'

export interface MaterialLibrary {
  whiteBrick: THREE.MeshStandardMaterial
  straw: THREE.MeshStandardMaterial
  strawEdge: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  woodDark: THREE.MeshStandardMaterial
  woodFloor: THREE.MeshStandardMaterial
  woodBase: THREE.MeshStandardMaterial
  cloth: THREE.MeshStandardMaterial
  clothCoffee: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  grassGround: THREE.MeshStandardMaterial
  soil: THREE.MeshStandardMaterial
  interiorDark: THREE.MeshStandardMaterial
  white: THREE.MeshStandardMaterial
  cream: THREE.MeshStandardMaterial
  orange: THREE.MeshStandardMaterial
  black: THREE.MeshStandardMaterial
  blackboard: THREE.MeshStandardMaterial
  coffeeSign: THREE.MeshStandardMaterial
  flag: THREE.MeshStandardMaterial
  lampGlow: THREE.MeshStandardMaterial
  /** 麦田等程序化贴图注册处 */
  registerWindTargets: MaterialLibraryWind
}

export interface MaterialLibraryWind {
  /** 给需要风摆的材质挂 onBeforeCompile（麦田草叶等） */
  targets: THREE.Material[]
  uniforms: { uTime: { value: number }; uWind: { value: number } }
}

function loadTexture(url: string, aniso: number, repeatX = 1, repeatY = 1, mirror = true): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = aniso
  return tex
}

interface MatOpts {
  repeatX?: number
  repeatY?: number
  roughness?: number
  metalness?: number
  color?: number
  bumpScale?: number
  /** 是否镜像平铺（默认 true 隐藏接缝；近似无缝的贴图可关掉） */
  mirror?: boolean
}

export function createMaterialLibrary(aniso: number): MaterialLibrary {
  const cache = new Map<string, THREE.Texture>()
  const tex = (url: string, rx = 1, ry = 1, mirror = true): THREE.Texture => {
    const key = `${url}|${rx}|${ry}|${mirror}`
    if (!cache.has(key)) cache.set(key, loadTexture(url, aniso, rx, ry, mirror))
    return cache.get(key)!
  }

  /** 贴图材质：BaseColor + bump + roughness */
  const make = (url: string, o: MatOpts = {}): THREE.MeshStandardMaterial => {
    const rx = o.repeatX ?? 1
    const ry = o.repeatY ?? 1
    const t = tex(url, rx, ry, o.mirror ?? true)
    const bump = tex(url, rx, ry, o.mirror ?? true)
    return new THREE.MeshStandardMaterial({
      map: t,
      bumpMap: bump,
      bumpScale: o.bumpScale ?? 0.35,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0.0,
      color: o.color ?? 0xffffff,
    })
  }

  /** 纯色材质（带轻微 roughness 扰动由光照负责，不再做体素色块） */
  const plain = (color: number, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness })

  const wind: MaterialLibraryWind = {
    targets: [],
    uniforms: { uTime: { value: 0 }, uWind: { value: 1 } },
  }

  const lib: MaterialLibrary = {
    // 墙面：暖白砖（参考图是奶油白，不是冷白），平铺按段尺寸
    whiteBrick: make(brickUrl, { repeatX: 3, repeatY: 3, roughness: 0.92, bumpScale: 0.4, color: 0xf5e8d3 }),
    // 麦草屋顶：普通重复低频（纹理近似无缝；镜像/高频会出条带），厚凹凸
    straw: make(strawUrl, { repeatX: 3, repeatY: 2, roughness: 0.95, bumpScale: 0.6, color: 0xefe2b8, mirror: true }),
    // 檐口散草（颜色略深，做层次）
    strawEdge: make(strawUrl, { repeatX: 1, repeatY: 1, roughness: 0.97, bumpScale: 0.7, color: 0xe8c987 }),
    wood: make(woodUrl, { repeatX: 1, repeatY: 1, roughness: 0.8, color: 0xd8b088 }),
    woodDark: make(woodDarkUrl, { repeatX: 1, repeatY: 1, roughness: 0.78, color: 0xc79c72 }),
    woodFloor: make(woodFloorUrl, { repeatX: 4, repeatY: 4, roughness: 0.85, color: 0xb4885c }),
    // 底座侧沿：近黑的深褐（参考图底沿是很深的一条）
    woodBase: make(woodUrl, { repeatX: 8, repeatY: 1, roughness: 0.7, color: 0x453022 }),
    cloth: make(clothPlainUrl, { repeatX: 2, repeatY: 1, roughness: 0.95, bumpScale: 0.2 }),
    clothCoffee: new THREE.MeshStandardMaterial({ map: tex(clothCoffeeUrl, 1, 1, false), roughness: 0.95 }),
    metal: make(metalUrl, { repeatX: 1, repeatY: 1, roughness: 0.35, metalness: 0.75 }),
    glass: new THREE.MeshStandardMaterial({
      map: tex(glassUrl, 1, 1),
      transparent: true,
      opacity: 0.4,
      roughness: 0.15,
      metalness: 0.1,
    }),
    stone: make(stoneUrl, { repeatX: 6, repeatY: 6, roughness: 0.95, bumpScale: 0.5 }),
    grassGround: make(grassUrl, { repeatX: 24, repeatY: 16, roughness: 1.0, bumpScale: 0.3 }),
    soil: make(soilUrl, { repeatX: 20, repeatY: 14, roughness: 1.0, bumpScale: 0.4, color: 0xcbb79a }),
    interiorDark: plain(0x3a3230, 0.95),
    white: plain(0xf5efe4, 0.85),
    cream: plain(0xe9dfc8, 0.9),
    orange: plain(0xe08a3c, 0.92),
    black: plain(0x2b2926, 0.7),
    blackboard: new THREE.MeshStandardMaterial({ map: tex(blackboardUrl, 1, 1, false), roughness: 0.9 }),
    coffeeSign: new THREE.MeshStandardMaterial({ map: tex(coffeeSignUrl, 1, 1, false), roughness: 0.85 }),
    flag: new THREE.MeshStandardMaterial({ map: tex(flagUrl, 1, 1, false), roughness: 0.9, side: THREE.DoubleSide }),
    lampGlow: new THREE.MeshStandardMaterial({
      color: 0xffe9b0,
      emissive: 0xffc766,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    }),
    registerWindTargets: wind,
  }
  return lib
}
