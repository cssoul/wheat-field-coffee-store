<script setup lang="ts">
/**
 * StatusHUD —— 左上角数字孪生遥测（半透明玻璃 + 绿色科技线条风）。
 */
import { computed } from 'vue'

import type { TwinStats } from '@/types/twin'

const props = defineProps<{ stats: TwinStats }>()

const temp = computed(() => (24 + Math.sin(props.stats.temperature * 0.13 + 1) * 0.6).toFixed(1))
const customers = computed(() => String(Math.round(6 + Math.sin(props.stats.customers * 0.09) * 2)).padStart(2, '0'))
const tris = computed(() => (props.stats.triangles / 1000).toFixed(1) + 'k')
</script>

<template>
  <div class="hud">
    <div class="title">CAFE DIGITAL TWIN</div>
    <div class="row"><span>STATUS</span><b class="ok">OPEN</b></div>
    <div class="row"><span>TEMPERATURE</span><b>{{ temp }}℃</b></div>
    <div class="row"><span>CUSTOMERS</span><b>{{ customers }}</b></div>
    <div class="row"><span>COFFEE MACHINE</span><b class="ok">ACTIVE</b></div>
    <div class="divider" />
    <div class="row dim"><span>FPS</span><b>{{ stats.fps }}</b></div>
    <div class="row dim"><span>DRAW CALLS</span><b>{{ stats.drawCalls }}</b></div>
    <div class="row dim"><span>TRIANGLES</span><b>{{ tris }}</b></div>
    <div class="row dim"><span>WHEAT</span><b>{{ stats.wheatCount }}</b></div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 18px;
  left: 18px;
  min-width: 200px;
  padding: 12px 16px 10px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #d7e8dc;
  background: rgba(10, 24, 18, 0.55);
  border: 1px solid rgba(94, 200, 140, 0.35);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  user-select: none;
  pointer-events: none;
}
.title {
  font-size: 12px;
  font-weight: 700;
  color: #7fe0a8;
  margin-bottom: 8px;
  text-shadow: 0 0 12px rgba(127, 224, 168, 0.5);
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  line-height: 1.8;
}
.row span {
  color: #9db8a8;
}
.row b {
  font-weight: 600;
  color: #eef7f0;
}
.row .ok {
  color: #7fe0a8;
}
.row.dim {
  opacity: 0.75;
}
.divider {
  height: 1px;
  margin: 6px 0;
  background: linear-gradient(90deg, transparent, rgba(94, 200, 140, 0.4), transparent);
}
</style>
