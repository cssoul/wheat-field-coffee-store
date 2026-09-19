import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { makeSkyTexture } from '../materials/textures'
import { BASE, CAFE, VOX } from '../utils/layout'

/**
 * ============================================================================
 *  光照系统
 * ============================================================================
 *
 * 提示词要求：模拟参考图里的自然阳光 —— 上午/下午的柔和侧光 + 软阴影，
 * 不要商业建筑渲染那种硬邦邦的效果。
 *
 * 三层结构：
 *   ① 一盏方向光当太阳（唯一投影光源，暖白，从左上前方斜射）
 *   ② 一盏半球光做天空/地面反弹光（冷调的上面 + 暖调的地面反射）
 *   ③ 一盏很弱的补光从反方向打，避免暗部死黑
 *
 * 另外给室内加两盏暖色点光源 —— 数字孪生要能从窗口看清设备，
 * 只有直射阳光的话室内会是一片黑。
 *
 * 还负责生成渐变天空球，并用它烘一张环境贴图（PMREM），
 * 让不锈钢咖啡机、陶瓷杯这些"光滑"材质有正确的反射，不至于发死。
 */

export interface LightingRig {
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  fill: THREE.DirectionalLight
  interior: THREE.PointLight[]
  /** 阴影相机覆盖范围（跟随场景尺寸） */
  setShadowExtent: (halfX: number, halfZ: number) => void
  update: (dt: number) => void
}

export function setupLighting(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): LightingRig {
  /* ---------------- 天空 ---------------- */
  // 背景与环境反射都来自同一张 equirect 渐变贴图 —— 天空色和场景里的
  // 环境光、金属反射天然一致，不会出现"背景一个蓝、反射另一个蓝"
  const skyTex = makeSkyTexture()
  scene.background = skyTex
  scene.backgroundIntensity = 1
  scene.environment = makeEnvironment(renderer, skyTex)
  scene.environmentIntensity = 0.62

  /* ---------------- 太阳 ---------------- */
  // 强度压到 2.5 左右：参考图是"明亮但不刺眼"的上午光，
  // 强度太高会把白墙和金黄色茅草直接冲成纯白，失去材质感
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.45)
  sun.position.set(-0.5, 0.78, 0.62).normalize().multiplyScalar(60)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  // PCFSoft 才够"软"；换来锐利硬边的做法不是我们要的观感
  sun.shadow.radius = 2.2
  scene.add(sun)
  scene.add(sun.target)
  sun.target.position.set(0, 2, 0)

  /* ---------------- 半球环境光 ---------------- */
  const hemi = new THREE.HemisphereLight(PAL.skyTop, PAL.soilTop, 0.62)
  scene.add(hemi)

  /* ---------------- 反向补光 ---------------- */
  const fill = new THREE.DirectionalLight(0xdce8f0, 0.42)
  fill.position.set(0.7, 0.5, -0.8).normalize().multiplyScalar(40)
  scene.add(fill)

  /* ---------------- 室内暖光 ---------------- */
  // 强度刻意压低：室内一旦被照亮成白昼，从窗口看进去就成了一片过曝的白，
  // 参考图里窗内是"暖、暗、有层次"的，不是亮的
  const interior: THREE.PointLight[] = []
  const lightSpots: Array<[number, number, number, number]> = [
    [-8, 10, -2, 0.72], // 后吧台
    [6, 9.5, 2, 0.5], // 窗内吧台
    [13, 9, -6, 0.34], // 冰箱一侧
  ]
  for (const [x, y, z, power] of lightSpots) {
    const l = new THREE.PointLight(0xffb96e, power * 20, 16 * VOX * 3.4, 2)
    l.position.set(x * VOX, y * VOX, z * VOX)
    l.castShadow = false
    scene.add(l)
    interior.push(l)
  }

  /* ---------------- 阴影范围 ---------------- */
  const setShadowExtent = (halfX: number, halfZ: number) => {
    const cam = sun.shadow.camera
    cam.left = -halfX
    cam.right = halfX
    cam.top = halfZ
    cam.bottom = -halfZ
    cam.near = 6
    cam.far = 150
    cam.updateProjectionMatrix()
  }
  // 覆盖整块地台，外加一点余量给屋脊和电线杆
  setShadowExtent((BASE.x1 - BASE.x0) * 0.5 * VOX + 4, (BASE.z1 - BASE.z0) * 0.5 * VOX + 4)
  // 让阴影相机对准地台中心
  sun.target.position.set(0, 1.5, 0)
  sun.position.set(-26, 42, 33)

  // 轻微的光照呼吸：云飘过时地面亮度会有一点点起伏，静态画面不至于太死
  let t = 0
  const baseSun = sun.intensity
  const update = (dt: number) => {
    t += dt
    sun.intensity = baseSun * (0.985 + 0.015 * Math.sin(t * 0.21))
  }

  return { sun, hemi, fill, interior, setShadowExtent, update }
}

/* ====================================================================== */

/** 由天空贴图烘一张环境贴图，给光滑材质提供反射与 IBL */
function makeEnvironment(renderer: THREE.WebGLRenderer, sky: THREE.Texture): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const rt = pmrem.fromEquirectangular(sky as THREE.Texture)
  pmrem.dispose()
  return rt.texture
}

/** 相机预设与包围盒相关的常量，供 CameraRig 使用 */
export const SCENE_BOUNDS = {
  center: new THREE.Vector3(0, CAFE.wallH * 0.32 * VOX, 2 * VOX),
  radius: Math.max(BASE.x1 - BASE.x0, BASE.z1 - BASE.z0) * 0.5 * VOX,
}
