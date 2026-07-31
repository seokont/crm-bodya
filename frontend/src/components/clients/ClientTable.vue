<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ClientStatusChip from './ClientStatusChip.vue';
import {
  CLIENT_TABLE_COLUMN_OPTIONS,
  DEFAULT_CLIENT_TABLE_COLUMNS,
  clientDisplayName,
  type Client,
  type ClientSort,
  type ClientTableColumnKey,
} from '@/types/client';

const props = defineProps<{
  items: Client[];
  total: number;
  page: number;
  limit: number;
  sort: ClientSort;
  loading: boolean;
  visibleColumns: ClientTableColumnKey[];
  preferencesSaving: boolean;
}>();

const emit = defineEmits<{
  'update:page': [value: number];
  'update:limit': [value: number];
  'update:sort': [value: ClientSort];
  view: [client: Client];
  edit: [client: Client];
  archive: [client: Client];
  delete: [client: Client];
  'update:columns': [columns: ClientTableColumnKey[]];
}>();

interface SortItem {
  key: string;
  order?: boolean | 'asc' | 'desc';
}

interface TableOptions {
  page: number;
  itemsPerPage: number;
  sortBy: SortItem[];
}

const headers = [
  { title: 'ID', key: 'id', sortable: false, width: 72 },
  { title: 'Клієнт', key: 'client', sortable: true, minWidth: 220 },
  { title: 'ЄДРПОУ', key: 'edrpou', sortable: false, minWidth: 120 },
  { title: 'Телефон', key: 'phone', sortable: false, minWidth: 160 },
  { title: 'Email', key: 'email', sortable: false, minWidth: 200 },
  { title: 'Місто', key: 'city', sortable: true, minWidth: 130 },
  { title: 'Статус', key: 'status', sortable: true, minWidth: 165 },
  { title: 'Джерело', key: 'source', sortable: false, minWidth: 140 },
  { title: 'Менеджер', key: 'manager', sortable: true, minWidth: 160 },
  { title: 'Створено', key: 'createdAt', sortable: true, minWidth: 130 },
  { title: 'Оновлено', key: 'updatedAt', sortable: true, minWidth: 130 },
  { title: '', key: 'actions', sortable: false, width: 104 },
] as const;

const columnMenu = ref(false);
const draftColumns = ref<ClientTableColumnKey[]>([
  ...props.visibleColumns,
]);

const visibleHeaders = computed(() => {
  const selected = new Set<ClientTableColumnKey>([
    ...props.visibleColumns,
    'client',
  ]);
  return headers.filter(
    (header) =>
      header.key === 'actions' ||
      selected.has(header.key as ClientTableColumnKey),
  );
});

const selectedColumnCount = computed(
  () =>
    new Set<ClientTableColumnKey>([...draftColumns.value, 'client']).size,
);

watch(
  () => props.visibleColumns,
  (columns) => {
    if (!columnMenu.value) draftColumns.value = [...columns];
  },
  { deep: true },
);

watch(columnMenu, (opened) => {
  if (opened) draftColumns.value = [...props.visibleColumns];
});

function resetColumns() {
  draftColumns.value = [...DEFAULT_CLIENT_TABLE_COLUMNS];
}

function applyColumns() {
  const selected = new Set<ClientTableColumnKey>([
    ...draftColumns.value,
    'client',
  ]);
  emit(
    'update:columns',
    DEFAULT_CLIENT_TABLE_COLUMNS.filter((column) => selected.has(column)),
  );
  columnMenu.value = false;
}

const sortKeyMap: Record<string, ClientSort['sortBy']> = {
  client: 'name',
  city: 'city',
  status: 'status',
  manager: 'manager',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const currentSort = computed(() => [
  {
    key:
      Object.entries(sortKeyMap).find(
        ([, value]) => value === props.sort.sortBy,
      )?.[0] ?? 'createdAt',
    order: props.sort.sortOrder,
  },
]);

function onOptions(options: TableOptions) {
  if (options.page !== props.page) emit('update:page', options.page);
  if (options.itemsPerPage !== props.limit) {
    emit('update:limit', options.itemsPerPage);
  }

  const tableSort = options.sortBy[0];
  const mappedSort = tableSort ? sortKeyMap[tableSort.key] : undefined;
  if (mappedSort) {
    emit('update:sort', {
      sortBy: mappedSort,
      sortOrder: tableSort?.order === 'asc' ? 'asc' : 'desc',
    });
  }
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

function rowProps(data: { item: Client }) {
  return {
    class: 'client-row',
    tabindex: 0,
    onClick: () => emit('view', data.item),
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === 'Enter') emit('view', data.item);
    },
  };
}
</script>

<template>
  <v-card class="section-card table-card">
    <div class="table-toolbar">
      <div>
        <span class="found-label">Знайдено клієнтів</span>
        <span class="found-count">{{ total.toLocaleString('uk-UA') }}</span>
      </div>
      <div class="table-toolbar__actions">
        <div class="table-toolbar__hint">
          <v-icon icon="mdi-swap-vertical" size="16" />
          Натисніть заголовок для сортування
        </div>
        <v-menu
          v-model="columnMenu"
          :close-on-content-click="false"
          location="bottom end"
        >
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-table-column"
              size="small"
            >
              Поля таблиці
            </v-btn>
          </template>
          <v-card class="column-settings" width="330">
            <div class="column-settings__header">
              <div>
                <strong>Поля таблиці</strong>
                <span>
                  Відображається {{ selectedColumnCount }} з
                  {{ CLIENT_TABLE_COLUMN_OPTIONS.length }}
                </span>
              </div>
              <v-btn
                icon="mdi-close"
                variant="text"
                size="small"
                aria-label="Закрити налаштування"
                @click="columnMenu = false"
              />
            </div>
            <v-divider />
            <div class="column-settings__list">
              <label
                v-for="column in CLIENT_TABLE_COLUMN_OPTIONS"
                :key="column.value"
                class="column-option"
                :class="{
                  'column-option--required':
                    'required' in column && column.required,
                }"
              >
                <input
                  v-model="draftColumns"
                  type="checkbox"
                  :value="column.value"
                  :disabled="'required' in column && column.required"
                />
                <span class="column-option__check" aria-hidden="true">
                  <v-icon
                    v-if="draftColumns.includes(column.value)"
                    icon="mdi-check"
                    size="14"
                  />
                </span>
                <span class="column-option__copy">
                  <span>{{ column.title }}</span>
                  <small v-if="'required' in column && column.required">
                    Обов’язкове
                  </small>
                </span>
              </label>
            </div>
            <v-divider />
            <v-card-actions class="column-settings__actions">
              <v-btn
                variant="text"
                size="small"
                :disabled="preferencesSaving"
                @click="resetColumns"
              >
                Показати всі
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                size="small"
                :loading="preferencesSaving"
                @click="applyColumns"
              >
                Застосувати
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-menu>
      </div>
    </div>

    <v-skeleton-loader
      v-if="loading && !items.length"
      type="table-heading, table-row@6"
      class="pa-3"
    />

    <v-data-table-server
      v-else
      :headers="visibleHeaders"
      :items="items"
      :items-length="total"
      :items-per-page="limit"
      :page="page"
      :sort-by="currentSort"
      :loading="loading"
      :row-props="rowProps"
      :items-per-page-options="[10, 25, 50, 100]"
      hover
      item-value="id"
      class="clients-table"
      loading-text="Завантажуємо клієнтів..."
      no-data-text="Клієнтів не знайдено"
      @update:options="onOptions"
    >
      <template #item.id="{ item }">
        <span class="client-id">#{{ item.id }}</span>
      </template>

      <template #item.client="{ item }">
        <div class="client-cell">
          <v-avatar size="36" color="#edf0eb" class="client-avatar">
            {{ clientDisplayName(item).slice(0, 2).toUpperCase() }}
          </v-avatar>
          <div>
            <div class="client-name">{{ clientDisplayName(item) }}</div>
            <div v-if="item.companyName && item.contactName" class="client-contact">
              {{ item.contactName }}
            </div>
          </div>
        </div>
      </template>

      <template #item.edrpou="{ item }">
        <span class="cell-text">{{ item.edrpou || '—' }}</span>
      </template>

      <template #item.phone="{ item }">
        <a
          v-if="item.phone"
          :href="`tel:${item.phone}`"
          class="cell-link"
          @click.stop
        >
          {{ item.phone }}
        </a>
        <span v-else>—</span>
      </template>

      <template #item.email="{ item }">
        <a
          v-if="item.email"
          :href="`mailto:${item.email}`"
          class="cell-link"
          @click.stop
        >
          {{ item.email }}
        </a>
        <span v-else>—</span>
      </template>

      <template #item.city="{ item }">
        <span class="cell-text">{{ item.city || '—' }}</span>
      </template>

      <template #item.status="{ item }">
        <ClientStatusChip :status="item.status" />
      </template>

      <template #item.source="{ item }">
        <span class="cell-text">{{ item.source || '—' }}</span>
      </template>

      <template #item.manager="{ item }">
        <div v-if="item.manager" class="manager-cell">
          <span class="manager-dot" />
          {{ item.manager.name }}
        </div>
        <span v-else class="unassigned">Не призначено</span>
      </template>

      <template #item.createdAt="{ item }">
        <span class="cell-date">{{ formatDate(item.createdAt) }}</span>
      </template>

      <template #item.updatedAt="{ item }">
        <span class="cell-date">{{ formatDate(item.updatedAt) }}</span>
      </template>

      <template #item.actions="{ item }">
        <div class="row-actions">
          <v-btn
            icon="mdi-pencil-outline"
            variant="text"
            size="small"
            aria-label="Редагувати клієнта"
            @click.stop="emit('edit', item)"
          />
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="mdi-dots-horizontal"
                variant="text"
                size="small"
                aria-label="Інші дії"
                @click.stop
              />
            </template>
            <v-list density="compact">
              <v-list-item
                prepend-icon="mdi-eye-outline"
                title="Відкрити картку"
                @click="emit('view', item)"
              />
              <v-list-item
                prepend-icon="mdi-archive-arrow-down-outline"
                title="Архівувати"
                @click="emit('archive', item)"
              />
              <v-divider />
              <v-list-item
                prepend-icon="mdi-trash-can-outline"
                title="Видалити остаточно"
                class="text-error"
                @click="emit('delete', item)"
              />
            </v-list>
          </v-menu>
        </div>
      </template>
    </v-data-table-server>
  </v-card>
</template>

<style scoped>
.table-card {
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  padding: 0 22px;
  border-bottom: 1px solid #e9ece7;
}

.found-label {
  margin-right: 9px;
  color: #74808c;
  font-size: 13px;
}

.found-count {
  color: #17293e;
  font-size: 16px;
  font-weight: 800;
}

.table-toolbar__hint {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #8a959e;
  font-size: 11px;
}

.table-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.column-settings {
  overflow: hidden;
  border: 1px solid #e3e8e3;
  border-radius: 14px !important;
}

.column-settings__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 13px;
}

.column-settings__header strong,
.column-settings__header span {
  display: block;
}

.column-settings__header strong {
  color: #263746;
  font-family: Georgia, serif;
  font-size: 17px;
}

.column-settings__header span {
  margin-top: 4px;
  color: #8a959d;
  font-size: 10px;
}

.column-settings__list {
  display: grid;
  max-height: min(430px, 60vh);
  padding: 10px 14px;
  grid-template-columns: minmax(0, 1fr);
  gap: 3px;
  overflow-y: auto;
}

.column-option {
  position: relative;
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 9px;
  color: #4d5d67;
  cursor: pointer;
}

.column-option:hover {
  background: #f2f7f5;
}

.column-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.column-option__check {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border: 1px solid #b9c4c0;
  border-radius: 6px;
  color: #fff;
  background: #fff;
  place-items: center;
}

.column-option input:checked + .column-option__check {
  border-color: #26736a;
  background: #26736a;
}

.column-option input:focus-visible + .column-option__check {
  outline: 2px solid rgba(38, 115, 106, 0.3);
  outline-offset: 2px;
}

.column-option__copy {
  display: block;
  min-width: 0;
  font-size: 11px;
  line-height: 1.35;
}

.column-option__copy > span {
  display: block;
}

.column-option__copy small {
  display: block;
  margin-top: 2px;
  color: #9aa3a9;
  font-size: 8px;
}

.column-option--required {
  cursor: default;
}

.column-option--required:hover {
  background: transparent;
}

.column-settings__actions {
  min-height: 56px;
  padding: 8px 14px !important;
}

.clients-table :deep(th) {
  height: 52px !important;
  color: #71808c !important;
  background: #fafbf9 !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase;
  white-space: nowrap;
}

.clients-table :deep(td) {
  height: 68px !important;
  border-color: #eef0ed !important;
  color: #43515c;
  font-size: 13px;
}

.clients-table :deep(.client-row) {
  cursor: pointer;
}

.clients-table :deep(.client-row:focus-visible) {
  outline: 2px solid #26736a;
  outline-offset: -2px;
}

.client-id {
  color: #9aa3aa;
  font-size: 12px;
  font-weight: 600;
}

.client-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.client-avatar {
  color: #26736a;
  font-size: 11px;
  font-weight: 800;
}

.client-name {
  max-width: 180px;
  overflow: hidden;
  color: #263746;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.client-contact {
  max-width: 180px;
  margin-top: 3px;
  overflow: hidden;
  color: #8a949c;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-text,
.cell-date {
  white-space: nowrap;
}

.cell-date {
  color: #6f7c87;
  font-size: 12px;
}

.cell-link {
  color: #346d7b;
  text-decoration: none;
  white-space: nowrap;
}

.cell-link:hover {
  text-decoration: underline;
}

.manager-cell {
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.manager-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #65a28d;
  box-shadow: 0 0 0 3px #e5f1ec;
}

.unassigned {
  color: #a0a8ae;
  font-size: 12px;
}

.row-actions {
  display: flex;
}

@media (max-width: 700px) {
  .table-toolbar {
    padding: 0 12px;
  }

  .table-toolbar__hint {
    display: none;
  }
}
</style>
