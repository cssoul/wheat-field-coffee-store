/**
 * 占地登记表 —— 决定"哪里不能长麦子"。
 *
 * 建筑、木平台、铺装、土路、家具都会往这里登记，
 * 麦田生成时逐点查询，避开这些区域。
 * 这样"麦子穿过桌子腿"这种穿帮就不会发生。
 */

export interface Rect {
  kind: 'rect'
  x0: number; z0: number; x1: number; z1: number
}

export interface Disc {
  kind: 'disc'
  x: number; z: number; r: number
}

export interface Poly {
  kind: 'poly'
  pts: Array<[number, number]>
  /** 半宽 */
  w: number
}

type Shape = Rect | Disc | Poly

export class Occupancy {
  private shapes: Shape[] = []

  /** 矩形占地（网格单位），margin 向外扩一圈 */
  rect(x0: number, z0: number, x1: number, z1: number, margin = 0): this {
    this.shapes.push({
      kind: 'rect',
      x0: Math.min(x0, x1) - margin,
      x1: Math.max(x0, x1) + margin,
      z0: Math.min(z0, z1) - margin,
      z1: Math.max(z0, z1) + margin,
    })
    return this
  }

  /** 圆形占地（伞、树、桌椅） */
  disc(x: number, z: number, r: number): this {
    this.shapes.push({ kind: 'disc', x, z, r })
    return this
  }

  /** 折线走廊占地（土路） */
  poly(pts: Array<[number, number]>, w: number): this {
    this.shapes.push({ kind: 'poly', pts, w })
    return this
  }

  /** 该点是否被占用 */
  test(x: number, z: number): boolean {
    for (const s of this.shapes) {
      if (s.kind === 'rect') {
        if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return true
      } else if (s.kind === 'disc') {
        const dx = x - s.x, dz = z - s.z
        if (dx * dx + dz * dz <= s.r * s.r) return true
      } else {
        if (this.distToPoly(x, z, s) <= s.w) return true
      }
    }
    return false
  }

  private distToPoly(x: number, z: number, p: Poly): number {
    let best = Infinity
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, az] = p.pts[i]
      const [bx, bz] = p.pts[i + 1]
      const vx = bx - ax, vz = bz - az
      const len2 = vx * vx + vz * vz
      let t = len2 > 0 ? ((x - ax) * vx + (z - az) * vz) / len2 : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const dx = x - (ax + vx * t)
      const dz = z - (az + vz * t)
      const d = Math.hypot(dx, dz)
      if (d < best) best = d
    }
    return best
  }
}
