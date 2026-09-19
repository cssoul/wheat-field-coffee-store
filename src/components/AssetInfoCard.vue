<script setup lang="ts">
/**
 * AssetInfoCard —— 点击资产后的数字孪生信息卡（半透明深色玻璃 + 绿色数据风）。
 */
import type { AssetInfo } from '@/types/twin'

defineProps<{ info: AssetInfo }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="card">
    <div class="head">
      <span class="dot" />
      <span class="name">{{ info.name }}</span>
      <button class="close" @click="$emit('close')">✕</button>
    </div>
    <div class="rows">
      <div v-for="r in info.rows" :key="r.label" class="row">
        <span>{{ r.label }}</span>
        <b>{{ r.value }}</b>
      </div>
    </div>
    <div class="foot">ASSET {{ info.id }}</div>
  </div>
</template>

<style scoped>
.card {
  position: absolute;
  right: 22px;
  top: 18px;
  width: 240px;
  padding: 12px 14px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: #d9ecdf;
  background: rgba(8, 22, 16, 0.62);
  border: 1px solid rgba(94, 200, 140, 0.4);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.25);
  user-select: none;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7fe0a8;
  box-shadow: 0 0 8px #7fe0a8;
}
.name {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #a9ecc6;
}
.close {
  border: 0;
  background: none;
  color: #9db8a8;
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
}
.close:hover {
  color: #fff;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  line-height: 1.9;
}
.row span {
  color: #93b3a1;
}
.row b {
  font-weight: 600;
  color: #eef7f0;
}
.foot {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(94, 200, 140, 0.25);
  font-size: 9px;
  color: #6f8d7c;
  letter-spacing: 0.12em;
}
</style>
