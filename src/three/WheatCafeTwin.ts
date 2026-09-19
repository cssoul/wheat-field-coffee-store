/**
 * WheatCafeTwin —— 场景总编排：
 * 组装全部资产 → 注册交互 → 管理预设/HUD 统计/风力。
 * 对外只暴露 Vue 层需要的最小接口。
 */
import * as THREE from 'three'

import { buildCafeBuilding } from '../scene/CafeBuilding'
import { buildDecoration } from '../scene/Decoration'
import { buildElectricity } from '../scene/Electricity'
import { buildGround } from '../scene/Ground'
import { buildInteriorEquipment } from '../scene/InteriorEquipment'
import { buildOutdoorFurniture } from '../scene/OutdoorFurniture'
import { buildWheatField } from '../scene/WheatField'
import { AnimationManager } from '../three/AnimationManager'
import { CameraManager } from '../three/CameraManager'
import { InteractionManager } from '../three/InteractionManager'
import { LightingManager } from '../three/LightingManager'
import { SceneManager, type FrameStats } from '../three/SceneManager'
import type { AssetInfo, TwinStats, ViewPreset } from '../types/twin'

export class WheatCafeTwin {
  private sm: SceneManager
  private cm: CameraManager
  private anim: AnimationManager
  private im: InteractionManager

  wheatCount = 0
  onFrame?: (s: FrameStats) => void
  onSelect?: (info: AssetInfo | null) => void

  constructor(container: HTMLElement) {
    this.sm = new SceneManager(container)
    this.cm = new CameraManager(container)
    this.sm.camera = this.cm.camera
    this.anim = new AnimationManager(this.sm.mats)
    this.im = new InteractionManager(container, this.cm.camera)

    /* ---- 组装场景 ---- */
    new LightingManager(this.sm.scene) // 主光/半球/环境光（自带 scene.add）
    this.sm.scene.add(buildGround(this.sm.mats))

    const building = buildCafeBuilding(this.sm.mats, this.anim)
    this.sm.scene.add(building.group)

    const interior = buildInteriorEquipment(this.sm.mats)
    this.sm.scene.add(interior.group)

    const outdoor = buildOutdoorFurniture(this.sm.mats)
    this.sm.scene.add(outdoor.group)

    const wheat = buildWheatField(this.sm.mats, this.anim)
    this.sm.scene.add(wheat.group)
    this.wheatCount = wheat.count

    this.sm.scene.add(buildElectricity(this.sm.mats))
    this.sm.scene.add(buildDecoration(this.sm.mats, this.anim))

    /* ---- 注册交互资产 ---- */
    for (const it of interior.interactives) this.im.register(it.object, it.info)
    for (const it of outdoor.interactives) this.im.register(it.object, it.info)
    this.im.onSelect = (info) => this.onSelect?.(info)

    /* ---- 相机初始取景 + 主循环 ---- */
    this.cm.fitReference()
    this.sm.onFrame = (s) => this.onFrame?.(s)
    this.sm.add((t) => {
      this.cm.update()
      this.anim.tick(t)
      this.im.tick(0.016)
    })
    this.sm.start()

    window.addEventListener('resize', this.handleResize)
    // 调试入口（生产构建不含）
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__twin = this
    }
  }

  private handleResize = (): void => {
    this.sm.resize()
    if (!this.cm.userTouched && this.cm.current === 'reference') this.cm.fitReference()
  }

  setPreset(name: ViewPreset): void {
    this.cm.set(name)
  }

  setWind(strength: number): void {
    this.anim.setWind(strength)
  }

  clearSelect(): void {
    this.im.clearSelect()
  }

  stats(): Pick<TwinStats, 'wheatCount'> {
    return { wheatCount: this.wheatCount }
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    this.im.dispose()
    this.sm.dispose()
  }
}

export type { FrameStats }
