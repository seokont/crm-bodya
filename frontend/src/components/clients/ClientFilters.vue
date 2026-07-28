<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  type ClientFilters,
  type Manager,
} from '@/types/client';

const props = defineProps<{
  modelValue: ClientFilters;
  managers: Manager[];
  mobile?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: ClientFilters];
  apply: [];
  reset: [];
}>();

const local = ref<ClientFilters>({ ...props.modelValue });
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let syncingFromParent = false;

const cloneFilters = (value: ClientFilters): ClientFilters => ({
  ...value,
  status: [...value.status],
  source: [...value.source],
});

const arraysEqual = <T,>(left: T[], right: T[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const filtersEqual = (left: ClientFilters, right: ClientFilters) =>
  left.search === right.search &&
  left.managerId === right.managerId &&
  left.city === right.city &&
  left.dateFrom === right.dateFrom &&
  left.dateTo === right.dateTo &&
  arraysEqual(left.status, right.status) &&
  arraysEqual(left.source, right.source);

watch(
  () => props.modelValue,
  (value) => {
    if (filtersEqual(value, local.value)) return;

    syncingFromParent = true;
    local.value = cloneFilters(value);
    void nextTick(() => {
      syncingFromParent = false;
    });
  },
  { deep: true },
);

watch(
  local,
  (value) => {
    if (syncingFromParent || filtersEqual(value, props.modelValue)) return;
    emit('update:modelValue', cloneFilters(value));
  },
  { deep: true },
);

watch(
  () => local.value.search,
  () => {
    if (syncingFromParent) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => emit('apply'), 400);
  },
);

onBeforeUnmount(() => clearTimeout(searchTimer));

function reset() {
  clearTimeout(searchTimer);
  emit('reset');
}
</script>

<template>
  <v-card
    :class="['filters-card', { 'filters-card--mobile': mobile }]"
    class="section-card"
  >
    <v-card-text :class="mobile ? 'pa-4' : 'pa-5'">
      <div class="filter-topline">
        <v-text-field
          v-model="local.search"
          label="Пошук клієнта..."
          prepend-inner-icon="mdi-magnify"
          clearable
          class="search-field"
          aria-label="Пошук клієнта за назвою, ім'ям, телефоном, email або ЄДРПОУ"
        />
        <div v-if="!mobile" class="filter-hint">
          <v-icon icon="mdi-tune-variant" size="16" />
          Фільтри
        </div>
      </div>

      <div class="filter-grid">
        <v-select
          v-model="local.status"
          :items="CLIENT_STATUSES"
          label="Статус"
          multiple
          clearable
          prepend-inner-icon="mdi-circle-multiple-outline"
        >
          <template #selection="{ item, index }">
            <v-chip v-if="index < 1" size="x-small">{{ item.title }}</v-chip>
            <span v-if="index === 1" class="selection-count">
              +{{ local.status.length - 1 }}
            </span>
          </template>
        </v-select>

        <v-select
          v-model="local.managerId"
          :items="managers"
          item-title="name"
          item-value="id"
          label="Менеджер"
          prepend-inner-icon="mdi-account-tie-outline"
          clearable
        />

        <v-select
          v-model="local.source"
          :items="CLIENT_SOURCES"
          label="Джерело"
          multiple
          clearable
          prepend-inner-icon="mdi-source-branch"
        >
          <template #selection="{ item, index }">
            <v-chip v-if="index < 1" size="x-small">{{ item.title }}</v-chip>
            <span v-if="index === 1" class="selection-count">
              +{{ local.source.length - 1 }}
            </span>
          </template>
        </v-select>

        <v-text-field
          v-model="local.city"
          label="Місто"
          prepend-inner-icon="mdi-map-marker-outline"
          clearable
        />

        <v-text-field
          v-model="local.dateFrom"
          label="Дата від"
          type="date"
          prepend-inner-icon="mdi-calendar-start-outline"
        />

        <v-text-field
          v-model="local.dateTo"
          label="Дата до"
          type="date"
          prepend-inner-icon="mdi-calendar-end-outline"
        />
      </div>

      <div class="filter-actions">
        <v-btn
          variant="text"
          prepend-icon="mdi-refresh"
          color="secondary"
          @click="reset"
        >
          Скинути
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-check"
          class="apply-button"
          @click="emit('apply')"
        >
          Застосувати
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.filters-card {
  overflow: visible;
}

.filters-card--mobile {
  border: none !important;
  box-shadow: none !important;
}

.filter-topline {
  display: flex;
  align-items: center;
  gap: 20px;
}

.search-field {
  flex: 1;
}

.filter-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  align-self: center;
  color: #7b8791;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.filter-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1.15fr 0.9fr 0.85fr 0.85fr;
  gap: 12px;
  margin-top: 14px;
}

.selection-count {
  margin-left: 5px;
  color: #687680;
  font-size: 12px;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 15px;
}

.apply-button {
  min-width: 132px;
}

@media (max-width: 1280px) {
  .filter-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 700px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    position: sticky;
    bottom: 0;
    padding-top: 14px;
    background: #fff;
  }

  .filter-actions .v-btn {
    flex: 1;
  }
}
</style>
