/**
 * 数字孪生公共类型
 */

/** 可交互资产的信息卡数据 */
export interface AssetInfo {
  /** 语义化 id，如 coffee_machine / outdoor_umbrella */
  id: string
  /** 展示名 */
  name: string
  /** 信息卡键值行 */
  rows: Array<{ label: string; value: string }>
}

/** HUD 遥测数据 */
export interface TwinStats {
  fps: number
  drawCalls: number
  triangles: number
  wheatCount: number
  temperature: number
  customers: number
  coffeeCups: number
  wind: number
}

/** 相机预设 */
export type ViewPreset = 'reference' | 'overview' | 'door' | 'window'
