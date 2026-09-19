/**
 * LightingManager —— 柔和自然阳光 + 半球环境 + 接触阴影贴片。
 * 参考 Asset Sheet 左上角：明亮、温暖、通透，影子落在右后方。
 */
import * as THREE from 'three'

import { BASE, VOX } from '../scene/layout'

export class LightingManager {
  readonly sun: THREE.DirectionalLight
  private group = new THREE.Group()

  constructor(scene: THREE.Scene) {
    // 主光：暖阳，从画面右后上方打过来（参考图影子朝左前方）
    this.sun = new THREE.DirectionalLight(0xfff1d8, 2.6)
    this.sun.position.set(12, 28, 22)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const bwx = (BASE.x1 - BASE.x0) * VOX * 0.62
    const bwz = (BASE.z1 - BASE.z0) * VOX * 0.62
    this.sun.shadow.camera.left = -bwx
    this.sun.shadow.camera.right = bwx
    this.sun.shadow.camera.top = bwz
    this.sun.shadow.camera.bottom = -bwz
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 90
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.sun.shadow.radius = 4
    scene.add(this.sun, this.sun.target)

    // 半球环境：天光偏冷、地面反光偏暖麦色
    scene.add(new THREE.HemisphereLight(0xe8eef2, 0xb9a580, 0.95))
    scene.add(new THREE.AmbientLight(0xfff6e8, 0.25))
  }

  /**
   * 接触 AO 贴片：径向渐变椭圆，贴在物体与地面交界。
   * 微缩模型"放在桌面上"的关键细节。
   */
  static makeContactShadow(rx: number, rz: number, opacity = 0.3): THREE.Mesh {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62)
    grad.addColorStop(0, 'rgba(30,22,12,0.85)')
    grad.addColorStop(0.55, 'rgba(30,22,12,0.35)')
    grad.addColorStop(1, 'rgba(30,22,12,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rx * 2, rz * 2),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 1
    return mesh
  }
}
