<script setup lang="ts">
/**
 * App —— 页面骨架：3D 视口 + 状态 HUD + 资产信息卡 + 底部控制条。
 * UI 全部浮在画布上，不破坏场景视觉。
 */
import { reactive, ref } from 'vue'

import AssetInfoCard from './components/AssetInfoCard.vue'
import StatusHUD from './components/StatusHUD.vue'
import TwinViewport from './components/TwinViewport.vue'
import type { WheatCafeTwin } from './three/WheatCafeTwin'
import type { AssetInfo, TwinStats, ViewPreset } from './types/twin'

const twin = ref<WheatCafeTwin | null>(null)
const selected = ref<AssetInfo | null>(null)
const wind = ref(1)
const shadows = ref(true)

const stats = reactive<TwinStats>({
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  wheatCount: 0,
  temperature: 0,
  customers: 0,
  coffeeCups: 128,
  wind: 1,
})

// 遥测缓慢漂移（温度/客流的"活"感）
setInterval(() => {
  stats.temperature += 0.07
  stats.customers += 0.05
}, 1000)

function onReady(t: WheatCafeTwin): void {
  twin.value = t
  stats.wheatCount = t.wheatCount
  t.onFrame = (s) => {
    stats.fps = s.fps
    stats.drawCalls = s.drawCalls
    stats.triangles = s.triangles
  }
  t.onSelect = (info) => {
    selected.value = info
  }
}

const presets: Array<{ key: ViewPreset; label: string }> = [
  { key: 'reference', label: '参考图视角' },
  { key: 'overview', label: '桌面俯瞰' },
  { key: 'door', label: '门前特写' },
  { key: 'window', label: '窗口吧台' },
]

function pickPreset(k: ViewPreset): void {
  twin.value?.setPreset(k)
}

function setWind(): void {
  twin.value?.setWind(wind.value)
  stats.wind = wind.value
}

function closeCard(): void {
  selected.value = null
  twin.value?.clearSelect()
}
</script>

<template>
  <div class="stage">
    <TwinViewport @ready="onReady" />
    <StatusHUD :stats="stats" />
    <AssetInfoCard v-if="selected" :info="selected" @close="closeCard" />

    <div class="controls glass">
      <div class="group">
        <button
          v-for="p in presets"
          :key="p.key"
          class="btn"
          @click="pickPreset(p.key)"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="group slider-group">
        <span class="lbl">风力</span>
        <input v-model.number="wind" type="range" min="0" max="3" step="0.1" @input="setWind" />
        <span class="val mono">{{ wind.toFixed(1) }}</span>
      </div>
    </div>

    <div class="hint">拖拽旋转 · 滚轮缩放 · 点击设备查看数字孪生信息</div>
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
}

.controls {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 10px 18px;
}

.group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  border: 1px solid rgba(31, 122, 82, 0.35);
  background: rgba(255, 255, 255, 0.7);
  color: #275a43;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover {
  background: #1f7a52;
  border-color: #1f7a52;
  color: #fff;
}

.slider-group {
  gap: 10px;
}
.lbl {
  font-size: 12px;
  color: #4b5a51;
}
.val {
  font-size: 11px;
  color: #1f7a52;
  min-width: 26px;
}
input[type='range'] {
  width: 110px;
  accent-color: #1f7a52;
}

.hint {
  position: absolute;
  bottom: 20px;
  right: 22px;
  font-size: 11px;
  color: rgba(47, 58, 51, 0.55);
  letter-spacing: 0.05em;
  user-select: none;
  pointer-events: none;
}
</style>
