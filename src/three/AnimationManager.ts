/**
 * AnimationManager —— 克制的动画集合：
 *   麦田风摆（GPU 顶点着色器，InstancedMesh 零额外开销）
 *   旗帜 / 布帘 轻微 CPU 摆动
 * 电线、家具不做动画。
 */
import * as THREE from 'three'

import type { MaterialLibrary } from '../materials/MaterialLibrary'

export class AnimationManager {
  private cpuAnims: Array<(t: number) => void> = []

  constructor(private mats: MaterialLibrary, private clockOffset = 0) {}

  /**
   * 给需要风摆的材质注入顶点着色器（麦田构建时调用）。
   * 每株相位由实例位置决定；根部 w=0 梢部 w=1，随风力整体缩放。
   */
  registerWindMaterial(m: THREE.Material): void {
    const u = this.mats.registerWindTargets.uniforms
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime
      shader.uniforms.uWind = u.uWind
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uWind;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.43;
            float w = pow(clamp(position.y / 0.9, 0.0, 1.0), 1.8);
            transformed.x += (sin(uTime * 1.7 + phase) + 0.4 * sin(uTime * 3.1 + phase * 1.7)) * w * 0.09 * uWind;
            transformed.z += cos(uTime * 1.3 + phase * 1.3) * w * 0.06 * uWind;
          #endif`,
        )
    }
  }

  /** CPU 微动注册：旗帜/布帘等小型网格 */
  add(fn: (t: number) => void): void {
    this.cpuAnims.push(fn)
  }

  setWind(strength: number): void {
    this.mats.registerWindTargets.uniforms.uWind.value = strength
  }

  tick(elapsed: number): void {
    const t = elapsed + this.clockOffset
    this.mats.registerWindTargets.uniforms.uTime.value = t
    for (const fn of this.cpuAnims) fn(t)
  }
}

/**
 * 平面布料波动（旗帜/布帘通用）：
 * 对 PlaneGeometry 顶点做行进波，保存原始坐标避免累积漂移。
 * 固定边在 x 负方向（挂在杆上），波动幅度向自由边增大。
 */
export function makeClothWave(
  mesh: THREE.Mesh,
  opts: { amp?: number; freq?: number; speed?: number } = {},
): (t: number) => void {
  const geo = mesh.geometry as THREE.PlaneGeometry
  const base = Float32Array.from(geo.attributes.position.array)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const amp = opts.amp ?? 0.25
  const freq = opts.freq ?? 1.4
  const speed = opts.speed ?? 2.2
  const w = geo.parameters.width
  return (t: number) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      const y = base[i * 3 + 1]
      const k = (x + w / 2) / w
      pos.setZ(i, base[i * 3 + 2] + Math.sin(t * speed + x * freq + y * 0.8) * amp * k)
      pos.setX(i, base[i * 3] + Math.sin(t * speed * 0.7 + y) * amp * 0.25 * k)
    }
    pos.needsUpdate = true
  }
}
