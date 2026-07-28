<script setup lang="ts">
import { computed } from 'vue';
import type { ClientStatus } from '@/types/client';

const props = defineProps<{
  status: ClientStatus;
}>();

const statusMap: Record<
  ClientStatus,
  { label: string; color: string; dot: string }
> = {
  NEW: { label: 'Новий', color: '#e8f1fa', dot: '#4976a7' },
  IN_PROGRESS: { label: 'У роботі', color: '#fff0df', dot: '#c56b2c' },
  CONTACTED: { label: "Зв'язалися", color: '#eee9fb', dot: '#7258a3' },
  WAITING: { label: 'Очікує рішення', color: '#fff4d7', dot: '#b7811f' },
  INTERESTED: { label: 'Зацікавлений', color: '#e6f4ed', dot: '#35805d' },
  NOT_INTERESTED: { label: 'Не зацікавлений', color: '#eef0f2', dot: '#687582' },
  CLIENT: { label: 'Клієнт', color: '#dff3ea', dot: '#26736a' },
  REJECTED: { label: 'Відмова', color: '#fae6e5', dot: '#b94c4b' },
  ARCHIVED: { label: 'Архів', color: '#eceef0', dot: '#75808a' },
};

const config = computed(() => statusMap[props.status]);
</script>

<template>
  <v-chip
    size="small"
    :color="config.color"
    class="status-chip"
    variant="flat"
  >
    <span class="status-chip__dot" :style="{ background: config.dot }" />
    {{ config.label }}
  </v-chip>
</template>

<style scoped>
.status-chip {
  color: #32414d !important;
  font-size: 12px;
  font-weight: 600;
}

.status-chip__dot {
  width: 7px;
  height: 7px;
  margin-right: 7px;
  border-radius: 50%;
}
</style>
