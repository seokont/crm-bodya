<script setup lang="ts">
import { computed } from 'vue';
import ClientStatusChip from './ClientStatusChip.vue';
import {
  clientDisplayName,
  type Client,
  type ClientSort,
} from '@/types/client';

const props = defineProps<{
  items: Client[];
  total: number;
  page: number;
  limit: number;
  sort: ClientSort;
  loading: boolean;
}>();

const emit = defineEmits<{
  'update:page': [value: number];
  'update:limit': [value: number];
  'update:sort': [value: ClientSort];
  view: [client: Client];
  edit: [client: Client];
  archive: [client: Client];
  delete: [client: Client];
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
      <div class="table-toolbar__hint">
        <v-icon icon="mdi-swap-vertical" size="16" />
        Натисніть заголовок для сортування
      </div>
    </div>

    <v-skeleton-loader
      v-if="loading && !items.length"
      type="table-heading, table-row@6"
      class="pa-3"
    />

    <v-data-table-server
      v-else
      :headers="headers"
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
  .table-toolbar__hint {
    display: none;
  }
}
</style>
