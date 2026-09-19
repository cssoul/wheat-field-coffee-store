<script setup lang="ts">
/**
 * VOXEL MINIATURE WHEATFIELD CAFE · DIGITAL TWIN
 *
 * 应用层只负责三件事：
 *   1. 给 3D 场景一块画布
 *   2. 把场景抛出来的性能/遥测数据喂给 HUD
 *   3. 提供"看模型"的操作：切视角、调风力、开关阴影
 */
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import TwinHud from './components/TwinHud.vue'
import { CafeTwinScene, type SceneStats } from './scenes/CafeTwinScene'
import { PRESETS, type ViewPreset } from './systems/CameraRig'

const stage = ref<HTMLElement | null>(null)
const twin = shallowRef<CafeTwinScene | null>(null)
const ready = ref(false)
const building = ref(true)

const wind = ref(1)
const shadows = ref(true)
const paused = ref(false)
const hd = ref(true)
const current = ref<ViewPreset>('reference')

const stats = ref<SceneStats>({
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  voxels: 0,
  plants: 0,
  tufts: 0,
  flowers: 0,
  clouds: 0,
  wind: 1,
  temperature: 0,
  customers: 6,
  machine: 'ACTIVE',
  grinder: 'READY',
  fridge: '4°C',
})

const presetList = (Object.keys(PRESETS) as ViewPreset[]).map((k) => ({
  key: k,
  label: PRESETS[k].label,
}))

let onResize: (() => void) | null = null

onMounted(() => {
  // 先让浏览器把加载层画出来，再做重的体素建模（否则首屏会白一下）
  requestAnimationFrame(() => {
    if (!stage.value) return
    const s = new CafeTwinScene(stage.value)
    s.onStats = (v) => {
      stats.value = v
    }
    s.start()
    twin.value = s
    ready.value = true
    building.value = false
  })

  onResize = () => twin.value?.resize()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (onResize) window.removeEventListener('resize', onResize)
  twin.value?.dispose()
  twin.value = null
})

function pickPreset(k: ViewPreset) {
  current.value = k
  twin.value?.setPreset(k)
}

function onWind() {
  twin.value?.setWind(wind.value)
}

function onShadows() {
  twin.value?.setShadows(shadows.value)
}

function onPaused() {
  twin.value?.setPaused(paused.value)
}

function onHd() {
  twin.value?.setPixelRatio(hd.value ? 2 : 1)
}
</script>

<template>
  <div class="stage" ref="stage" />

  <TwinHud v-if="ready" :stats="stats" :paused="paused" />

  <!-- 右上角：模型说明 -->
  <div v-if="ready" class="glass note">
    <div class="note-title">矩形麦田咖啡馆 · 微缩复刻</div>
    <p>
      白砖墙 + 厚麦草屋顶的长方形单层咖啡屋，屋前木平台与白色遮阳伞，
      四周被麦田包住。全场景几何体、材质均由代码生成，无任何外部模型与贴图。
    </p>
  </div>

  <!-- 底部操作台 -->
  <div v-if="ready" class="glass bar">
    <div class="group">
      <span class="label">视角</span>
      <button
        v-for="p in presetList"
        :key="p.key"
        class="btn"
        :class="{ on: current === p.key }"
        @click="pickPreset(p.key)"
      >
        {{ p.label }}
      </button>
    </div>

    <span class="sep" />

    <div class="group">
      <label class="label" for="wind">风力</label>
      <input
        id="wind"
        class="slider"
        type="range"
        min="0"
        max="2.2"
        step="0.05"
        v-model.number="wind"
        @input="onWind"
      />
      <span class="mono num">{{ wind.toFixed(2) }}</span>
    </div>

    <span class="sep" />

    <div class="group">
      <button class="btn" :class="{ on: shadows }" @click="shadows = !shadows; onShadows()">
        软阴影
      </button>
      <button class="btn" :class="{ on: !paused }" @click="paused = !paused; onPaused()">
        {{ paused ? '已暂停' : '动态' }}
      </button>
      <button class="btn" :class="{ on: hd }" @click="hd = !hd; onHd()">
        {{ hd ? '高清' : '省电' }}
      </button>
    </div>
  </div>

  <!-- 加载层 -->
  <div v-if="building" class="loading">
    <div class="loading-inner">
      <div class="spinner" />
      <div class="loading-text">
        正在砌砖、铺茅草、种麦子<span class="mono">…</span>
      </div>
      <div class="loading-sub">GENERATING VOXEL GEOMETRY · NO EXTERNAL ASSETS</div>
    </div>
  </div>
</template>

<style scoped>
.note {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 240px;
  padding: 11px 13px;
  pointer-events: none;
  user-select: none;
}

.note-title {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--hud-accent);
  margin-bottom: 5px;
}

.note p {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.62;
  color: var(--hud-ink-dim);
}

.bar {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  user-select: none;
  white-space: nowrap;
}

.group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--hud-ink-dim);
  font-weight: 700;
}

.sep {
  width: 1px;
  height: 18px;
  background: rgba(var(--hud-line), 0.4);
}

.btn {
  appearance: none;
  border: 1px solid rgba(var(--hud-line), 0.42);
  background: rgba(255, 255, 255, 0.5);
  color: var(--hud-ink);
  border-radius: 7px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s, color 0.16s;
  font-family: inherit;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(var(--hud-line), 0.8);
}

.btn.on {
  background: rgba(var(--hud-line), 0.2);
  border-color: rgba(var(--hud-line), 0.92);
  color: var(--hud-accent);
}

.slider {
  appearance: none;
  width: 104px;
  height: 3px;
  border-radius: 2px;
  background: rgba(var(--hud-line), 0.34);
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--hud-accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(30, 60, 44, 0.35);
  cursor: pointer;
}

.num {
  font-size: 10.5px;
  color: var(--hud-accent);
  font-weight: 600;
  width: 30px;
}

.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #6fb0d4 0%, #a9cbdd 58%, #dfe4dd 100%);
}

.loading-inner {
  text-align: center;
}

.spinner {
  width: 30px;
  height: 30px;
  margin: 0 auto 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 13px;
  color: #23414f;
  letter-spacing: 0.05em;
}

.loading-sub {
  margin-top: 7px;
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(35, 65, 79, 0.6);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}
</style>
