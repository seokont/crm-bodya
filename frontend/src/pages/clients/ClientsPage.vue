<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import ClientCreateDialog from '@/components/clients/ClientCreateDialog.vue';
import ClientEditDialog from '@/components/clients/ClientEditDialog.vue';
import ClientFiltersPanel from '@/components/clients/ClientFilters.vue';
import ClientTable from '@/components/clients/ClientTable.vue';
import { authApi } from '@/services/auth.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import { useClientsStore } from '@/stores/clients';
import {
  CLIENT_STATUSES,
  DEFAULT_CLIENT_TABLE_COLUMNS,
  emptyClientFilters,
  type Client,
  type ClientFilters,
  type ClientPayload,
  type ClientSort,
  type ClientStatus,
  type ClientTableColumnKey,
} from '@/types/client';

const store = useClientsStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { mdAndUp } = useDisplay();

const createDialog = ref(false);
const editDialog = ref(false);
const filtersDrawer = ref(false);
const archiveDialog = ref(false);
const deleteDialog = ref(false);
const currentClient = ref<Client | null>(null);
const draftFilters = ref<ClientFilters>(emptyClientFilters());
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');
const visibleColumns = ref<ClientTableColumnKey[]>([
  ...DEFAULT_CLIENT_TABLE_COLUMNS,
]);
const preferencesSaving = ref(false);

interface PersistedClientListState {
  filters: ClientFilters;
  page: number;
  limit: number;
  sort: ClientSort;
}

const listQueryKeys = [
  'search',
  'status',
  'managerId',
  'source',
  'city',
  'dateFrom',
  'dateTo',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
] as const;
const allowedStatuses = new Set(CLIENT_STATUSES.map((item) => item.value));
const allowedSortFields = new Set<ClientSort['sortBy']>([
  'name',
  'createdAt',
  'updatedAt',
  'status',
  'manager',
  'city',
]);

function listStateStorageKey() {
  return auth.user?.id
    ? `bodya_client_list_state_${auth.user.id}`
    : 'bodya_client_list_state';
}

function cloneFilters(filters: ClientFilters): ClientFilters {
  return {
    ...filters,
    status: [...filters.status],
    source: [...filters.source],
  };
}

function saveListState() {
  const state: PersistedClientListState = {
    filters: cloneFilters(store.filters),
    page: store.page,
    limit: store.limit,
    sort: { ...store.sort },
  };
  try {
    localStorage.setItem(listStateStorageKey(), JSON.stringify(state));
  } catch {
    // Навігація продовжить працювати через query-параметри.
  }
}

function readSavedListState(): PersistedClientListState | null {
  try {
    const raw = localStorage.getItem(listStateStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedClientListState>;
    const savedFilters = parsed.filters;
    if (!savedFilters || typeof savedFilters !== 'object') return null;

    const page = Number(parsed.page);
    const limit = Number(parsed.limit);
    const sortBy = parsed.sort?.sortBy;
    return {
      filters: {
        search:
          typeof savedFilters.search === 'string' ? savedFilters.search : '',
        status: Array.isArray(savedFilters.status)
          ? savedFilters.status.filter((status): status is ClientStatus =>
              allowedStatuses.has(status as ClientStatus),
            )
          : [],
        managerId:
          Number.isInteger(Number(savedFilters.managerId)) &&
          Number(savedFilters.managerId) > 0
            ? Number(savedFilters.managerId)
            : null,
        source: Array.isArray(savedFilters.source)
          ? savedFilters.source.filter(
              (source): source is string => typeof source === 'string',
            )
          : [],
        city: typeof savedFilters.city === 'string' ? savedFilters.city : '',
        dateFrom:
          typeof savedFilters.dateFrom === 'string'
            ? savedFilters.dateFrom
            : '',
        dateTo:
          typeof savedFilters.dateTo === 'string' ? savedFilters.dateTo : '',
      },
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: [10, 25, 50, 100].includes(limit) ? limit : 25,
      sort: {
        sortBy:
          sortBy && allowedSortFields.has(sortBy) ? sortBy : 'createdAt',
        sortOrder: parsed.sort?.sortOrder === 'asc' ? 'asc' : 'desc',
      },
    };
  } catch {
    return null;
  }
}

const stringQuery = (value: unknown) =>
  typeof value === 'string' ? value : '';

function readQueryState() {
  const query = route.query;
  const hasListQuery = listQueryKeys.some((key) => query[key] !== undefined);
  const savedState = hasListQuery ? null : readSavedListState();

  if (savedState) {
    draftFilters.value = cloneFilters(savedState.filters);
    store.setFilters(savedState.filters);
    store.page = savedState.page;
    store.limit = savedState.limit;
    store.sort = { ...savedState.sort };
    return;
  }

  const statuses = stringQuery(query.status)
    .split(',')
    .filter((status): status is ClientStatus =>
      allowedStatuses.has(status as ClientStatus),
    );
  const sources = stringQuery(query.source).split(',').filter(Boolean);

  draftFilters.value = {
    search: stringQuery(query.search),
    status: statuses,
    managerId: query.managerId ? Number(query.managerId) : null,
    source: sources,
    city: stringQuery(query.city),
    dateFrom: stringQuery(query.dateFrom),
    dateTo: stringQuery(query.dateTo),
  };
  store.setFilters(draftFilters.value);
  store.page = Math.max(1, Number(query.page) || 1);
  store.limit = [10, 25, 50, 100].includes(Number(query.limit))
    ? Number(query.limit)
    : 25;
  store.sort = {
    sortBy: (stringQuery(query.sortBy) || 'createdAt') as ClientSort['sortBy'],
    sortOrder: stringQuery(query.sortOrder) === 'asc' ? 'asc' : 'desc',
  };
}

async function syncQuery() {
  const filters = store.filters;
  await router.replace({
    query: {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status.length ? { status: filters.status.join(',') } : {}),
      ...(filters.managerId ? { managerId: String(filters.managerId) } : {}),
      ...(filters.source.length ? { source: filters.source.join(',') } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      ...(store.page > 1 ? { page: String(store.page) } : {}),
      ...(store.limit !== 25 ? { limit: String(store.limit) } : {}),
      ...(store.sort.sortBy !== 'createdAt'
        ? { sortBy: store.sort.sortBy }
        : {}),
      ...(store.sort.sortOrder !== 'desc'
        ? { sortOrder: store.sort.sortOrder }
        : {}),
    },
  });
  saveListState();
}

async function refresh() {
  await syncQuery();
  await store.fetchClients();
}

async function applyFilters() {
  store.setFilters(draftFilters.value);
  filtersDrawer.value = false;
  await refresh();
}

async function resetFilters() {
  draftFilters.value = emptyClientFilters();
  store.resetFilters();
  filtersDrawer.value = false;
  await refresh();
}

async function updatePage(page: number) {
  store.page = page;
  await refresh();
}

async function updateLimit(limit: number) {
  store.limit = limit;
  store.page = 1;
  await refresh();
}

async function updateSort(sort: ClientSort) {
  if (
    store.sort.sortBy === sort.sortBy &&
    store.sort.sortOrder === sort.sortOrder
  ) {
    return;
  }
  store.sort = sort;
  store.page = 1;
  await refresh();
}

function showMessage(message: string, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

async function loadTablePreferences() {
  try {
    const preferences = await authApi.getClientTablePreferences();
    visibleColumns.value = preferences.columns;
  } catch (requestError) {
    showMessage(
      `Не вдалося завантажити поля таблиці: ${getApiError(requestError)}`,
      'error',
    );
  }
}

async function updateTableColumns(columns: ClientTableColumnKey[]) {
  preferencesSaving.value = true;
  try {
    const preferences =
      await authApi.updateClientTablePreferences(columns);
    visibleColumns.value = preferences.columns;
    showMessage('Поля таблиці збережено');
  } catch (requestError) {
    showMessage(getApiError(requestError), 'error');
  } finally {
    preferencesSaving.value = false;
  }
}

async function createClient(payload: ClientPayload) {
  try {
    const client = await store.createClient(payload);
    createDialog.value = false;
    showMessage(`Клієнта ${client.companyName || client.contactName} додано до CRM`);
  } catch {
    showMessage(store.error, 'error');
  }
}

function openEdit(client: Client) {
  currentClient.value = client;
  editDialog.value = true;
}

async function updateClient(payload: ClientPayload) {
  if (!currentClient.value) return;
  try {
    await store.updateClient(currentClient.value.id, payload);
    editDialog.value = false;
    showMessage('Зміни збережено');
  } catch {
    showMessage(store.error, 'error');
  }
}

function requestArchive(client: Client) {
  currentClient.value = client;
  archiveDialog.value = true;
}

async function archiveClient() {
  if (!currentClient.value) return;
  try {
    await store.archiveClient(currentClient.value.id);
    archiveDialog.value = false;
    showMessage('Клієнта переміщено до архіву');
  } catch {
    showMessage(store.error, 'error');
  }
}

function requestDelete(client: Client) {
  currentClient.value = client;
  deleteDialog.value = true;
}

async function deleteClient() {
  if (!currentClient.value) return;
  const name =
    currentClient.value.companyName ||
    currentClient.value.contactName ||
    `#${currentClient.value.id}`;
  try {
    await store.deleteClient(currentClient.value.id);
    deleteDialog.value = false;
    currentClient.value = null;
    showMessage(`Клієнта ${name} остаточно видалено`);
  } catch {
    showMessage(store.error, 'error');
  }
}

function openClient(client: Client) {
  void router.push(`/clients/${client.id}`);
}

watch(
  () => store.error,
  (error) => {
    if (error) showMessage(error, 'error');
  },
);

onMounted(async () => {
  const shouldOpenCreateDialog = route.query.create === '1';
  readQueryState();
  await syncQuery();
  await Promise.all([
    store.fetchManagers(),
    store.fetchClients(),
    loadTablePreferences(),
  ]);
  if (shouldOpenCreateDialog) {
    createDialog.value = true;
  }
});
</script>

<template>
  <div class="page-shell clients-page">
    <header class="page-header">
      <div>
        <div class="eyebrow">
          <span class="eyebrow__line" />
          База контактів
        </div>
        <h1 class="page-title">Клієнти</h1>
        <p class="page-subtitle">
          Усі контакти, статуси й відповідальні — в одному робочому просторі.
        </p>
      </div>

      <div class="header-actions">
        <v-btn
          v-if="!mdAndUp"
          variant="outlined"
          prepend-icon="mdi-tune-variant"
          @click="filtersDrawer = true"
        >
          Фільтр
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          class="add-button"
          @click="createDialog = true"
        >
          <span class="d-none d-sm-inline">Додати клієнта</span>
          <span class="d-sm-none">Додати</span>
        </v-btn>
      </div>
    </header>

    <ClientFiltersPanel
      v-if="mdAndUp"
      v-model="draftFilters"
      :managers="store.managers"
      class="mb-5"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <ClientTable
      :items="store.clients"
      :total="store.total"
      :page="store.page"
      :limit="store.limit"
      :sort="store.sort"
      :loading="store.loading"
      :visible-columns="visibleColumns"
      :preferences-saving="preferencesSaving"
      @update:page="updatePage"
      @update:limit="updateLimit"
      @update:sort="updateSort"
      @view="openClient"
      @edit="openEdit"
      @archive="requestArchive"
      @delete="requestDelete"
      @update:columns="updateTableColumns"
    />

    <v-navigation-drawer
      v-model="filtersDrawer"
      location="right"
      temporary
      width="360"
      class="filter-drawer"
    >
      <div class="drawer-header">
        <div>
          <div class="drawer-title">Фільтри</div>
          <div class="text-caption text-muted">Уточніть список клієнтів</div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрити фільтри"
          @click="filtersDrawer = false"
        />
      </div>
      <ClientFiltersPanel
        v-model="draftFilters"
        :managers="store.managers"
        mobile
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </v-navigation-drawer>

    <ClientCreateDialog
      v-model="createDialog"
      :managers="store.managers"
      :loading="store.saving"
      @save="createClient"
    />

    <ClientEditDialog
      v-model="editDialog"
      :client="currentClient"
      :managers="store.managers"
      :loading="store.saving"
      @save="updateClient"
    />

    <v-dialog v-model="archiveDialog" max-width="440">
      <v-card class="pa-2">
        <v-card-text class="text-center pt-7">
          <div class="archive-icon">
            <v-icon icon="mdi-archive-arrow-down-outline" size="28" />
          </div>
          <h3 class="archive-title">Архівувати клієнта?</h3>
          <p class="archive-copy">
            {{ currentClient?.companyName || currentClient?.contactName }}
            зникне з робочого списку. Дані збережуться в базі.
          </p>
        </v-card-text>
        <v-card-actions class="justify-center pb-5">
          <v-btn variant="text" @click="archiveDialog = false">Скасувати</v-btn>
          <v-btn
            color="error"
            variant="tonal"
            :loading="store.saving"
            @click="archiveClient"
          >
            Архівувати
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="460" persistent>
      <v-card class="pa-2">
        <v-card-text class="text-center pt-7">
          <div class="delete-icon">
            <v-icon icon="mdi-trash-can-outline" size="29" />
          </div>
          <h3 class="archive-title">Видалити клієнта остаточно?</h3>
          <p class="archive-copy">
            <strong>
              {{ currentClient?.companyName || currentClient?.contactName }}
            </strong>
            буде видалено з бази без можливості відновлення. Для тимчасового
            приховування використовуйте архів.
          </p>
        </v-card-text>
        <v-card-actions class="justify-center pb-5">
          <v-btn
            variant="text"
            :disabled="store.saving"
            @click="deleteDialog = false"
          >
            Скасувати
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            prepend-icon="mdi-trash-can-outline"
            :loading="store.saving"
            @click="deleteClient"
          >
            Видалити остаточно
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      location="bottom right"
      timeout="3800"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="snackbar = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.clients-page {
  animation: page-in 0.35s ease-out;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 27px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  color: #d87942;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.eyebrow__line {
  width: 23px;
  height: 1px;
  background: #d87942;
}

.header-actions {
  display: flex;
  gap: 9px;
}

.add-button {
  min-width: 190px;
  letter-spacing: 0;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 18px 12px;
}

.drawer-title {
  color: #17293e;
  font-family: Georgia, serif;
  font-size: 24px;
  font-weight: 700;
}

.archive-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 16px;
  border-radius: 18px;
  color: #ba4a4a;
  background: #fae9e8;
}

.delete-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 16px;
  border-radius: 18px;
  color: #ba4a4a;
  background: #fae9e8;
}

.archive-title {
  color: #213444;
  font-family: Georgia, serif;
  font-size: 22px;
}

.archive-copy {
  max-width: 330px;
  margin: 10px auto 0;
  color: #74818b;
  font-size: 13px;
  line-height: 1.6;
}

@keyframes page-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 700px) {
  .page-header {
    align-items: center;
  }

  .page-subtitle,
  .eyebrow {
    display: none;
  }

  .add-button {
    min-width: auto;
  }
}
</style>
