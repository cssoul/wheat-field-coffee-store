import * as THREE from 'three'
import { PAL } from '../materials/palette'
import { makeChalkboardTexture, makeSignTexture, makeFlagTexture } from '../materials/textures'
import { shade } from '../utils/rng'
import { CAFE, OPENINGS } from '../utils/layout'
import { createVoxelBuilding, type BuildCtx, type Opening } from './voxel'

/**
 * ============================================================================
 *  白色乡村咖啡屋
 * ============================================================================
 *
 * 参考图里这栋房子有四个必须还原的特征，缺一个就不像：
 *
 *  1. 白色手工砖墙 —— 不是一整块白box，是错缝砌的小砖，每块微微凸出、色调略有出入
 *  2. 厚麦草屋顶 —— 全图最大的视觉重点：
 *     · 束状草秆沿坡面铺下来（同一根草一个颜色，连成一束）
 *     · 外沿一圈不规则的垂草，像被风吹乱的草檐
 *     · 屋脊加厚成一道脊
 *  3. 大窗口 —— 木框 + 深色内部 + 窗外木吧台，一眼能看进操作区
 *  4. 墙面布帘 —— 白布上印咖啡杯与 COFFEE / DRINKS 字样
 */

/** 墙高、砖块尺寸 —— 15 / 1.25 = 正好 12 行砖 */
const WALL_H = CAFE.wallH
const BRICK_W = 2.5
const BRICK_H = 1.25

/**
 * 屋顶坡度。
 *
 * 这里放弃了"一级级台阶堆出坡面"的做法 —— 那样每 0.25 世界单位就是一个台阶，
 * 在屏幕上是十来像素的方块，整个屋顶会变成 Minecraft。
 *
 * 改成：用两块**带倾角的整板**当屋面（boxRot 支持任意姿态），
 * 再在斜面上密密地贴一层小尺寸草秆。屋面是光滑的，草感来自草秆本身，
 * 既保住了体素的手工感，又没有台阶。
 */
const ROOF_RUN = CAFE.roofZ1 - CAFE.ridgeZ
const ROOF_RISE = CAFE.ridgeTopY - CAFE.eaveTopY
const THETA = Math.atan2(ROOF_RISE, ROOF_RUN) // 屋面倾角
const COS_T = Math.cos(THETA)
const SIN_T = Math.sin(THETA)
const SLOPE_LEN = Math.hypot(ROOF_RUN, ROOF_RISE)
/** 屋面沿竖直方向的厚度（法线厚度换算到竖直方向） */
const ROOF_V = CAFE.roofThick / COS_T

/** 坡面在某个 z 处的顶面高度 */
function roofTopAt(z: number): number {
  return CAFE.ridgeTopY - (ROOF_RISE / ROOF_RUN) * Math.abs(z - CAFE.ridgeZ)
}
/** 坡面在某个 z 处的底面高度 */
function roofBottomAt(z: number): number {
  return roofTopAt(z) - ROOF_V
}

export function buildCafeBuilding(ctx: BuildCtx): void {
  const { b, occ, group } = ctx

  /* ==================== 1. 墙体 ==================== */
  const openings: Opening[] = [
    { ...OPENINGS.window },
    { ...OPENINGS.door },
    { ...OPENINGS.sideWindow },
  ]
  createVoxelBuilding(b, {
    x0: CAFE.x0, x1: CAFE.x1, z0: CAFE.z0, z1: CAFE.z1,
    wallH: WALL_H,
    brickW: BRICK_W, brickH: BRICK_H,
    brick: PAL.wallBrick,
    core: PAL.wallCore,
    openings,
  })

  // 墙脚：一圈深色勒脚，让房子"坐"在地上而不是浮着
  b.box(CAFE.x0, 0, CAFE.z0, CAFE.x1, 0.9, CAFE.z1, PAL.wallGrout)

  /* ==================== 2. 山墙（把阁楼两端封上） ==================== */
  buildGables(ctx)

  /* ==================== 3. 厚麦草屋顶 ==================== */
  buildThatchRoof(ctx)

  /* ==================== 4. 窗口 ==================== */
  buildWindow(ctx)

  /* ==================== 5. 门 ==================== */
  buildDoor(ctx)

  /* ==================== 6. 墙面布帘招牌 ==================== */
  buildBanners(ctx, group)

  /* ==================== 7. 屋顶旗杆 ==================== */
  buildFlagpole(ctx, group)

  /* ==================== 8. 门口碎件：黑板、花盆、壁架 ==================== */
  buildDoorSideProps(ctx, group)

  /* ==================== 占地登记 ==================== */
  // 只挡住建筑本身和门前一小条 —— 挡太宽麦田会缺一大块
  occ.rect(CAFE.x0 - 3, CAFE.z0 - 3, CAFE.x1 + 3, CAFE.z1 + 11, 0)
}

/* ====================================================================== */
/* 屋顶                                                                    */
/* ====================================================================== */

/**
 * 厚茅草屋顶。
 *
 * 施工顺序（和真搭屋顶一样）：
 *   ① 两块带倾角的整板做屋面（前坡、后坡），光滑、没有台阶
 *   ② 斜面上密密贴一层细草秆 —— 一束草一个颜色，连成一条，外沿随机多伸出去
 *   ③ 四条檐口挂下垂草，边缘因此变得毛糙不规则
 *   ④ 最后压一道加厚的屋脊
 *   ⑤ 檐下补一块深色封檐板，从下往上看不会看到空壳
 */
function buildThatchRoof(ctx: BuildCtx): void {
  const { b } = ctx

  const xMid = (CAFE.roofX0 + CAFE.roofX1) / 2
  const xSpan = CAFE.roofX1 - CAFE.roofX0

  /* ---- ① 两块屋面斜板 ---- */
  // 前坡：屋脊 → 前檐。局部 +Z 沿坡面朝下前方，所以绕 X 转 +θ
  const fMidZ = (CAFE.ridgeZ + CAFE.roofZ1) / 2
  const fMidY = (CAFE.ridgeTopY + CAFE.eaveTopY) / 2
  b.boxRot(
    xMid, fMidY - (CAFE.roofThick / 2) * COS_T, fMidZ - (CAFE.roofThick / 2) * SIN_T,
    xSpan, CAFE.roofThick, SLOPE_LEN,
    THETA, 0, 0,
    PAL.thatchRoot,
  )
  // 后坡：屋脊 → 后檐，绕 X 转 -θ
  const bMidZ = (CAFE.ridgeZ + CAFE.roofZ0) / 2
  b.boxRot(
    xMid, fMidY - (CAFE.roofThick / 2) * COS_T, bMidZ + (CAFE.roofThick / 2) * SIN_T,
    xSpan, CAFE.roofThick, SLOPE_LEN,
    -THETA, 0, 0,
    PAL.thatchRoot,
  )
  // 山墙侧的端面封板（否则从两端会看进"夹心"）
  for (const ex of [CAFE.roofX0, CAFE.roofX1]) {
    b.boxRot(
      ex - Math.sign(ex) * 0.6, fMidY - (CAFE.roofThick / 2) * COS_T, fMidZ - (CAFE.roofThick / 2) * SIN_T,
      1.2, CAFE.roofThick, SLOPE_LEN,
      THETA, 0, 0,
      PAL.thatchDark,
    )
    b.boxRot(
      ex - Math.sign(ex) * 0.6, fMidY - (CAFE.roofThick / 2) * COS_T, bMidZ + (CAFE.roofThick / 2) * SIN_T,
      1.2, CAFE.roofThick, SLOPE_LEN,
      -THETA, 0, 0,
      PAL.thatchDark,
    )
  }

  /* ---- ② 斜面上的草秆 ---- */
  const STRAND_W = 0.55 // 草秆宽度（网格单位）
  const cols = Math.round(xSpan / STRAND_W)
  for (let c = 0; c < cols; c++) {
    const x = CAFE.roofX0 + c * STRAND_W

    for (const slope of [1, -1] as const) {
      // slope = 1 前坡，-1 后坡
      const zRidge = CAFE.ridgeZ
      const zEave = slope === 1 ? CAFE.roofZ1 : CAFE.roofZ0
      let travel = ctx.b.rnd() * 3 // 沿坡面已走的距离
      while (travel < SLOPE_LEN) {
        const len = 2.2 + ctx.b.rnd() * 3.6
        // 外沿随机多伸出去一点，屋顶边缘就不会是齐刷刷一条线
        const over = travel + len > SLOPE_LEN ? ctx.b.rnd() * 2.2 : 0
        const mid = (travel + Math.min(SLOPE_LEN, travel + len + over)) / 2
        const s = mid / SLOPE_LEN // 0 = 屋脊，1 = 檐口

        const zz = zRidge + (zEave - zRidge) * s
        const yy = CAFE.ridgeTopY + (CAFE.eaveTopY - CAFE.ridgeTopY) * s
        // 沿法线往外抬一点，草秆就"长"在屋面上；抬多抬少让屋面有蓬松起伏
        const lift = 0.35 + ctx.b.rnd() * 0.75
        const nx = 0
        const ny = COS_T * lift
        const nz = slope === 1 ? SIN_T * lift : -SIN_T * lift

        const tone = 0.84 + ctx.b.rnd() * 0.34
        const base = ctx.b.rnd() < 0.28 ? PAL.thatchMid : PAL.thatchLit
        const col = shade(base, tone)

        b.boxRot(
          x + STRAND_W / 2, yy + ny, zz + nz,
          STRAND_W, 0.75, Math.min(SLOPE_LEN, travel + len + over) - travel,
          slope === 1 ? THETA : -THETA, 0, 0,
          col,
        )
        travel += len + 0.25 + ctx.b.rnd() * 1.1
      }
    }
  }

  /* ---- ③ 檐口垂草 ---- */
  // 前檐 / 后檐（沿 X 方向）
  for (let x = CAFE.roofX0; x < CAFE.roofX1; x += STRAND_W) {
    for (const edgeZ of [CAFE.roofZ1, CAFE.roofZ0]) {
      if (b.rnd() > 0.66) continue
      const top = Math.round(roofTopAt(edgeZ))
      const drop = 1 + Math.floor(b.rnd() * 4)
      const col = shade(PAL.thatchMid, 0.82 + b.rnd() * 0.34)
      const w = STRAND_W * (1 + Math.floor(b.rnd() * 2))
      b.box(x, top - drop, edgeZ - (edgeZ === CAFE.roofZ1 ? 1 : 0), x + w, top + 1, edgeZ + 1, col)
    }
  }
  // 两端山墙檐（沿 Z 方向）
  for (let z = CAFE.roofZ0; z < CAFE.roofZ1; z += STRAND_W) {
    for (const edgeX of [CAFE.roofX0, CAFE.roofX1]) {
      if (b.rnd() > 0.72) continue
      const top = Math.round(roofTopAt(z + 0.5))
      const drop = 1 + Math.floor(b.rnd() * 3)
      const col = shade(PAL.thatchMid, 0.82 + b.rnd() * 0.3)
      const sx = edgeX === CAFE.roofX0 ? 0 : -1
      b.box(edgeX + sx, top - drop, z, edgeX + sx + 1, top + 1, z + STRAND_W, col)
    }
  }

  /* ---- ④ 屋脊压顶 ---- */
  const ridgeTop = CAFE.ridgeTopY
  for (let x = CAFE.roofX0; x < CAFE.roofX1; x += 1.2) {
    const h = 1 + b.rnd() * 1.8
    b.box(x, ridgeTop - 1.2, CAFE.ridgeZ - 2.4, x + 1.2, ridgeTop + h, CAFE.ridgeZ + 2.4,
      shade(PAL.thatchTip, 0.88 + b.rnd() * 0.24))
  }

  /* ---- ⑤ 檐下封檐板 ---- */
  for (let x = CAFE.roofX0; x < CAFE.roofX1; x += 3) {
    for (const [ez, dir] of [[CAFE.roofZ1, 1], [CAFE.roofZ0, -1]] as const) {
      const zz = ez - dir * 4
      const bottom = roofBottomAt(zz)
      b.box(x, bottom - 1.1, zz - 1.5, x + 3, bottom, zz + 1.5, shade(PAL.woodDark, 1.3))
    }
  }
}

/**
 * 山墙：把墙顶到屋顶底面之间的三角区用砖砌实。
 * 不做这一步，从窗口看进去就能望穿阁楼看到天空。
 */
function buildGables(ctx: BuildCtx): void {
  const { b } = ctx
  const T = CAFE.wallT
  for (const [gx0, gx1] of [[CAFE.x0, CAFE.x0 + T], [CAFE.x1 - T, CAFE.x1]] as const) {
    for (let z = CAFE.z0; z < CAFE.z1; z++) {
      const bottom = Math.round(roofBottomAt(z + 0.5))
      if (bottom <= WALL_H) continue
      b.fill(gx0, WALL_H, z, gx1, bottom, z + 1, PAL.wallBrick, {
        jitter: 0.05,
        colorAt: (x, y, zz, base) =>
          // 让山墙也保持"砌砖"的横向分层感
          (Math.floor((y - WALL_H) / BRICK_H) % 2 === 0
            ? shade(base, 0.98)
            : base),
      })
    }
  }
}

/* ====================================================================== */
/* 门窗                                                                    */
/* ====================================================================== */

/** 大窗口：木框 + 深色内部 + 窗下木吧台（客人坐在窗外点单的那种） */
function buildWindow(ctx: BuildCtx): void {
  const { b } = ctx
  const { a0, a1, y0, y1 } = OPENINGS.window
  const W = CAFE.wallT
  const face = CAFE.z1
  const frame = PAL.woodFrame

  // 窗框：上下横档 + 两侧边梃，都比墙面凸出一点
  b.box(a0 - 1.2, y0 - 1.2, face, a1 + 1.2, y0, face + 1.6, PAL.woodTrim)        // 下框
  b.box(a0 - 1.2, y1, face, a1 + 1.2, y1 + 1.4, face + 1.6, PAL.woodTrim)         // 上框
  b.box(a0 - 1.2, y0, face, a0, y1, face + 1.6, frame)                            // 左边梃
  b.box(a1, y0, face, a1 + 1.2, y1, face + 1.6, frame)                            // 右边梃
  // 中横档：参考图里窗口中部有道木条
  b.box(a0, y0 + 3.4, face, a1, y0 + 4.2, face + 1.4, frame)
  // 竖向分格
  b.box(-3, y0, face, -2.4, y1, face + 1.2, frame)

  // 窗内壁：一圈深木衬板，形成"窗洞"的厚度感
  const inner = shade(PAL.woodDark, 0.85)
  b.box(a0, y0, face - W - 1.5, a1, y0 + 0.6, face, inner)
  b.box(a0, y1 - 0.5, face - W - 1.5, a1, y1, face, inner)
  b.box(a0, y0, face - W - 1.5, a0 + 0.6, y1, face, inner)
  b.box(a1 - 0.6, y0, face - W - 1.5, a1, y1, face, inner)

  // 窗外吧台：一块厚木板挑出来，上面摆杯子
  b.box(a0 - 2.5, y0 - 2.6, face, a1 + 2.5, y0 - 1.3, face + 3.6, PAL.woodLit)
  for (const bx of [a0 - 1.5, -3, a1 + 1.5]) {
    b.box(bx, 0, face + 2, bx + 1.6, y0 - 2.6, face + 3.4, PAL.wood)
  }
  // 吧台上的杯子（光滑质感，一眼看出是陶瓷）
  for (let i = 0; i < 7; i++) {
    const cx = a0 + 1 + b.rnd() * (a1 - a0 - 2)
    const tone = b.rnd() < 0.5 ? PAL.ceramic : PAL.counterTop
    b.box(cx, y0 - 1.3, face + 1, cx + 1.6, y0 - 1.3 + 1.8, face + 2.6, tone, 'gloss')
  }

  // 窗下长木凳
  b.box(-8, 0, face + 1.5, 2, 2.4, face + 4.5, PAL.woodLit)
  b.box(-8, 0, face + 1.5, -7.6, 2.4, face + 4.5, PAL.wood)

  // 窗内暖光（自发光桶）—— 让窗口在阴影里也是亮的
  b.box(a0 + 1, y0 + 0.8, face - W - 1, a1 - 1, y0 + 2.4, face - W - 0.4, 0xffd9a0, 'glow')
}

/** 木门：半开的门扇 + 门框 + 门槛石 */
function buildDoor(ctx: BuildCtx): void {
  const { b } = ctx
  const { a0, a1, y1 } = OPENINGS.door
  const face = CAFE.z1
  const frame = PAL.woodFrame

  // 门框
  b.box(a0 - 1.3, 0, face, a0, y1 + 1.4, face + 1.6, frame)
  b.box(a1, 0, face, a1 + 1.3, y1 + 1.4, face + 1.6, frame)
  b.box(a0 - 1.3, y1, face, a1 + 1.3, y1 + 1.6, face + 1.6, PAL.woodTrim)
  // 门楣上方的小窗（气窗）
  b.box(a0 + 1, y1 - 2.6, face - 1, a1 - 1, y1 - 0.6, face - 0.2, PAL.glassDeep)

  // 半开门扇：绕右侧门轴向内旋开 62°，用绕 Y 轴旋转的实例做
  const ang = Math.PI * 0.345
  const w = 5.6
  const hingeX = a1
  const hingeZ = face - CAFE.wallT * 0.5
  const cx = hingeX - Math.cos(ang) * (w / 2)
  const cz = hingeZ - Math.sin(ang) * (w / 2)
  b.box(cx - w / 2, 0.2, cz - 0.5, cx + w / 2, y1 - 0.4, cz + 0.5, PAL.wood, 'matte', ang)
  // 门上的木格栅
  for (let i = 1; i <= 2; i++) {
    const t = (i / 3) * w - w / 2
    b.box(
      cx + t - 0.35, 0.4, cz - 0.65,
      cx + t + 0.35, y1 - 0.6, cz + 0.65,
      shade(PAL.wood, 0.82), 'matte', ang,
    )
  }
  b.box(cx + w * 0.32, y1 * 0.45, cz - 0.7, cx + w * 0.42, y1 * 0.55, cz + 0.7, PAL.steelDark, 'matte', ang)

  // 门槛石
  b.box(a0 - 1.5, -0.4, face, a1 + 1.5, 0.6, face + 2, PAL.pavingAlt)

  // 门内暖光
  b.box(a0 + 1.5, y1 - 5, face - 6, a1 - 1.5, y1 - 3.4, face - 4, 0xffcf8a, 'glow')
}

/* ====================================================================== */
/* 布帘招牌 / 旗子 / 门口小物                                              */
/* ====================================================================== */

/** 把一块布帘贴在墙上（平面 + 程序化布纹贴图，双面可见） */
function hangBanner(
  group: THREE.Group,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  tex: THREE.Texture,
): void {
  const w = (a1 - a0) * 0.25
  const h = (y1 - y0) * 0.25
  const geo = new THREE.PlaneGeometry(w, h, 4, 4)
  // 让布面有一点自然的下垂弧度
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) / w) + 0.5
    const v = 1 - (pos.getY(i) / h + 0.5)
    pos.setZ(i, Math.sin(u * Math.PI) * 0.02 + v * 0.012)
  }
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(((a0 + a1) / 2) * 0.25, ((y0 + y1) / 2) * 0.25, (CAFE.z1 + 1.1) * 0.25)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function buildBanners(ctx: BuildCtx, group: THREE.Group): void {
  const { b } = ctx
  // 主招牌：咖啡杯 + COFFEE，挂在窗口左上方（参考图里它压住窗口左半边）
  hangBanner(group, -11.5, -4.5, 6, 14.4, makeSignTexture('coffee'))
  // 左侧竖排 DRINKS
  hangBanner(group, -18.6, -14.4, 5, 13.6, makeSignTexture('drinks'))
  // 门右侧的小布帘
  hangBanner(group, 15.2, 18.6, 5.2, 12.6, makeSignTexture('icon'))

  // 挂布帘的木棍（两端插进墙里）
  for (const [a, bb, yy] of [
    [-12.6, -3.4, 14.4],
    [-19.4, -13.6, 13.6],
    [14.4, 19.4, 12.6],
  ] as const) {
    b.box(a, yy, CAFE.z1, bb, yy + 0.7, CAFE.z1 + 1.4, PAL.woodDark)
    b.box(a - 0.4, yy - 0.5, CAFE.z1, a + 0.4, yy + 1.2, CAFE.z1 + 1.2, PAL.woodDark)
    b.box(bb - 0.4, yy - 0.5, CAFE.z1, bb + 0.4, yy + 1.2, CAFE.z1 + 1.2, PAL.woodDark)
  }
}

/** 屋顶旗杆 + 小旗 */
function buildFlagpole(ctx: BuildCtx, group: THREE.Group): void {
  const { b } = ctx
  const px = -14
  const pz = 4
  const baseY = Math.round(roofTopAt(pz)) + 1

  b.box(px - 0.7, baseY, pz - 0.7, px + 0.7, baseY + 9, pz + 0.7, PAL.woodDark)
  b.box(px - 1.4, baseY + 8, pz - 1.4, px + 1.4, baseY + 9.4, pz + 1.4, PAL.wood)
  b.box(px - 0.4, baseY + 9, pz - 0.4, px + 0.4, baseY + 12, pz + 0.4, PAL.steelDark, 'gloss')
  // 顶端的圆球
  b.box(px - 0.8, baseY + 12, pz - 0.8, px + 0.8, baseY + 13.4, pz + 0.8, PAL.woodLit)

  // 旗面：一个带轻微起伏的平面
  const w = 1.5
  const h = 1.0
  const geo = new THREE.PlaneGeometry(w, h, 8, 3)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w + 0.5
    pos.setZ(i, Math.sin(u * Math.PI * 2.2) * 0.05 * u + Math.sin(u * 9) * 0.008)
  }
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    map: makeFlagTexture(),
    roughness: 0.85,
    side: THREE.DoubleSide,
  })
  const flag = new THREE.Mesh(geo, mat)
  flag.position.set((px + 3) * 0.25, (baseY + 10.4) * 0.25, pz * 0.25)
  flag.rotation.z = -0.06
  flag.castShadow = true
  group.add(flag)
}

/** 门口的小黑板菜单、盆栽、窗边木架 */
function buildDoorSideProps(ctx: BuildCtx, group: THREE.Group): void {
  const { b } = ctx
  const face = CAFE.z1

  /* ---- 小黑板 A 字架（门的右侧、铺装地上，参考图的固定位置） ---- */
  const bx0 = 16.5
  const bz = face + 4.5
  // 围边框
  b.box(bx0, 3, bz - 0.6, bx0 + 8.4, 3.8, bz + 0.7, PAL.chalkFrame)
  b.box(bx0, 3.8, bz - 0.6, bx0 + 0.9, 15, bz + 0.7, PAL.chalkFrame)
  b.box(bx0 + 7.5, 3.8, bz - 0.6, bx0 + 8.4, 15, bz + 0.7, PAL.chalkFrame)
  b.box(bx0, 14.1, bz - 0.6, bx0 + 8.4, 15, bz + 0.7, PAL.chalkFrame)
  // 板面
  b.box(bx0 + 0.9, 3.8, bz - 0.2, bx0 + 7.5, 14.1, bz + 0.3, PAL.chalkboard)
  // 支架腿（八字张开，像 A 字架）
  b.box(bx0 + 0.8, 0, bz + 0.5, bx0 + 1.9, 3.8, bz + 1.6, PAL.chalkFrame)
  b.box(bx0 + 6.6, 0, bz + 0.5, bx0 + 7.7, 3.8, bz + 1.6, PAL.chalkFrame)
  b.box(bx0 + 0.8, 0, bz - 1.5, bx0 + 1.9, 3.8, bz - 0.4, PAL.chalkFrame)
  b.box(bx0 + 6.6, 0, bz - 1.5, bx0 + 7.7, 3.8, bz - 0.4, PAL.chalkFrame)

  // 黑板贴图平面
  const boardW = 6.6 * 0.25
  const boardH = 10.3 * 0.25
  const boardGeo = new THREE.PlaneGeometry(boardW, boardH)
  const boardMat = new THREE.MeshStandardMaterial({
    map: makeChalkboardTexture(),
    roughness: 0.9,
    side: THREE.DoubleSide,
  })
  const board = new THREE.Mesh(boardGeo, boardMat)
  board.position.set((bx0 + 4.2) * 0.25, ((3.8 + 14.1) / 2) * 0.25, (bz + 0.35) * 0.25)
  board.castShadow = true
  board.receiveShadow = true
  group.add(board)

  /* ---- 门口盆栽 ---- */
  const pots: Array<[number, number, number]> = [
    [19, face + 7.5, 0.72],
    [16.6, face + 1.8, 0.55],
    [4.5, face + 5.5, 0.6],
  ]
  for (const [px, pz, s] of pots) {
    const h = Math.round(6 * s)
    const w = Math.round(4 * s)
    // 陶盆（下窄上宽）
    b.box(px - w / 2 + 1, 0, pz - w / 2 + 1, px + w / 2 - 1, h * 0.5, pz + w / 2 - 1, PAL.potDark)
    b.box(px - w / 2, h * 0.5, pz - w / 2, px + w / 2, h, pz + w / 2, PAL.pot)
    // 叶团（体量压小，颜色压低饱和，别抢建筑）
    for (let i = 0; i < 12; i++) {
      const lx = px + (b.rnd() - 0.5) * w * 1.7
      const lz = pz + (b.rnd() - 0.5) * w * 1.7
      const ly = h + b.rnd() * 4.5 * s
      const size = 1.1 + b.rnd() * 1.3
      b.box(lx, ly, lz, lx + size, ly + size, lz + size,
        shade(b.rnd() < 0.45 ? PAL.plant : PAL.plantLit, 0.78 + b.rnd() * 0.36))
    }
    // 几朵小白花
    for (let i = 0; i < 3; i++) {
      const lx = px + (b.rnd() - 0.5) * w * 1.6
      const lz = pz + (b.rnd() - 0.5) * w * 1.6
      b.box(lx, h + 2 + b.rnd() * 4 * s, lz, lx + 1, h + 2.7 + b.rnd() * 4 * s, lz + 1, PAL.flowerWhite)
    }
  }

  /* ---- 窗边木架：挂几个杯子 ---- */
  b.box(6.6, 6, face + 0.2, 8.2, 6.8, face + 1.6, PAL.wood)
  for (let i = 0; i < 3; i++) {
    b.box(6.9, 5.6, face + 0.4 + i * 0.001, 7.9, 6, face + 1.4, PAL.ceramic, 'gloss')
  }
}
