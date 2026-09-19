import * as THREE from 'three'

/**
 * ============================================================================
 *  微风系统 —— GPU 顶点风摆
 * ============================================================================
 *
 * 麦田有上万株，逐株在 CPU 上算摆动是不可能跑满 60FPS 的。
 * 所以把摆动完全放到顶点着色器里：CPU 每帧只更新一个 uniform（时间），
 * 上万株麦子的摆动由 GPU 并行完成，代价接近于零。
 *
 * 三条设计要点：
 *  1. 相位来自实例的世界坐标 —— 相邻麦子相位接近，摆动像"波浪推过去"
 *     而不是每株各抖各的。
 *  2. 根部权重 w = (y / 高度)^1.45 —— 底部锁死不动，越往上摆幅越大，
 *     完全符合真实植物的弯曲形态。
 *  3. 阵风包络 gust —— 两个不同频率的正弦相乘，形成"一阵一阵"的自然节奏，
 *     避免机械匀速摆动。
 */

export const WIND = {
  /** 风力强度，UI 滑块直接改它 */
  strength: { value: 1.0 },
  /** 风向（XZ 平面单位向量） */
  dir: { value: new THREE.Vector2(0.86, 0.51) },
}

const TIME = { value: 0 }

/** 每帧推进风的时间 */
export function tickWind(dt: number): void {
  TIME.value += dt
}

export function getWindTime(): number {
  return TIME.value
}

/**
 * 给材质注入风摆顶点动画。
 *
 * @param material  目标材质（会被就地修改，onBeforeCompile 注入 GLSL）
 * @param height    几何体从根部到顶端的局部高度（= 权重归一化分母）
 * @param bend      该物体的最大摆幅（局部单位）
 */
export function applyWindShader(
  material: THREE.Material,
  height: number,
  bend = 0.16,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = TIME
    shader.uniforms.uWindStrength = WIND.strength
    shader.uniforms.uWindDir = WIND.dir
    shader.uniforms.uWindHeight = { value: height }
    shader.uniforms.uWindBend = { value: bend }

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uWindTime;
        uniform float uWindStrength;
        uniform float uWindHeight;
        uniform float uWindBend;
        uniform vec2  uWindDir;
      `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3( position );

        // 取实例的世界位置作为相位种子：同一片区域的麦子相位连续
        #ifdef USE_INSTANCING
          vec3 iOrigin = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
        #else
          vec3 iOrigin = vec3( 0.0 );
        #endif

        // 根部锁死，越靠梢部摆幅越大
        float wH   = clamp( position.y / uWindHeight, 0.0, 1.0 );
        float bendW = pow( wH, 1.45 );

        float phase = iOrigin.x * 0.62 + iOrigin.z * 0.47;

        // 双频叠加：低频大摆 + 高频细颤
        float g1 = sin( uWindTime * 1.30 + phase );
        float g2 = sin( uWindTime * 2.85 + phase * 1.7 + 1.3 );

        // 阵风包络：空间上低频变化，形成"风从田里推过去"的波浪
        float gust = 0.58 + 0.42 * sin( uWindTime * 0.40 + iOrigin.x * 0.075 + iOrigin.z * 0.055 );

        float sway = ( g1 * 0.72 + g2 * 0.28 ) * gust * uWindStrength * uWindBend;

        transformed.x += uWindDir.x * sway * bendW;
        transformed.z += uWindDir.y * sway * bendW;
        // 顺风时稍微压低一点点，逆风回弹，增加体积感
        transformed.y -= abs( sway ) * bendW * 0.16;
      `,
      )
  }
  // 材质需要重新编译
  material.needsUpdate = true
}

/* ====================================================================== */
/* 植被几何体工厂                                                          */
/* ====================================================================== */

/**
 * 麦秆 + 麦穗（两段式实例）。
 *
 * 拆成两个 InstancedMesh 而不是把两者合并进一个 Geometry，原因是 three 的
 * vertexColors 会和 instanceColor 相乘 —— 合并后没法让"秆是青的、穗是金的"
 * 同时还能被实例色统一调制。拆开后两个 mesh 共用同一批 instanceMatrix，
 * 因此位置、朝向、风摆相位完全同步，看不出来是两部分。
 */

export interface WheatGeometryPair {
  /** 麦秆：根部在 y=0，高度 height */
  stalk: THREE.BufferGeometry
  /** 麦穗：底部在 y = height，向上长 earLen */
  ear: THREE.BufferGeometry
  totalHeight: number
}

export function makeWheatGeometry(height = 1, earLen = 0.26, thickness = 0.036): WheatGeometryPair {
  // 秆：上细下粗，用两段拼出锥度（体素风的方秆）
  const lower = new THREE.BoxGeometry(thickness * 1.35, height * 0.62, thickness * 1.35)
  lower.translate(0, height * 0.31, 0)
  const upper = new THREE.BoxGeometry(thickness * 0.95, height * 0.44, thickness * 0.95)
  upper.translate(0, height * 0.62 + height * 0.22, 0)

  const stalk = mergeGeometries([lower, upper])

  // 穗：一小束细长方块，压在秆顶。
  // 只做一段 —— 麦田动辄两万株，每多一个 box 就是两万 × 12 个三角形，
  // 而穗在屏幕上往往只有几个像素，多一段看不出来、帧率却实打实往下掉。
  const e1 = new THREE.BoxGeometry(thickness * 1.5, earLen, thickness * 1.5)
  e1.translate(0, height + earLen * 0.5, 0)

  const ear = mergeGeometries([e1])

  return { stalk, ear, totalHeight: height + earLen }
}

/** 一小丛草（3-5 片叶子），用于田埂和平台边缘的杂草 */
export function makeGrassTuftGeometry(seedRng: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const n = 3 + Math.floor(seedRng() * 3)
  for (let i = 0; i < n; i++) {
    const h = 0.12 + seedRng() * 0.16
    const g = new THREE.BoxGeometry(0.022, h, 0.022)
    g.translate((seedRng() - 0.5) * 0.09, h / 2, (seedRng() - 0.5) * 0.09)
    g.rotateZ((seedRng() - 0.5) * 0.5)
    parts.push(g)
  }
  return mergeGeometries(parts)
}

/** 灌木 / 盆栽叶团：几层小方块堆成球状 */
export function makeBushGeometry(rng: () => number, r = 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 14; i++) {
    const s = (0.16 + rng() * 0.16) * r
    const g = new THREE.BoxGeometry(s, s, s)
    const a = rng() * Math.PI * 2
    const rr = rng() * 0.7 * r
    g.translate(Math.cos(a) * rr, 0.35 * r + rng() * 1.5 * r, Math.sin(a) * rr)
    parts.push(g)
  }
  return mergeGeometries(parts)
}

/* ---------------------------------------------------------------------- */

/**
 * 合并几何体（只处理 position/normal/uv，够本场景用）。
 * 手写而不用 three 的 BufferGeometryUtils，是为了不额外依赖 examples 目录，
 * 也让打包体积更可控。
 */
export function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vCount = 0
  let iCount = 0
  for (const g of list) {
    const pos = g.getAttribute('position')
    vCount += pos.count
    iCount += g.index ? g.index.count : pos.count
  }

  const position = new Float32Array(vCount * 3)
  const normal = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const index = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount)

  let vOff = 0
  let iOff = 0
  for (const g of list) {
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    const txc = g.getAttribute('uv')
    position.set(pos.array as Float32Array, vOff * 3)
    if (nor) normal.set(nor.array as Float32Array, vOff * 3)
    if (txc) uv.set(txc.array as Float32Array, vOff * 2)
    const idx = g.index
    if (idx) {
      for (let i = 0; i < idx.count; i++) index[iOff + i] = idx.getX(i) + vOff
      iOff += idx.count
    } else {
      for (let i = 0; i < pos.count; i++) index[iOff + i] = i + vOff
      iOff += pos.count
    }
    vOff += pos.count
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(position, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(index, 1))
  out.computeBoundingSphere()
  return out
}
