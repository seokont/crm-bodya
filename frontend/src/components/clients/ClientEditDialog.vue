<script setup lang="ts">
import ClientFormDialog from './ClientFormDialog.vue';
import type { Client, ClientPayload, Manager } from '@/types/client';

defineProps<{
  modelValue: boolean;
  client: Client | null;
  managers: Manager[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: ClientPayload];
}>();
</script>

<template>
  <ClientFormDialog
    :model-value="modelValue"
    mode="edit"
    :client="client"
    :managers="managers"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @save="emit('save', $event)"
  />
</template>
