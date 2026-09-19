<script setup lang="ts">
/**
 * 数字孪生 HUD
 *
 * 提示词要求：半透明、极简、绿色科技线，显示
 *   CAFE DIGITAL TWIN / STATUS: OPEN / TEMPERATURE: 24℃ /
 *   CUSTOMERS: 06 / COFFEE MACHINE: ACTIVE
 *
 * 刻意做得克制：细线、小字、暖白底，只在一角占一小块，
 * 让 3D 画面仍然是主角（"不要强科技蓝、不要赛博朋克"）。
 */
import { computed } from 'vue'
import type { SceneStats } from '../scenes/CafeTwinScene'

const props = defineProps<{
  stats: SceneStats
  paused: boolean
}>()

/** 孪生体的实时读数。数字会缓慢地自然浮动，像真的在采数 */
const emit = defineEmits<{ (e: 'open'): void }>()
void emit

/** 室温以 24.0℃ 为中心缓慢呼吸（±0.6），对应参考 HUD 的 24℃ 读数 */
const temp = computed(() => (24 + Math.sin(props.stats.temperature * 0.13 + 1) * 0.6).toFixed(1))

const rows = computed(() => [
  { k: 'STATUS', v: props.paused ? 'HOLD' : 'OPEN', ok: !props.paused },
  { k: 'TEMPERATURE', v: `${temp.value}℃`, ok: true },
  { k: 'CUSTOMERS', v: String(props.stats.customers).padStart(2, '0'), ok: true },
  { k: 'COFFEE MACHINE', v: props.stats.machine, ok: props.stats.machine === 'ACTIVE' },
  { k: 'GRINDER', v: props.stats.grinder, ok: true },
  { k: 'FRIDGE', v: props.stats.fridge, ok: true },
])

const model = computed(() => [
  { k: 'VOXELS', v: format(props.stats.voxels) },
  { k: 'WHEAT', v: format(props.stats.plants) },
  { k: 'TUFTS', v: format(props.stats.tufts) },
  { k: 'FLOWERS', v: format(props.stats.flowers) },
  { k: 'CLOUDS', v: String(props.stats.clouds) },
])

function format(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
</script>

<template>
  <div class="hud">
    <!-- 标题 -->
    <div class="glass card title-card">
      <div class="brand">
        <span class="mark" />
        <div>
          <div class="title">CAFE DIGITAL TWIN</div>
          <div class="sub">VOXEL MINIATURE · WHEATFIELD</div>
        </div>
      </div>
    </div>

    <!-- 孪生读数 -->
    <div class="glass card">
      <div class="sect">TELEMETRY</div>
      <div v-for="r in rows" :key="r.k" class="row">
        <span class="k">{{ r.k }}</span>
        <span class="dots" />
        <span class="v mono" :class="{ off: !r.ok }">
          <i class="dot" :class="{ off: !r.ok }" />{{ r.v }}
        </span>
      </div>
    </div>

    <!-- 模型统计 -->
    <div class="glass card">
      <div class="sect">MODEL</div>
      <div v-for="r in model" :key="r.k" class="row">
        <span class="k">{{ r.k }}</span>
        <span class="dots" />
        <span class="v mono">{{ r.v }}</span>
      </div>
    </div>

    <!-- 性能 -->
    <div class="glass card perf">
      <div class="sect">PERFORMANCE</div>
      <div class="fpsline">
        <span class="fps mono" :class="{ warn: stats.fps < 50 }">{{ stats.fps }}</span>
        <span class="unit">FPS</span>
        <span class="ms mono">{{ stats.frameMs.toFixed(1) }} ms</span>
      </div>
      <div class="row">
        <span class="k">DRAW CALL</span>
        <span class="dots" />
        <span class="v mono">{{ stats.drawCalls }}</span>
      </div>
      <div class="row">
        <span class="k">TRIANGLES</span>
        <span class="dots" />
        <span class="v mono">{{ format(stats.triangles) }}</span>
      </div>
      <div class="row">
        <span class="k">WIND</span>
        <span class="dots" />
        <span class="v mono">{{ stats.wind.toFixed(1) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 232px;
  pointer-events: none;
  user-select: none;
}

.card {
  padding: 10px 12px 11px;
}

.title-card {
  padding: 11px 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.mark {
  width: 3px;
  height: 26px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(var(--hud-line), 0.95), rgba(var(--hud-line), 0.25));
}

.title {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--hud-ink);
}

.sub {
  margin-top: 2px;
  font-size: 9px;
  letter-spacing: 0.13em;
  color: var(--hud-ink-dim);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.sect {
  font-size: 8.5px;
  letter-spacing: 0.19em;
  color: rgba(var(--hud-line), 0.95);
  margin-bottom: 7px;
  font-weight: 700;
}

.row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  height: 16px;
  font-size: 10.5px;
}

.k {
  color: var(--hud-ink-dim);
  letter-spacing: 0.05em;
  white-space: nowrap;
  font-size: 9.5px;
  font-weight: 600;
}

.dots {
  flex: 1;
  height: 1px;
  margin-bottom: 3px;
  background-image: linear-gradient(
    90deg,
    rgba(var(--hud-line), 0.5) 0 2px,
    transparent 2px 5px
  );
  background-size: 5px 1px;
  background-repeat: repeat-x;
}

.v {
  color: var(--hud-accent);
  font-weight: 600;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.v.off {
  color: #a2563c;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(var(--hud-line), 1);
  box-shadow: 0 0 5px rgba(var(--hud-line), 0.85);
  flex: none;
}

.dot.off {
  background: #c97354;
  box-shadow: 0 0 5px rgba(201, 115, 84, 0.8);
}

.perf .fpsline {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 6px;
}

.fps {
  font-size: 22px;
  font-weight: 700;
  color: var(--hud-accent);
  line-height: 1;
  letter-spacing: -0.02em;
}

.fps.warn {
  color: #c97354;
}

.unit {
  font-size: 9px;
  color: var(--hud-ink-dim);
  letter-spacing: 0.1em;
  font-weight: 700;
}

.ms {
  margin-left: auto;
  font-size: 9.5px;
  color: var(--hud-ink-dim);
}
</style>
