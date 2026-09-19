/**
 * InteractionManager —— Raycaster 点击/悬停交互。
 * 可交互资产注册后：悬停高亮（emissive），点击弹出数字孪生信息卡。
 */
import * as THREE from 'three'

import type { AssetInfo } from '../types/twin'

interface Entry {
  object: THREE.Object3D
  info: AssetInfo
  materials: THREE.MeshStandardMaterial[]
  originalEmissive: THREE.Color[]
  originalIntensity: number[]
}

export class InteractionManager {
  private ray = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private entries: Entry[] = []
  private hovered: Entry | null = null
  private selected: Entry | null = null
  private dom: HTMLElement
  private pulse = 0

  /** 悬停 / 选中的资产变化时回调（null = 取消） */
  onHover?: (info: AssetInfo | null) => void
  onSelect?: (info: AssetInfo | null) => void

  constructor(dom: HTMLElement, private camera: THREE.Camera) {
    this.dom = dom
    dom.addEventListener('pointermove', this.onPointerMove)
    dom.addEventListener('click', this.onClick)
  }

  /** 注册可交互对象（会连同子 Mesh 一起检测） */
  register(root: THREE.Object3D, info: AssetInfo): void {
    const materials: THREE.MeshStandardMaterial[] = []
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial
        if (std.emissive) materials.push(std)
      }
    })
    this.entries.push({
      object: root,
      info,
      materials,
      originalEmissive: materials.map((m) => m.emissive.clone()),
      originalIntensity: materials.map((m) => m.emissiveIntensity),
    })
  }

  private pick(ev: PointerEvent): Entry | null {
    const r = this.dom.getBoundingClientRect()
    this.pointer.set(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    )
    this.ray.setFromCamera(this.pointer, this.camera)
    const hits = this.ray.intersectObjects(
      this.entries.map((e) => e.object),
      true,
    )
    if (hits.length === 0) return null
    const hit = hits[0].object
    return this.entries.find((e) => {
      let found = false
      e.object.traverse((o) => {
        if (o === hit) found = true
      })
      return found
    }) ?? null
  }

  private onPointerMove = (ev: PointerEvent): void => {
    const e = this.pick(ev)
    if (e !== this.hovered) {
      if (this.hovered && this.hovered !== this.selected) this.setGlow(this.hovered, 0)
      this.hovered = e
      if (e && e !== this.selected) this.setGlow(e, 0.35)
      this.dom.style.cursor = e ? 'pointer' : ''
      this.onHover?.(e?.info ?? null)
    }
  }

  private onClick = (ev: MouseEvent): void => {
    const e = this.pick(ev as unknown as PointerEvent)
    if (this.selected) this.setGlow(this.selected, 0)
    this.selected = e
    if (e) this.setGlow(e, 0.55)
    this.onSelect?.(e?.info ?? null)
  }

  /** 每帧脉冲：选中的资产呼吸发光 */
  tick(delta: number): void {
    if (!this.selected) return
    this.pulse += delta
    const k = 0.45 + Math.sin(this.pulse * 3) * 0.15
    this.setGlow(this.selected, k)
  }

  private setGlow(e: Entry, intensity: number): void {
    e.materials.forEach((m, i) => {
      m.emissive.copy(e.originalEmissive[i])
      if (intensity > 0) m.emissive.lerp(new THREE.Color(0x2f8f5b), intensity * 0.5)
      m.emissiveIntensity = intensity > 0 ? intensity : e.originalIntensity[i]
    })
  }

  clearSelect(): void {
    if (this.selected) this.setGlow(this.selected, 0)
    this.selected = null
    this.onSelect?.(null)
  }

  dispose(): void {
    this.dom.removeEventListener('pointermove', this.onPointerMove)
    this.dom.removeEventListener('click', this.onClick)
  }
}
