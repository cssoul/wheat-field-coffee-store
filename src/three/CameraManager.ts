/**
 * CameraManager —— 相机 + 轨道控制 + 视角预设。
 *
 * reference 预设按 assets.png 左上角构图反解（沿用参考图实测三条硬约束）：
 *   1. 地平线在画面高度 34% → 俯角 ≈ 5.3°
 *   2. 屋脊贴地平线 → 眼高 ≈ 屋脊高 × 0.93
 *   3. 屋檐跨度占画面宽 50% → 反解距离
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { BASE, CAFE, VOX } from '../scene/layout'
import type { ViewPreset } from '../types/twin'

interface PresetDef {
  target: [number, number, number]
  az: number
  el: number
  dist: number
  fov: number
}

export const PRESETS: Record<Exclude<ViewPreset, 'reference'>, PresetDef> & { reference: PresetDef } = {
  // reference 按 assets.png 左上角场景反解：约 20° 俯视、微偏左、建筑占宽 ~55%
  reference: { target: [0, 2.0, 2.2], az: -0.15, el: 0.36, dist: 17, fov: 38 },
  overview: { target: [0, 0.8, 0], az: -0.48, el: 0.72, dist: 34, fov: 40 },
  door: { target: [4, 2.2, 5], az: -0.06, el: 0.1, dist: 9, fov: 40 },
  window: { target: [-2, 3.4, 4], az: -0.3, el: 0.08, dist: 8, fov: 42 },
}

export class CameraManager {
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  current: ViewPreset = 'reference'
  /** 用户手动转过相机后，reference 不再自动重新取景 */
  userTouched = false

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(PRESETS.reference.fov, dom.clientWidth / Math.max(1, dom.clientHeight), 0.1, 800)
    this.controls = new OrbitControls(this.camera, dom)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI * 0.52
    this.controls.minDistance = 4
    this.controls.maxDistance = 60
    this.controls.addEventListener('start', () => {
      this.userTouched = true
    })
  }

  /** 按 assets.png 左上角构图取景：~20° 俯视；宽高两轴都适配（取更远者） */
  fitReference(): void {
    const cam = this.camera
    const p = PRESETS.reference
    const fovV = THREE.MathUtils.degToRad(p.fov)
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * cam.aspect)

    const roofW = (CAFE.roofX1 - CAFE.roofX0) * VOX
    const distW = roofW / 0.55 / (2 * Math.tan(fovH / 2))
    // 纵向：地面深度在竖屏方向投影 ≈ depth·sin(el)，建筑高 ≈ H·cos(el)，留 12% 边距
    const depth = (BASE.z1 - BASE.z0) * VOX
    const spanV = depth * Math.sin(p.el) + CAFE.ridgeTopY * VOX * Math.cos(p.el)
    const distV = spanV / 0.68 / (2 * Math.tan(fovV / 2))
    const dist = THREE.MathUtils.clamp(Math.max(distW, distV), 8, 44)

    const target = new THREE.Vector3(0, 1.4, 1.0)
    const ce = Math.cos(p.el)
    cam.fov = p.fov
    cam.updateProjectionMatrix()
    cam.position.set(
      target.x + Math.sin(p.az) * ce * dist,
      target.y + Math.sin(p.el) * dist,
      target.z + Math.cos(p.az) * ce * dist,
    )
    this.controls.target.copy(target)
    this.controls.update()
  }

  applyPreset(name: Exclude<ViewPreset, 'reference'>): void {
    const p = PRESETS[name]
    this.current = name
    const cam = this.camera
    cam.fov = p.fov
    cam.updateProjectionMatrix()
    const target = new THREE.Vector3(...p.target)
    const ce = Math.cos(p.el)
    cam.position.set(
      target.x + Math.sin(p.az) * ce * p.dist,
      target.y + Math.sin(p.el) * p.dist,
      target.z + Math.cos(p.az) * ce * p.dist,
    )
    this.controls.target.copy(target)
    this.controls.update()
  }

  set(name: ViewPreset): void {
    if (name === 'reference') {
      this.current = 'reference'
      this.fitReference()
      return
    }
    this.applyPreset(name)
  }

  update(): void {
    this.controls.update()
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
}
