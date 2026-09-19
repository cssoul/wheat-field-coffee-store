import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * ============================================================================
 *  相机系统
 * ============================================================================
 *
 * 提示词里这是"最重要的部分"：
 *   · 默认视角必须接近参考图 —— 45° 左右斜视
 *   · 像人站在桌边看微缩模型，不是天空俯视、不是游戏地图视角
 *   · PerspectiveCamera，FOV 35~45
 *
 * 俯角是这里最关键的一个数：参考图的地平线落在画面 34% 处，屋脊几乎压在
 * 地平线上、墙面正对镜头 —— 那是"人站着平视一个桌面沙盘"的视角，俯角只有
 * 5° 上下。俯角一大（比如 17°），地面被压扁、天空占掉画面一大半，
 * 微缩模型立刻变成"俯拍地图"，参考图那种味道就没了。
 */

export type ViewPreset = 'reference' | 'overview' | 'door' | 'window'

interface PresetDef {
  target: [number, number, number]
  /** 方位角（弧度，0 = 正前方 +Z 方向） */
  az: number
  /** 俯角（弧度） */
  el: number
  dist: number
  fov: number
  label: string
}

export const PRESETS: Record<ViewPreset, PresetDef> = {
  // 参考图视角：几乎正面、俯角约 5.3°。
  // dist / target 只是占位，实际由 CafeTwinScene.fitReference() 按视口比例算。
  reference: { target: [0, 4.2, 1.5], az: -0.13, el: 0.093, dist: 16, fov: 38, label: '参考图视角' },
  // 桌面俯瞰：站得更高，能一眼看全整块矩形地台的布局
  overview: { target: [0, 0.8, 0], az: -0.48, el: 0.72, dist: 32, fov: 40, label: '桌面俯瞰' },
  // 门前特写
  door: { target: [3, 1.7, 2.9], az: -0.32, el: 0.22, dist: 11.5, fov: 38, label: '门前特写' },
  // 窗口吧台特写：看室内设备
  window: { target: [-0.8, 1.95, 2.7], az: -0.08, el: 0.13, dist: 8.5, fov: 34, label: '窗口吧台' },
}

export interface CameraRig {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  current: ViewPreset
  applyPreset(name: ViewPreset, animate?: boolean): void
  onResize(width: number, height: number): void
  update(dt: number): void
  dispose(): void
}

export function createCameraRig(
  container: HTMLElement,
  aspect: number,
): CameraRig {
  const camera = new THREE.PerspectiveCamera(PRESETS.reference.fov, aspect, 0.1, 2000)

  const controls = new OrbitControls(camera, container)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  controls.rotateSpeed = 0.62
  controls.zoomSpeed = 0.85
  controls.panSpeed = 0.7
  controls.minDistance = 3
  controls.maxDistance = 110
  // 不让相机钻到地台下面去
  controls.maxPolarAngle = Math.PI * 0.495
  controls.minPolarAngle = 0.08
  // 不做自动旋转：静止的微缩模型比转个不停的更像"模型"
  controls.autoRotate = false

  const rig: CameraRig = {
    camera,
    controls,
    current: 'reference',
    applyPreset(name, animate = false) {
      const p = PRESETS[name]
      const target = new THREE.Vector3(...p.target)
      const ce = Math.cos(p.el)
      const to = new THREE.Vector3(
        target.x + Math.sin(p.az) * ce * p.dist,
        target.y + Math.sin(p.el) * p.dist,
        target.z + Math.cos(p.az) * ce * p.dist,
      )
      rig.current = name
      camera.fov = p.fov
      camera.updateProjectionMatrix()
      if (animate) {
        // 用当前距离和方向做一次简单插值，避免切换视角时"跳"
        const from = camera.position.clone()
        const t0 = controls.target.clone()
        const dur = 0.75
        let t = 0
        const step = () => {
          t += 1 / 60
          const k = Math.min(1, t / dur)
          const e = k * k * (3 - 2 * k)
          camera.position.lerpVectors(from, to, e)
          controls.target.lerpVectors(t0, target, e)
          controls.update()
          if (k < 1) requestAnimationFrame(step)
        }
        step()
      } else {
        camera.position.copy(to)
        controls.target.copy(target)
        controls.update()
      }
    },
    onResize(width, height) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    },
    update(dt) {
      void dt
      controls.update()
    },
    dispose() {
      controls.dispose()
    },
  }

  rig.applyPreset('reference')
  return rig
}
