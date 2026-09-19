/**
 * SceneManager —— 渲染器 / 场景 / 主循环 / 帧统计。
 * 背景是摄影棚式浅色渐变球（对应 Asset Sheet 的白色摄影棚背景）。
 */
import * as THREE from 'three'

import { createMaterialLibrary, type MaterialLibrary } from '../materials/MaterialLibrary'

export interface FrameStats {
  fps: number
  drawCalls: number
  triangles: number
}

export type Updatable = (elapsed: number, delta: number) => void

export class SceneManager {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer
  readonly mats: MaterialLibrary
  private clock = new THREE.Clock()
  private updatables: Updatable[] = []
  private frames = 0
  private fpsTime = 0
  onFrame?: (s: FrameStats) => void

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.mats = createMaterialLibrary(this.renderer.capabilities.getMaxAnisotropy())
    this.scene.add(this.makeBackdrop())
  }

  /** 摄影棚渐变背景球：上浅灰白 → 下暖灰，模拟"模型放在摄影棚里" */
  private makeBackdrop(): THREE.Mesh {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0.0, '#e9edf0')
    grad.addColorStop(0.45, '#f1efea')
    grad.addColorStop(0.62, '#eae6df')
    grad.addColorStop(1.0, '#cfcbc4')
    g.fillStyle = grad
    g.fillRect(0, 0, 16, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }),
    )
    mesh.name = 'studio_backdrop'
    return mesh
  }

  add(upd: Updatable): void {
    this.updatables.push(upd)
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick())
  }

  stop(): void {
    this.renderer.setAnimationLoop(null)
  }

  private tick(): void {
    const delta = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime
    for (const u of this.updatables) u(t, delta)

    // FPS 统计（每 0.5s 刷新一次）
    this.frames++
    this.fpsTime += delta
    if (this.fpsTime >= 0.5) {
      const info = this.renderer.info.render
      this.onFrame?.({
        fps: Math.round(this.frames / this.fpsTime),
        drawCalls: info.calls,
        triangles: info.triangles,
      })
      this.frames = 0
      this.fpsTime = 0
    }
    this.renderer.render(this.scene, this.camera)
  }

  /** 相机由 CameraManager 注入，渲染前必须先赋值 */
  camera!: THREE.PerspectiveCamera

  resize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.stop()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
