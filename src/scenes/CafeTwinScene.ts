import * as THREE from 'three'
import { buildCafeBuilding } from '../models/CafeBuilding'
import { buildDioramaBase } from '../models/DioramaBase'
import { buildElectricSystem } from '../models/ElectricSystem'
import { buildInteriorEquipment } from '../models/InteriorEquipment'
import { buildOutdoorFurniture } from '../models/OutdoorFurniture'
import { buildParticles, type Particles } from '../models/Particles'
import { VoxelBatch, type BuildCtx } from '../models/voxel'
import { buildWheatField } from '../models/WheatField'
import { WIND, tickWind } from '../shaders/wind'
import { Occupancy } from '../utils/occupancy'
import { CAFE, VOX } from '../utils/layout'
import { createCameraRig, PRESETS, type CameraRig, type ViewPreset } from '../systems/CameraRig'
import { setupLighting, type LightingRig } from '../systems/Lighting'

/**
 * ============================================================================
 *  CafeTwinScene —— 主场景
 * ============================================================================
 *
 * 组装顺序刻意和真搭一个微缩模型一致：
 *   铺底座 → 立房子 → 摆户外家具 → 架电线 → 室内陈设 → 最后种麦子
 *
 * 麦子必须最后种，因为它靠占地登记表避开所有已经放好的东西。
 */

export interface SceneStats {
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  voxels: number
  plants: number
  tufts: number
  flowers: number
  clouds: number
  wind: number
  /* ---- 数字孪生遥测（缓慢自然浮动，模拟真实采数） ---- */
  /** 内部计时器，HUD 用它推导温度读数的相位 */
  temperature: number
  /** 店内顾客数 */
  customers: number
  /** 设备状态 */
  machine: string
  grinder: string
  fridge: string
}

export class CafeTwinScene {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer
  readonly rig: CameraRig

  private container: HTMLElement
  private lighting: LightingRig
  private particles: Particles
  private clock = new THREE.Clock()
  private raf = 0
  private disposed = false
  private paused = false
  private userTouched = false

  private modelRoot = new THREE.Group()
  private stats: SceneStats
  private fpsAccum = 0
  private fpsFrames = 0
  private statsTimer = 0

  /** 每 0.4 秒回调一次，供 HUD 刷新 */
  onStats: ((s: SceneStats) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)

    /* ---------------- 渲染器 ---------------- */
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NeutralToneMapping
    // Neutral 比 ACES 更能保住暖黄与白的层次：屋顶金黄、墙面暖白不会被冲成一片白
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    /* ---------------- 场景 ---------------- */
    this.scene = new THREE.Scene()
    this.scene.add(this.modelRoot)

    /* ---------------- 光照 ---------------- */
    this.lighting = setupLighting(this.scene, this.renderer)

    /* ---------------- 相机 ---------------- */
    this.rig = createCameraRig(this.renderer.domElement, width / height)
    this.rig.controls.addEventListener('start', () => {
      this.userTouched = true
    })

    /* ---------------- 建模 ---------------- */
    const occ = new Occupancy()
    const batch = new VoxelBatch(20260918)
    const props = new THREE.Group()
    props.name = 'non-voxel-props'
    const ctx: BuildCtx = { b: batch, occ, group: props }

    buildDioramaBase(ctx)
    buildCafeBuilding(ctx)
    buildInteriorEquipment(ctx)
    buildOutdoorFurniture(ctx)
    buildElectricSystem(ctx)

    const voxelGroup = batch.build('voxel-model')
    this.modelRoot.add(voxelGroup)
    this.modelRoot.add(props)

    const wheat = buildWheatField(ctx)
    this.modelRoot.add(wheat.group)

    this.particles = buildParticles({ b: { rnd: () => batch.rnd() } })
    this.modelRoot.add(this.particles.group)

    /* ---------------- 统计 ---------------- */
    const bs = batch.stats()
    this.stats = {
      fps: 0,
      frameMs: 0,
      drawCalls: 0,
      triangles: 0,
      voxels: bs.voxels,
      plants: wheat.plants,
      tufts: wheat.tufts,
      flowers: wheat.flowers,
      clouds: this.particles.clouds,
      wind: WIND.strength.value,
      temperature: 0,
      customers: 6,
      machine: 'ACTIVE',
      grinder: 'READY',
      fridge: '4°C',
    }

    // 调试句柄：本机读图不总是可靠，留一个运行时状态入口供自动校验读取
    ;(window as unknown as Record<string, unknown>).__cafe = this

    this.resize()
    this.fitReference()
  }

  /* ------------------------------------------------------------------ */
  /* 尺寸与取景                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * 按参考图的构图反解相机。
   *
   * 从参考图量出来的三条硬约束：
   *   1. 地平线落在画面高度的 34%（把俯角定死在 5° 上下）
   *   2. 屋脊几乎压在地平线上 → 相机眼高 ≈ 屋脊高
   *   3. 屋檐总跨度（含两侧出檐）约占画面宽度的 55%
   *
   * 眼高随视口比例反解出来，保证"模型变小"时视角关系仍然成立，
   * 而不是硬编码一个距离。
   */
  private fitReference(): void {
    const cam = this.rig.camera
    const p = PRESETS.reference
    const fovV = THREE.MathUtils.degToRad(cam.fov)
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * cam.aspect)

    // ③ 屋檐跨度占画面宽度的 50% → 反解出相机到建筑的距离
    //    （参考图是 56%，但参考图左右还各有几十米真实麦田；
    //     我们只有一块 30 单位的沙盘，留出的余量就是这块麦田）
    const roofW = (CAFE.roofX1 - CAFE.roofX0) * VOX
    const dist = THREE.MathUtils.clamp(roofW / 0.5 / (2 * Math.tan(fovH / 2)), 8, 44)

    // ② 眼高略低于屋脊：让屋脊正好落在地平线上方一点点，和参考图一致
    const eyeY = CAFE.ridgeTopY * VOX * 0.93

    // ① 俯角由预设给定，target 的高度由"相机必须落在 eyeY"倒推
    const target = new THREE.Vector3(
      (CAFE.x0 + CAFE.x1) * 0.5 * VOX,
      eyeY - Math.sin(p.el) * dist,
      CAFE.z1 * VOX - 1.0,
    )
    const ce = Math.cos(p.el)
    cam.position.set(
      target.x + Math.sin(p.az) * ce * dist,
      target.y + Math.sin(p.el) * dist,
      target.z + Math.cos(p.az) * ce * dist,
    )
    this.rig.controls.target.copy(target)
    this.rig.controls.update()
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(w, h, false)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.rig.onResize(w, h)
    // 用户还没动过相机时，重新按新比例取景
    if (!this.userTouched && this.rig.current === 'reference') this.fitReference()
  }

  /* ------------------------------------------------------------------ */
  /* 对外控制                                                            */
  /* ------------------------------------------------------------------ */

  setWind(strength: number): void {
    WIND.strength.value = strength
    this.stats.wind = strength
  }

  setPreset(name: ViewPreset): void {
    if (name === 'reference') {
      this.userTouched = false
      this.rig.current = 'reference'
      const cam = this.rig.camera
      cam.fov = PRESETS.reference.fov
      cam.updateProjectionMatrix()
      this.fitReference()
      return
    }
    this.userTouched = true
    this.rig.applyPreset(name, true)
  }

  setShadows(on: boolean): void {
    this.renderer.shadowMap.enabled = on
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        const mat = m.material as THREE.Material | THREE.Material[]
        if (Array.isArray(mat)) mat.forEach((x) => (x.needsUpdate = true))
        else if (mat) mat.needsUpdate = true
      }
    })
  }

  setPaused(p: boolean): void {
    this.paused = p
  }

  /** 切换渲染分辨率：1 = 省电，2 = 高清 */
  setPixelRatio(r: number): void {
    this.renderer.setPixelRatio(Math.min(r, window.devicePixelRatio || 1))
  }

  getStats(): SceneStats {
    return { ...this.stats }
  }

  /* ------------------------------------------------------------------ */
  /* 主循环                                                              */
  /* ------------------------------------------------------------------ */

  start(): void {
    if (this.raf) return
    this.clock.start()
    const loop = () => {
      if (this.disposed) return
      this.raf = requestAnimationFrame(loop)

      const dt = Math.min(0.05, this.clock.getDelta())

      if (!this.paused) {
        tickWind(dt)
        this.particles.update(dt)
        this.lighting.update(dt)
        // 遥测计时器：让 HUD 上的读数缓慢、自然地变化
        this.stats.temperature += dt
      }
      this.rig.update(dt)

      this.renderer.render(this.scene, this.rig.camera)

      /* ---- 统计 ---- */
      this.fpsAccum += dt
      this.fpsFrames++
      this.statsTimer += dt
      const info = this.renderer.info.render
      if (this.statsTimer >= 0.4) {
        this.stats.fps = Math.round(this.fpsFrames / this.fpsAccum)
        this.stats.frameMs = +((this.fpsAccum / this.fpsFrames) * 1000).toFixed(2)
        this.stats.drawCalls = info.calls
        this.stats.triangles = info.triangles

        // 模拟一组缓慢波动的经营读数（不是随机跳变，是平滑周期）
        const t = this.stats.temperature
        this.stats.customers = 4 + Math.round((Math.sin(t * 0.045) * 0.5 + 0.5) * 7)
        this.stats.machine = Math.sin(t * 0.11) > -0.72 ? 'ACTIVE' : 'BREWING'
        this.stats.grinder = Math.sin(t * 0.083 + 2.1) > -0.6 ? 'READY' : 'GRINDING'
        this.stats.fridge = `${(3.4 + Math.sin(t * 0.07) * 1.1).toFixed(1)}°C`

        this.fpsAccum = 0
        this.fpsFrames = 0
        this.statsTimer = 0
        this.onStats?.(this.getStats())
      }
    }
    loop()
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.rig.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh && !(o as THREE.Points).isPoints) return
      const geo = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
      geo?.dispose()
      const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
    delete (window as unknown as Record<string, unknown>).__cafe
  }
}

/** 供 HUD 显示"模型尺度"的参考值 */
export const MODEL_SCALE = { grid: VOX }
