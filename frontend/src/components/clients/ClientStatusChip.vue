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
  NEW: { label: 'Новий клієнт', color: '#e8f1fa', dot: '#4976a7' },
  NO_ANSWER: { label: 'НБТ', color: '#fae9e6', dot: '#b95b5b' },
  CALL_LATER: { label: 'Передзвонити пізніше', color: '#fff4d7', dot: '#b7811f' },
  FUTURE_PROSPECT: {
    label: 'Дізнавався на перспективу',
    color: '#eee9fb',
    dot: '#7258a3',
  },
  INTERESTED: { label: 'Зацікавлений', color: '#e6f4ed', dot: '#35805d' },
  SIGNED_CONTRACT: {
    label: 'Підписав договір',
    color: '#e4f2ee',
    dot: '#26736a',
  },
  PARTIALLY_PAID: {
    label: 'Оплатив першу частину',
    color: '#e6f0f8',
    dot: '#3d7196',
  },
  FULLY_PAID: {
    label: 'Оплатив повністю',
    color: '#dff3e7',
    dot: '#23804b',
  },
  LOST: { label: 'Злив', color: '#eef0f2', dot: '#687582' },
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
