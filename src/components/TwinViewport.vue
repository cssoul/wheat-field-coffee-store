<script setup lang="ts">
/**
 * TwinViewport —— Three.js 场景挂载点。
 * 负责：初始化 WheatCafeTwin、帧统计上行、选中信息下行、销毁清理。
 */
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import type { FrameStats } from '@/three/SceneManager'
import { WheatCafeTwin } from '@/three/WheatCafeTwin'
import type { AssetInfo } from '@/types/twin'

const host = ref<HTMLElement | null>(null)
const selected = ref<AssetInfo | null>(null)

const emit = defineEmits<{
  ready: [twin: WheatCafeTwin]
}>()

const frame = reactive<FrameStats>({ fps: 0, drawCalls: 0, triangles: 0 })

let twin: WheatCafeTwin | null = null

onMounted(() => {
  if (!host.value) return
  twin = new WheatCafeTwin(host.value)
  twin.onFrame = (s) => Object.assign(frame, s)
  twin.onSelect = (info) => {
    selected.value = info
  }
  emit('ready', twin)
})

onBeforeUnmount(() => {
  twin?.dispose()
  twin = null
})

defineExpose({ frame, selected, getInstance: () => twin })
</script>

<template>
  <div ref="host" class="viewport" />
</template>

<style scoped>
.viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.viewport :deep(canvas) {
  display: block;
}
</style>
