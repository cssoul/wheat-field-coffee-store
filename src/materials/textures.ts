import * as THREE from 'three'

/**
 * 程序化贴图库 —— 全部用 Canvas 2D 现画，项目零外部资源。
 *
 * 只有"必须画出文字/图案"的东西才走贴图（布帘招牌、黑板菜单、小旗子）；
 * 砖墙、茅草、麦田、木料一律用体素色块表现，避免贴图把体素风弄脏。
 */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('无法创建 2D canvas 上下文')
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement, aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}

/** 在画布上铺一层极淡的织物纹理，让白布不生硬 */
function clothNoise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.05) {
  ctx.save()
  ctx.globalAlpha = alpha
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? '#ffffff' : '#c9c0ae'
    ctx.fillRect(0, y, w, 1)
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#bdb4a2'
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
  }
  ctx.restore()
}

/** 画一个简笔咖啡杯图标（杯身 + 把手 + 两缕热气） */
function coffeeCup(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * 0.09
  ctx.lineCap = 'round'

  // 杯身（上宽下窄的梯形）
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.5, cy - s * 0.32)
  ctx.lineTo(cx + s * 0.5, cy - s * 0.32)
  ctx.lineTo(cx + s * 0.34, cy + s * 0.5)
  ctx.lineTo(cx - s * 0.34, cy + s * 0.5)
  ctx.closePath()
  ctx.fill()

  // 把手
  ctx.beginPath()
  ctx.arc(cx + s * 0.62, cy + s * 0.04, s * 0.22, -Math.PI * 0.5, Math.PI * 0.5)
  ctx.stroke()

  // 热气
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.16, cy - s * 0.5)
  ctx.quadraticCurveTo(cx - s * 0.32, cy - s * 0.72, cx - s * 0.12, cy - s * 0.95)
  ctx.moveTo(cx + s * 0.14, cy - s * 0.5)
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.74, cx + s * 0.1, cy - s * 0.98)
  ctx.lineWidth = s * 0.07
  ctx.stroke()
  ctx.restore()
}

export type SignKind = 'coffee' | 'drinks' | 'icon'

/**
 * 白布帘招牌（挂在墙上的白色长条布）。
 * coffee: 咖啡杯图标 + COFFEE 字样（窗口上方主招牌）
 * drinks: 竖排 DRINKS 字样（窗口左侧）
 * icon:   只有小图标（门右侧那块）
 */
export function makeSignTexture(kind: SignKind): THREE.CanvasTexture {
  const W = kind === 'drinks' ? 128 : 256
  const H = kind === 'drinks' ? 320 : 256
  const [c, ctx] = makeCanvas(W, H)

  // 布底：暖白 + 顶部略暗（模拟垂坠阴影）
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#efe8db')
  g.addColorStop(0.12, '#eae2d4')
  g.addColorStop(1, '#ded5c4')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  clothNoise(ctx, W, H, 0.07)

  const ink = '#3b332a'

  if (kind === 'coffee') {
    coffeeCup(ctx, W * 0.5, H * 0.36, W * 0.3, ink)
    ctx.save()
    ctx.fillStyle = ink
    ctx.font = 'bold 62px Georgia, "Times New Roman", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '6px'
    ctx.fillText('COFFEE', W * 0.5, H * 0.76)
    ctx.restore()
  } else if (kind === 'drinks') {
    coffeeCup(ctx, W * 0.5, H * 0.15, W * 0.44, ink)
    ctx.save()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 40px Georgia, "Times New Roman", serif'
    const word = 'DRINKS'
    for (let i = 0; i < word.length; i++) {
      ctx.fillText(word[i], W * 0.5, H * 0.33 + i * (H * 0.62) / word.length)
    }
    ctx.restore()
  } else {
    coffeeCup(ctx, W * 0.5, H * 0.34, W * 0.34, ink)
    ctx.save()
    ctx.fillStyle = ink
    ctx.font = 'italic 26px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('open', W * 0.5, H * 0.68)
    ctx.restore()
  }

  // 布面横向褶皱
  ctx.save()
  ctx.globalAlpha = 0.1
  for (let i = 0; i < 7; i++) {
    const y = (H / 7) * (i + Math.random() * 0.6)
    ctx.fillStyle = '#8a7f6c'
    ctx.fillRect(0, y, W, 2 + Math.random() * 2)
  }
  ctx.restore()

  return toTexture(c)
}

/** 小黑板菜单：深绿黑板 + 木框外圈 + 手写菜单字 */
export function makeChalkboardTexture(): THREE.CanvasTexture {
  const W = 256
  const H = 320
  const [c, ctx] = makeCanvas(W, H)

  ctx.fillStyle = '#2f3630'
  ctx.fillRect(0, 0, W, H)
  // 黑板擦痕
  ctx.save()
  ctx.globalAlpha = 0.06
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.random() * W, Math.random() * H, 10 + Math.random() * 50, 3 + Math.random() * 6)
  }
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#e8ece4'
  ctx.textAlign = 'center'
  ctx.font = 'bold 34px Georgia, serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('MENU', W * 0.5, 52)

  ctx.font = '19px Georgia, serif'
  ctx.textAlign = 'left'
  const items: [string, string][] = [
    ['Latte', '22'],
    ['Americano', '18'],
    ['Cappuccino', '24'],
    ['Cold Brew', '26'],
    ['Wheat Tea', '16'],
  ]
  items.forEach(([name, price], i) => {
    const y = 104 + i * 34
    ctx.fillText(name, 26, y)
    ctx.textAlign = 'right'
    ctx.fillText(price, W - 26, y)
    ctx.textAlign = 'left'
    ctx.globalAlpha = 0.35
    ctx.fillRect(26, y + 8, W - 52, 1)
    ctx.globalAlpha = 1
  })

  ctx.textAlign = 'center'
  ctx.font = 'italic 15px Georgia, serif'
  ctx.globalAlpha = 0.7
  ctx.fillText('· fresh roasted ·', W * 0.5, H - 26)
  ctx.restore()

  return toTexture(c)
}

/** 屋顶旗子：深灰蓝旗面上画一个咖啡杯徽记 */
export function makeFlagTexture(): THREE.CanvasTexture {
  const W = 200
  const H = 130
  const [c, ctx] = makeCanvas(W, H)
  ctx.fillStyle = '#3c4450'
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#ffffff'
  for (let x = 0; x < W; x += 26) ctx.fillRect(x, 0, 13, H)
  ctx.restore()
  coffeeCup(ctx, W * 0.5, H * 0.5, 42, '#e8dcc6')
  return toTexture(c)
}

/** 一块柔和的圆形阴影贴图（贴在木质平台/伞下，填充软阴影层） */
export function makeSoftShadowTexture(): THREE.CanvasTexture {
  const S = 128
  const [c, ctx] = makeCanvas(S, S)
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(40,32,18,0.55)')
  g.addColorStop(0.55, 'rgba(40,32,18,0.22)')
  g.addColorStop(1, 'rgba(40,32,18,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const t = toTexture(c)
  return t
}

/**
 * 天空渐变贴图（equirectangular）。
 *
 * 用作 scene.background 和 PMREM 环境贴图的源。
 * 用贴图而不是自己写天空球 ShaderMaterial，是因为 ShaderMaterial 的输出
 * 不在 three 的色调映射/色彩空间管线里，很容易出现"天空和场景亮度对不上"
 * 的灰蓝天。交给内建背景着色器，色彩一致性由 three 保证。
 *
 * 注意 equirect 的 v 坐标：v=1 是天顶、v=0 是天底、v=0.5 是地平线。
 * CanvasTexture 默认 flipY=true，所以画布**顶行**就是天顶。
 *
 * 相机是近地平线的低视角（俯角 5° 左右），画面里真正能看到的天空只有
 * 地平线以上 0~13° 这一条窄带，也就是 v ∈ [0.43, 0.50]。
 * 所以发白的"大气散射带"必须压得很窄（只占最后 1.5°），
 * 否则整片天空都会糊成灰白 —— 这正是参考图那种干净蓝天的要害。
 */
export function makeSkyTexture(): THREE.CanvasTexture {
  const W = 64
  const H = 512
  const [c, ctx] = makeCanvas(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0.00, '#1b6aa8') // 天顶：深晴蓝
  g.addColorStop(0.18, '#2f8bc6')
  g.addColorStop(0.32, '#46a0d1')
  g.addColorStop(0.40, '#5fb0d6') // 画面顶部（约 18° 仰角）
  g.addColorStop(0.452, '#79bcd9') // 画面中部（约 8°）
  g.addColorStop(0.483, '#a3cddc')
  g.addColorStop(0.497, '#cfdfe2') // 地平线：很窄的一条发白散射带
  g.addColorStop(0.505, '#dae1de')
  // 地平线以下：取景仰起来时会看到沙盘底座外面这一片。
  // 提示词禁止任何背景环境，所以这里不做地面，只给一层中性灰的"摄影棚背景"，
  // 让沙盘像是摆在一块柔光布上 —— 比土绿色干净，也不会喧宾夺主。
  g.addColorStop(0.60, '#ccd2ce')
  g.addColorStop(1.00, '#aeb5b0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const t = toTexture(c, 1)
  t.mapping = THREE.EquirectangularReflectionMapping
  return t
}
