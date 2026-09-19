/**
 * 确定性伪随机工具。
 *
 * 场景里所有"自然的随机"（麦田排布、砖块色差、茅草长短、云的位置）
 * 都走这里 —— 用固定 seed，保证每次刷新页面看到的是同一个微缩模型，
 * 而不是每次都长得不一样。
 */

export type Rng = () => number

/** mulberry32：小巧、够快、分布均匀的确定性随机数发生器 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [a, b) 区间随机浮点 */
export function rr(rng: Rng, a: number, b: number): number {
  return a + (b - a) * rng()
}

/** [a, b] 区间随机整数 */
export function ri(rng: Rng, a: number, b: number): number {
  return Math.floor(a + (b - a + 1) * rng()) | 0
}

/** 数组随机取一项 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

/** 概率命中 */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

/** 平滑插值 */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/* ------------------------------------------------------------------ */
/* 颜色工具：全部按 hex number 处理，方便 VoxelBatch 直接吃            */
/* ------------------------------------------------------------------ */

/** 明度缩放：f > 1 提亮，f < 1 压暗（结果 clamp 到 0-255） */
export function shade(hex: number, f: number): number {
    const r = (hex >> 16) & 255
    const g = (hex >> 8) & 255
    const b = hex & 255
    const c = (v: number) => (v > 255 ? 255 : v < 0 ? 0 : Math.round(v))
    return (c(r * f) << 16) | (c(g * f) << 8) | c(b * f)
}

/** 两色线性混合，t=0 取 a，t=1 取 b */
export function mixHex(a: number, b: number, t: number): number {
  const k = clamp(t, 0, 1)
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  const r = Math.round(ar + (br - ar) * k)
  const g = Math.round(ag + (bg - ag) * k)
  const bl = Math.round(ab + (bb - ab) * k)
  return (r << 16) | (g << 8) | bl
}

/**
 * 色相/饱和度/明度偏移。用于给麦田、茅草、砖墙做"同一色系的自然差异"。
 * 纯手写 HSL 转换，避免依赖 THREE.Color 的 sRGB 处理差异。
 */
export function shiftHsl(
  hex: number,
  dh: number,
  ds: number,
  dl: number,
): number {
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  h = (h + dh + 1) % 1
  s = clamp(s + ds, 0, 1)
  const l2 = clamp(l + dl, 0, 1)

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  let rr2: number, gg2: number, bb2: number
  if (s < 1e-6) {
    rr2 = gg2 = bb2 = l2
  } else {
    const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s
    const p = 2 * l2 - q
    rr2 = hue2rgb(p, q, h + 1 / 3)
    gg2 = hue2rgb(p, q, h)
    bb2 = hue2rgb(p, q, h - 1 / 3)
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return (c(rr2) << 16) | (c(gg2) << 8) | c(bb2)
}
