import * as THREE from 'three'
import { makeRng, shade, shiftHsl, type Rng } from '../utils/rng'
import { VOX } from '../utils/layout'
import type { Occupancy } from '../utils/occupancy'

/**
 * ============================================================================
 *  VoxelBatch —— 体素合批引擎
 * ============================================================================
 *
 * 微缩模型的关键矛盾：
 *   「手工砌的小砖 + 成百上千根茅草」需要海量体素，但 60FPS 不允许海量 draw call。
 *
 * 解法：所有体素共用一块 BoxGeometry，按**材质质感**分成 3 个桶
 * （哑光 / 光滑 / 自发光），每个桶一个 InstancedMesh，
 * 每个实例的颜色走 instanceColor —— 于是：
 *
 *   整栋房子的上万个方块 = 3 个 draw call
 *
 * 坐标系统：
 *   建模用「网格单位」(grid)，1 grid = VOX 世界单位。
 *   y = 0 是地台顶面（地面）。所有 box/fill 用 min/max 角点描述，比中心点+尺寸好写。
 */

/** 一个网格单位对应的世界尺寸（与 layout 同源，这里再导出一份方便建模模块引用） */
export { VOX }
/** 相邻体素之间留的微小重叠，消除面与面之间的接缝 */
export const SEAM = 0.006

/** 材质质感分桶 */
export type Finish = 'matte' | 'gloss' | 'glow'

type WallSide = 'north' | 'south' | 'east' | 'west'

interface Bucket {
  pos: number[] // px,py,pz
  scl: number[] // sx,sy,sz
  rot: number[] // rx,ry,rz（每实例 3 个）
  col: number[] // hex
}

function emptyBucket(): Bucket {
  return { pos: [], scl: [], rot: [], col: [] }
}

export interface FillOpts {
  finish?: Finish
  /** 明度抖动幅度（0.08 = ±8%），让同色体素有手工感的自然差异 */
  jitter?: number
  /** 色相抖动幅度（0-1） */
  hue?: number
  /** 返回 true 则该体素跳过（用来挖洞、避开已有物体） */
  skip?: (x: number, y: number, z: number) => boolean
  /** 完全自定义颜色 */
  colorAt?: (x: number, y: number, z: number, base: number) => number
  /** 只保留外壳体素（内部掏空），用于大体块的表面着色，省实例数 */
  hollow?: boolean
}

/** 墙上的洞口（门 / 窗） */
export interface Opening {
  /** 在哪面墙上 */
  wall: WallSide
  /** 沿墙长方向的起止（网格单位）；南北墙= X 方向，东西墙= Z 方向 */
  a0: number
  a1: number
  /** 竖直起止 */
  y0: number
  y1: number
}

export interface BatchStats {
  voxels: number
  /** 实际参与渲染的 InstancedMesh 数量 = draw call 数量 */
  drawCalls: number
  matte: number
  gloss: number
  glow: number
}

const OUT = 0.5 // 砖块相对墙面向外凸出的量（网格单位）

export class VoxelBatch {
  private buckets: Record<Finish, Bucket> = {
    matte: emptyBucket(),
    gloss: emptyBucket(),
    glow: emptyBucket(),
  }
  private rng: Rng

  constructor(seed = 20260918) {
    this.rng = makeRng(seed)
  }

  /** 暴露确定性随机源给各建模模块，保证每次刷新模型完全一致 */
  rnd(): number {
    return this.rng()
  }

  /** [-1, 1) 抖动系数，配合 shade() 使用 */
  jit(): number {
    return this.rng() * 2 - 1
  }

  /* ------------------------------------------------------------------ */
  /* 写入原语                                                            */
  /* ------------------------------------------------------------------ */

  /** 往桶里塞一个实例。gx/gy/gz 为体素中心（网格单位），s* 为尺寸，r* 为欧拉角 */
  private push(
    finish: Finish,
    color: number,
    gx: number,
    gy: number,
    gz: number,
    sx: number,
    sy: number,
    sz: number,
    rx: number,
    ry: number,
    rz: number,
  ): void {
    const b = this.buckets[finish]
    b.pos.push(gx * VOX, gy * VOX, gz * VOX)
    b.scl.push(sx * VOX + SEAM, sy * VOX + SEAM, sz * VOX + SEAM)
    b.rot.push(rx, ry, rz)
    b.col.push(color)
  }

  /**
   * 一个长方体。用 min/max 角点（网格单位）描述 —— 建房子时最顺手。
   * 坐标为浮点也没问题，会自动归一化。ry 为绕 Y 轴旋转。
   */
  box(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    color: number,
    finish: Finish = 'matte',
    ry = 0,
  ): this {
    return this.boxRot(
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
      Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
      0, ry, 0, color, finish,
    )
  }

  /**
   * 任意姿态的长方体（中心 + 尺寸 + 欧拉角）。
   *
   * 屋顶这类"必须斜着放"的构件全靠它 —— 用带倾角的整块斜板当屋面，
   * 再在斜面上贴细草秆，就不会出现一级级台阶的方块感了。
   */
  boxRot(
    cx: number, cy: number, cz: number,
    sx: number, sy: number, sz: number,
    rx: number, ry: number, rz: number,
    color: number,
    finish: Finish = 'matte',
  ): this {
    this.push(finish, color, cx, cy, cz, Math.abs(sx), Math.abs(sy), Math.abs(sz), rx, ry, rz)
    return this
  }

  /** 单块体素砖（1×1×1 网格单位），整数格点写入 */
  vox(x: number, y: number, z: number, color: number, finish: Finish = 'matte'): this {
    return this.box(x, y, z, x + 1, y + 1, z + 1, color, finish)
  }

  /**
   * 用一格格体素填满一个区域 —— 茅草、麦垄、土路都靠它。
   * 每一格能单独抖色，所以看起来像"一根根铺上去"的。
   */
  fill(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    base: number,
    opts: FillOpts = {},
  ): this {
    const finish = opts.finish ?? 'matte'
    const jitter = opts.jitter ?? 0
    const hue = opts.hue ?? 0
    const ax = Math.round(Math.min(x0, x1)), bx = Math.round(Math.max(x0, x1))
    const ay = Math.round(Math.min(y0, y1)), by = Math.round(Math.max(y0, y1))
    const az = Math.round(Math.min(z0, z1)), bz = Math.round(Math.max(z0, z1))
    const hollow = opts.hollow ?? false

    for (let x = ax; x < bx; x++) {
      for (let y = ay; y < by; y++) {
        for (let z = az; z < bz; z++) {
          if (hollow) {
            const onShell =
              x === ax || x === bx - 1 ||
              y === ay || y === by - 1 ||
              z === az || z === bz - 1
            if (!onShell) continue
          }
          if (opts.skip && opts.skip(x, y, z)) continue
          let c = opts.colorAt ? opts.colorAt(x, y, z, base) : base
          if (jitter > 0) c = shade(c, 1 + this.jit() * jitter)
          if (hue > 0) c = shiftHsl(c, this.jit() * hue, 0, 0)
          this.push(finish, c, x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, 0, 0, 0)
        }
      }
    }
    return this
  }

  /** 一条粗线（做栏杆、窗棂、房梁、支架） */
  line(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    r: number,
    color: number,
    finish: Finish = 'matte',
  ): this {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
    const len = Math.hypot(dx, dy, dz)
    const steps = Math.max(1, Math.ceil(len / Math.max(0.35, r)))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.box(
        x0 + dx * t - r, y0 + dy * t - r, z0 + dz * t - r,
        x0 + dx * t + r, y0 + dy * t + r, z0 + dz * t + r,
        color, finish,
      )
    }
    return this
  }

  /* ------------------------------------------------------------------ */
  /* 建筑原语                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * 错缝砌砖墙面（running bond）—— 「白色手工砖墙」的关键。
   * 奇数行横移半块砖，每块砖单独抖色，砖块向外凸出 OUT 形成砌筑立体感。
   *
   * @param axis  墙的走向：'x' = 南北墙（沿 X 铺），'z' = 东西墙（沿 Z 铺）
   * @param a0,a1 沿墙长方向的起止
   * @param at    墙面（外表面）所在坐标
   * @param dir   +1 = 向外朝正方向，-1 = 向外朝负方向
   * @param openings 该面上的洞口，落在洞口内的砖跳过
   */
  brickWall(
    axis: 'x' | 'z',
    a0: number, a1: number,
    y0: number, y1: number,
    at: number,
    dir: 1 | -1,
    brickW: number,
    brickH: number,
    color: number,
    openings: Opening[] = [],
    side?: WallSide,
  ): this {
    const rows = Math.max(1, Math.round((y1 - y0) / brickH))
    const gapA = 0.22 // 砖缝宽度
    const gapY = 0.55

    for (let r = 0; r < rows; r++) {
      const by0 = y0 + r * brickH
      const by1 = Math.min(y1, by0 + brickH) - gapY
      if (by1 - by0 < 0.2) continue
      const offset = r % 2 === 0 ? -brickW / 2 : 0
      const cols = Math.ceil((a1 - a0) / brickW) + 1
      for (let c = 0; c < cols; c++) {
        let ca = a0 + offset + c * brickW
        let cb = ca + brickW - gapA
        ca = Math.max(a0, ca)
        cb = Math.min(a1, cb)
        if (cb - ca < 0.35) continue

        // 落在洞口里的砖直接跳过（留出窗和门）
        let blocked = false
        if (side) {
          for (const op of openings) {
            if (op.wall !== side) continue
            if (cb - 0.25 > op.a0 && ca + 0.25 < op.a1 && by1 - 0.25 > op.y0 && by0 + 0.25 < op.y1) {
              blocked = true
              break
            }
          }
        }
        if (blocked) continue

        const col = shade(color, 1 + this.jit() * 0.05)
        if (axis === 'x') {
          this.box(ca, by0, at, cb, by1, at + dir * OUT, col)
        } else {
          this.box(at, by0, ca, at + dir * OUT, by1, cb, col)
        }
      }
    }
    return this
  }

  /* ------------------------------------------------------------------ */
  /* 输出                                                                */
  /* ------------------------------------------------------------------ */

  stats(): BatchStats {
    const m = this.buckets.matte.col.length
    const g = this.buckets.gloss.col.length
    const e = this.buckets.glow.col.length
    let dc = 0
    if (m > 0) dc++
    if (g > 0) dc++
    if (e > 0) dc++
    return { voxels: m + g + e, drawCalls: dc, matte: m, gloss: g, glow: e }
  }

  get voxels(): number {
    return (
      this.buckets.matte.col.length +
      this.buckets.gloss.col.length +
      this.buckets.glow.col.length
    )
  }

  /**
   * 生成最终 THREE.Group。
   * 每桶一个 InstancedMesh：共享 BoxGeometry、共享材质，颜色靠 instanceColor。
   */
  build(name = 'voxel-model'): THREE.Group {
    const group = new THREE.Group()
    group.name = name

    const geo = new THREE.BoxGeometry(1, 1, 1)

    const materials: Record<Finish, THREE.Material> = {
      // 哑光：砖、木、茅草、布、麦田 —— 微缩模型的主体
      matte: new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.93, metalness: 0, flatShading: true,
      }),
      // 光滑：不锈钢咖啡机、陶瓷杯、玻璃
      gloss: new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.3, metalness: 0.45, flatShading: true,
      }),
      // 自发光：窗内暖灯 —— 用 Basic 最省，且不被光照影响
      glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    }

    for (const finish of ['matte', 'gloss', 'glow'] as Finish[]) {
      const b = this.buckets[finish]
      const count = b.col.length
      if (count === 0) continue

      const mesh = new THREE.InstancedMesh(geo, materials[finish], count)
      mesh.name = `voxel-${finish}`
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

      const arr = mesh.instanceMatrix.array as Float32Array
      const q = new THREE.Quaternion()
      const e = new THREE.Euler()
      const vPos = new THREE.Vector3()
      const vScl = new THREE.Vector3()
      const m = new THREE.Matrix4()

      for (let i = 0; i < count; i++) {
        vPos.set(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2])
        vScl.set(b.scl[i * 3], b.scl[i * 3 + 1], b.scl[i * 3 + 2])
        const rx = b.rot[i * 3]
        const ry = b.rot[i * 3 + 1]
        const rz = b.rot[i * 3 + 2]
        if (rx === 0 && ry === 0 && rz === 0) {
          // 绝大多数体素都是轴对齐的，走快速路径
          const o = i * 16
          arr[o] = vScl.x; arr[o + 1] = 0;    arr[o + 2] = 0;    arr[o + 3] = 0
          arr[o + 4] = 0;  arr[o + 5] = vScl.y; arr[o + 6] = 0;  arr[o + 7] = 0
          arr[o + 8] = 0;  arr[o + 9] = 0;    arr[o + 10] = vScl.z; arr[o + 11] = 0
          arr[o + 12] = vPos.x
          arr[o + 13] = vPos.y
          arr[o + 14] = vPos.z
          arr[o + 15] = 1
        } else {
          e.set(rx, ry, rz)
          q.setFromEuler(e)
          m.compose(vPos, q, vScl)
          m.toArray(arr, i * 16)
        }
      }
      mesh.instanceMatrix.needsUpdate = true

      const cbuf = new Float32Array(count * 3)
      const tmp = new THREE.Color()
      for (let i = 0; i < count; i++) {
        tmp.setHex(b.col[i])
        cbuf[i * 3] = tmp.r
        cbuf[i * 3 + 1] = tmp.g
        cbuf[i * 3 + 2] = tmp.b
      }
      mesh.instanceColor = new THREE.InstancedBufferAttribute(cbuf, 3)
      mesh.instanceColor.needsUpdate = true

      mesh.castShadow = finish !== 'glow'
      mesh.receiveShadow = true
      // 实例数量大，交给 three 自动算包围盒会遍历全部实例，这里直接关掉视锥剔除
      mesh.frustumCulled = false
      group.add(mesh)
    }

    return group
  }
}

/* ====================================================================== */
/* 建模封装 —— 提示词要求统一封装的 create* 入口                          */
/* ====================================================================== */

/**
 * 各建模模块统一的构建上下文。
 * 体素统一写进 b；非体素对象（贴图面片、TubeGeometry 电线、云）
 * 挂到 group 上；占地登记写进 occ 供麦田避让。
 */
export interface BuildCtx {
  b: VoxelBatch
  occ: Occupancy
  group: THREE.Group
}

/** 单块体素砖 */
export function createVoxelBlock(
  b: VoxelBatch,
  x: number, y: number, z: number,
  color: number,
  finish: Finish = 'matte',
): VoxelBatch {
  return b.vox(x, y, z, color, finish)
}

export interface BuildingOpts {
  x0: number; x1: number; z0: number; z1: number
  /** 墙高（网格单位） */
  wallH: number
  brickW?: number
  brickH?: number
  brick?: number
  core?: number
  openings?: Opening[]
}

/**
 * 体素建筑外壳：矩形体 + 墙厚，四面铺错缝砖，门窗位置自动留洞。
 * 返回墙体的关键尺寸，供屋顶/门窗构件对齐使用。
 */
export function createVoxelBuilding(b: VoxelBatch, o: BuildingOpts): BuildingOpts {
  const { x0, x1, z0, z1, wallH } = o
  const bw = o.brickW ?? 3
  const bh = o.brickH ?? 1.5
  const brick = o.brick ?? 0xe9e3d6
  const core = o.core ?? 0xe4ded1
  const openings = o.openings ?? []
  const T = 2 // 墙厚（网格单位）

  // 四面墙的几何定义：走向轴、沿墙起止、墙体的内外两个面
  const walls = [
    { side: 'south' as WallSide, axis: 'x' as const, a0: x0, a1: x1, i0: z1 - T, i1: z1, face: z1, dir: 1 as const },
    { side: 'north' as WallSide, axis: 'x' as const, a0: x0, a1: x1, i0: z0, i1: z0 + T, face: z0, dir: -1 as const },
    { side: 'west' as WallSide, axis: 'z' as const, a0: z0 + T, a1: z1 - T, i0: x0, i1: x0 + T, face: x0, dir: -1 as const },
    { side: 'east' as WallSide, axis: 'z' as const, a0: z0 + T, a1: z1 - T, i0: x1 - T, i1: x1, face: x1, dir: 1 as const },
  ]

  for (const w of walls) {
    const ops = openings
      .filter((op) => op.wall === w.side)
      .slice()
      .sort((p, q) => p.a0 - q.a0)

    /** 铺一段实心墙芯 */
    const coreSeg = (a0: number, a1: number, y0: number, y1: number) => {
      if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return
      if (w.axis === 'x') b.box(a0, y0, w.i0, a1, y1, w.i1, core)
      else b.box(w.i0, y0, a0, w.i1, y1, a1, core)
    }

    // 洞口之间铺满，洞口上下补过梁与窗台
    let cursor = w.a0
    for (const op of ops) {
      const a0 = Math.max(w.a0, op.a0)
      const a1 = Math.min(w.a1, op.a1)
      if (a1 <= a0) continue
      coreSeg(cursor, a0, 0, wallH)
      if (op.y1 < wallH) coreSeg(a0, a1, op.y1, wallH) // 过梁
      if (op.y0 > 0) coreSeg(a0, a1, 0, op.y0) // 窗台墙
      cursor = Math.max(cursor, a1)
    }
    coreSeg(cursor, w.a1, 0, wallH)

    // 外墙错缝砖：贴在外表面往外凸 OUT，落在洞口里的砖自动跳过
    b.brickWall(w.axis, w.a0, w.a1, 0, wallH, w.face, w.dir, bw, bh, brick, openings, w.side)
  }

  return { ...o, brickW: bw, brickH: bh, brick, core, openings }
}
