<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ClientDealDialog from '@/components/clients/ClientDealDialog.vue';
import { dealsApi } from '@/services/deals.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import { useClientsStore } from '@/stores/clients';
import {
  CLIENT_DEAL_CURRENCIES,
  CLIENT_DEAL_STAGES,
  type ClientDealCurrency,
  type ClientDealPayload,
  type ClientDealStage,
  type DealClientOption,
  type DealsResponse,
  type GlobalClientDeal,
} from '@/types/client';

const router = useRouter();
const auth = useAuthStore();
const clientsStore = useClientsStore();

const loading = ref(true);
const saving = ref(false);
const response = ref<DealsResponse | null>(null);
const page = ref(1);
const limit = ref(25);
const search = ref('');
const stages = ref<ClientDealStage[]>([]);
const currency = ref<ClientDealCurrency | null>(null);
const managerId = ref<number | null>(null);
const clientOptions = ref<DealClientOption[]>([]);
const clientPickerDialog = ref(false);
const selectedClientId = ref<number | null>(null);
const dealDialog = ref(false);
const editingDeal = ref<GlobalClientDeal | null>(null);
const deleteDialog = ref(false);
const dealToDelete = ref<GlobalClientDeal | null>(null);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const stageMeta: Record<
  ClientDealStage,
  { title: string; color: string; background: string; icon: string }
> = {
  NEW: {
    title: 'Нова',
    color: '#4f6f89',
    background: '#eaf1f6',
    icon: 'mdi-sparkles',
  },
  QUALIFICATION: {
    title: 'Кваліфікація',
    color: '#79652d',
    background: '#f6f1df',
    icon: 'mdi-filter-check-outline',
  },
  PROPOSAL: {
    title: 'Пропозиція',
    color: '#755b91',
    background: '#f1ecf7',
    icon: 'mdi-file-document-outline',
  },
  NEGOTIATION: {
    title: 'Переговори',
    color: '#9a642f',
    background: '#faf0e4',
    icon: 'mdi-forum-outline',
  },
  WON: {
    title: 'Успішна',
    color: '#26736a',
    background: '#e5f1ed',
    icon: 'mdi-trophy-outline',
  },
  LOST: {
    title: 'Втрачена',
    color: '#a14f55',
    background: '#f9e9ea',
    icon: 'mdi-close-circle-outline',
  },
};

const clientSelectItems = computed(() =>
  clientOptions.value.map((client) => ({
    value: client.id,
    title:
      client.companyName || client.contactName || `Клієнт #${client.id}`,
    subtitle: client.manager?.name || 'Без відповідального',
  })),
);

const activeValue = computed(() => {
  const values = response.value?.summary.activeValue ?? [];
  if (!values.length) return '—';
  return values
    .map((item) => formatMoney(item.amount, item.currency))
    .join(' + ');
});

const hasFilters = computed(
  () =>
    Boolean(search.value.trim()) ||
    Boolean(stages.value.length) ||
    Boolean(currency.value) ||
    Boolean(managerId.value),
);

function notify(message: string, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function formatMoney(amount: string | number, dealCurrency: string) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: dealCurrency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(value?: string | null) {
  if (!value) return 'Не визначено';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function clientName(deal: GlobalClientDeal) {
  return (
    deal.client.companyName ||
    deal.client.contactName ||
    `Клієнт #${deal.client.id}`
  );
}

function canManage(deal: GlobalClientDeal) {
  return (
    auth.isAdmin ||
    deal.ownerId === auth.user?.id ||
    deal.client.managerId === auth.user?.id
  );
}

async function fetchDeals() {
  loading.value = true;
  try {
    response.value = await dealsApi.getAll({
      page: page.value,
      limit: limit.value,
      search: search.value,
      stage: stages.value,
      currency: currency.value,
      managerId: managerId.value,
    });
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  page.value = 1;
  await fetchDeals();
}

async function resetFilters() {
  search.value = '';
  stages.value = [];
  currency.value = null;
  managerId.value = null;
  page.value = 1;
  await fetchDeals();
}

async function changePage(value: number) {
  page.value = value;
  await fetchDeals();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openNewDeal() {
  editingDeal.value = null;
  selectedClientId.value = null;
  if (!clientOptions.value.length) {
    try {
      clientOptions.value = await dealsApi.getClientOptions();
    } catch (error) {
      notify(getApiError(error), 'error');
      return;
    }
  }
  clientPickerDialog.value = true;
}

function continueNewDeal() {
  if (!selectedClientId.value) return;
  clientPickerDialog.value = false;
  dealDialog.value = true;
}

function openEditor(deal: GlobalClientDeal) {
  editingDeal.value = deal;
  selectedClientId.value = deal.clientId;
  dealDialog.value = true;
}

async function saveDeal(payload: ClientDealPayload) {
  if (!selectedClientId.value) return;
  saving.value = true;
  try {
    if (editingDeal.value) {
      await dealsApi.update(
        selectedClientId.value,
        editingDeal.value.id,
        payload,
      );
      notify('Угоду оновлено');
    } else {
      await dealsApi.create(selectedClientId.value, payload);
      notify('Угоду створено');
    }
    dealDialog.value = false;
    editingDeal.value = null;
    await fetchDeals();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function requestDelete(deal: GlobalClientDeal) {
  dealToDelete.value = deal;
  deleteDialog.value = true;
}

async function deleteDeal() {
  if (!dealToDelete.value) return;
  saving.value = true;
  try {
    await dealsApi.remove(
      dealToDelete.value.clientId,
      dealToDelete.value.id,
    );
    deleteDialog.value = false;
    dealToDelete.value = null;
    notify('Угоду видалено');
    await fetchDeals();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function openClient(id: number) {
  void router.push(`/clients/${id}`);
}

onMounted(async () => {
  await Promise.all([
    fetchDeals(),
    auth.isAdmin ? clientsStore.fetchManagers() : Promise.resolve(),
  ]);
});
</script>

<template>
  <div class="page-shell deals-page">
    <header class="deals-header">
      <div>
        <div class="eyebrow">
          <span class="eyebrow__line" />
          Воронка продажів
        </div>
        <h1 class="page-title">Угоди</h1>
        <p class="page-subtitle">
          Контролюйте суми, етапи та заплановані дати закриття в одному місці.
        </p>
      </div>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-plus"
        @click="openNewDeal"
      >
        Нова угода
      </v-btn>
    </header>

    <div class="deals-metrics">
      <v-card class="section-card deal-metric primary">
        <span class="deal-metric__icon">
          <v-icon icon="mdi-handshake-outline" />
        </span>
        <div>
          <small>Усього угод</small>
          <strong>{{ response?.summary.total ?? '—' }}</strong>
        </div>
      </v-card>
      <v-card class="section-card deal-metric">
        <span class="deal-metric__icon orange">
          <v-icon icon="mdi-progress-clock" />
        </span>
        <div>
          <small>Активні</small>
          <strong>{{ response?.summary.open ?? '—' }}</strong>
        </div>
      </v-card>
      <v-card class="section-card deal-metric">
        <span class="deal-metric__icon green">
          <v-icon icon="mdi-trophy-outline" />
        </span>
        <div>
          <small>Успішні</small>
          <strong>{{ response?.summary.won ?? '—' }}</strong>
        </div>
      </v-card>
      <v-card class="section-card deal-metric value">
        <span class="deal-metric__icon violet">
          <v-icon icon="mdi-cash-multiple" />
        </span>
        <div>
          <small>Активна сума</small>
          <strong>{{ activeValue }}</strong>
        </div>
      </v-card>
    </div>

    <v-card class="section-card filters-card">
      <div class="filter-fields">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Пошук"
          placeholder="Угода або клієнт"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          @keydown.enter="applyFilters"
          @click:clear="applyFilters"
        />
        <v-select
          v-model="stages"
          :items="CLIENT_DEAL_STAGES"
          label="Етап"
          variant="outlined"
          density="compact"
          multiple
          chips
          closable-chips
          hide-details
        />
        <v-select
          v-model="currency"
          :items="CLIENT_DEAL_CURRENCIES"
          label="Валюта"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        />
        <v-select
          v-if="auth.isAdmin"
          v-model="managerId"
          :items="clientsStore.managers"
          item-title="name"
          item-value="id"
          label="Менеджер"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        />
      </div>
      <div class="filter-actions">
        <v-btn
          v-if="hasFilters"
          variant="text"
          size="small"
          @click="resetFilters"
        >
          Очистити
        </v-btn>
        <v-btn color="primary" variant="tonal" @click="applyFilters">
          Застосувати
        </v-btn>
      </div>
    </v-card>

    <v-card class="section-card deals-list-card">
      <div class="list-heading">
        <div>
          <h2>Список угод</h2>
          <p>{{ response?.meta.total ?? 0 }} записів за вибраними умовами</p>
        </div>
      </div>

      <div v-if="loading" class="list-loading">
        <v-skeleton-loader
          v-for="item in 5"
          :key="item"
          type="list-item-avatar-three-line"
        />
      </div>

      <div v-else-if="response?.items.length" class="global-deal-list">
        <article
          v-for="deal in response.items"
          :key="deal.id"
          class="global-deal-row"
        >
          <div
            class="stage-mark"
            :style="{ background: stageMeta[deal.stage].background }"
          >
            <v-icon
              :icon="stageMeta[deal.stage].icon"
              :color="stageMeta[deal.stage].color"
              size="19"
            />
          </div>

          <div class="deal-main">
            <button type="button" @click="openClient(deal.client.id)">
              {{ clientName(deal) }}
            </button>
            <strong>{{ deal.title }}</strong>
            <span v-if="deal.description">{{ deal.description }}</span>
          </div>

          <div class="deal-stage-cell">
            <span
              :style="{
                color: stageMeta[deal.stage].color,
                background: stageMeta[deal.stage].background,
              }"
            >
              {{ stageMeta[deal.stage].title }}
            </span>
          </div>

          <div class="deal-date-cell">
            <small>Закриття</small>
            <strong>{{ formatDate(deal.expectedCloseAt) }}</strong>
          </div>

          <div class="deal-owner-cell">
            <small>Власник</small>
            <strong>{{ deal.ownerName }}</strong>
          </div>

          <div class="deal-value-cell">
            <strong>{{ formatMoney(deal.amount, deal.currency) }}</strong>
            <small>{{ deal.currency }}</small>
          </div>

          <div v-if="canManage(deal)" class="deal-row-actions">
            <v-btn
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              aria-label="Редагувати угоду"
              @click="openEditor(deal)"
            />
            <v-btn
              icon="mdi-trash-can-outline"
              variant="text"
              size="small"
              color="error"
              aria-label="Видалити угоду"
              @click="requestDelete(deal)"
            />
          </div>
        </article>
      </div>

      <div v-else class="empty-deals">
        <span><v-icon icon="mdi-handshake-outline" size="30" /></span>
        <h2>{{ hasFilters ? 'Нічого не знайдено' : 'Угод ще немає' }}</h2>
        <p>
          {{
            hasFilters
              ? 'Змініть параметри пошуку або очистьте фільтри.'
              : 'Створіть першу угоду та додайте її до воронки продажів.'
          }}
        </p>
        <v-btn
          v-if="!hasFilters"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          @click="openNewDeal"
        >
          Створити угоду
        </v-btn>
        <v-btn v-else color="primary" variant="text" @click="resetFilters">
          Очистити фільтри
        </v-btn>
      </div>

      <div
        v-if="response && response.meta.totalPages > 1"
        class="deals-pagination"
      >
        <v-pagination
          :model-value="page"
          :length="response.meta.totalPages"
          :total-visible="6"
          density="comfortable"
          @update:model-value="changePage"
        />
      </div>
    </v-card>

    <v-dialog v-model="clientPickerDialog" max-width="520">
      <v-card class="client-picker-card">
        <v-card-title>Оберіть клієнта</v-card-title>
        <v-card-text>
          <p>Угода буде додана до картки вибраного клієнта.</p>
          <v-autocomplete
            v-model="selectedClientId"
            :items="clientSelectItems"
            label="Клієнт"
            variant="outlined"
            item-title="title"
            item-value="value"
            no-data-text="Клієнтів не знайдено"
            autofocus
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :subtitle="item.raw.subtitle"
              />
            </template>
          </v-autocomplete>
          <v-alert
            v-if="!clientOptions.length"
            type="info"
            variant="tonal"
            density="compact"
          >
            Спочатку створіть або призначте собі клієнта.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="clientPickerDialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!selectedClientId"
            @click="continueNewDeal"
          >
            Продовжити
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ClientDealDialog
      v-model="dealDialog"
      :deal="editingDeal"
      :loading="saving"
      @save="saveDeal"
    />

    <v-dialog v-model="deleteDialog" max-width="430">
      <v-card class="delete-card">
        <v-card-title>Видалити угоду?</v-card-title>
        <v-card-text>
          Угоду «{{ dealToDelete?.title }}» буде видалено без можливості
          відновлення.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="deleteDialog = false">
            Скасувати
          </v-btn>
          <v-btn color="error" :loading="saving" @click="deleteDeal">
            Видалити
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      location="bottom right"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="snackbar = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.deals-page {
  animation: page-in 0.35s ease-out;
}

.deals-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
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

.deals-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.deal-metric {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 105px;
  padding: 18px;
}

.deal-metric.primary {
  color: #fff;
  border-color: #1d625b;
  background:
    radial-gradient(circle at 100% 0%, rgba(241, 183, 108, 0.25), transparent 55%),
    #26736a;
}

.deal-metric__icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 13px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
}

.deal-metric:not(.primary) .deal-metric__icon {
  color: #506f88;
  background: #eaf1f6;
}

.deal-metric:not(.primary) .deal-metric__icon.orange {
  color: #9a642f;
  background: #faf0e4;
}

.deal-metric:not(.primary) .deal-metric__icon.green {
  color: #26736a;
  background: #e5f1ed;
}

.deal-metric:not(.primary) .deal-metric__icon.violet {
  color: #755b91;
  background: #f1ecf7;
}

.deal-metric small,
.deal-metric strong {
  display: block;
}

.deal-metric small {
  color: #8c979e;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.deal-metric.primary small {
  color: rgba(255, 255, 255, 0.65);
}

.deal-metric strong {
  margin-top: 5px;
  color: #263a47;
  font-family: Georgia, serif;
  font-size: 25px;
  line-height: 1.1;
}

.deal-metric.primary strong {
  color: #fff;
}

.deal-metric.value strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.filters-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 14px;
}

.filter-fields {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: minmax(180px, 1.5fr) repeat(3, minmax(145px, 1fr));
  gap: 10px;
}

.filter-actions {
  display: flex;
  gap: 5px;
}

.deals-list-card {
  margin-top: 14px;
  overflow: hidden;
}

.list-heading {
  padding: 20px 22px 14px;
}

.list-heading h2 {
  margin: 0;
  color: #263946;
  font-family: Georgia, serif;
  font-size: 20px;
}

.list-heading p {
  margin: 4px 0 0;
  color: #909aa1;
  font-size: 10px;
}

.list-loading {
  padding: 0 14px 15px;
}

.global-deal-row {
  display: grid;
  align-items: center;
  min-height: 94px;
  padding: 14px 18px;
  border-top: 1px solid #edf0ed;
  grid-template-columns:
    42px minmax(180px, 1.7fr) minmax(110px, 0.8fr)
    minmax(105px, 0.8fr) minmax(100px, 0.8fr) minmax(115px, 0.8fr) 72px;
  gap: 13px;
}

.global-deal-row:hover {
  background: #fbfcfb;
}

.stage-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
}

.deal-main {
  min-width: 0;
}

.deal-main button {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  color: #26736a;
  background: transparent;
  font: inherit;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
}

.deal-main strong,
.deal-main span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deal-main strong {
  margin-top: 4px;
  color: #344650;
  font-size: 13px;
}

.deal-main span {
  margin-top: 3px;
  color: #959da3;
  font-size: 9px;
}

.deal-stage-cell > span {
  display: inline-flex;
  padding: 6px 9px;
  border-radius: 9px;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.deal-date-cell small,
.deal-date-cell strong,
.deal-owner-cell small,
.deal-owner-cell strong,
.deal-value-cell small,
.deal-value-cell strong {
  display: block;
}

.deal-date-cell small,
.deal-owner-cell small,
.deal-value-cell small {
  color: #9aa2a7;
  font-size: 8px;
  text-transform: uppercase;
}

.deal-date-cell strong,
.deal-owner-cell strong {
  margin-top: 4px;
  color: #5a6871;
  font-size: 10px;
}

.deal-value-cell {
  text-align: right;
}

.deal-value-cell strong {
  color: #263b47;
  font-size: 13px;
}

.deal-value-cell small {
  margin-top: 3px;
}

.deal-row-actions {
  display: flex;
}

.empty-deals {
  display: flex;
  min-height: 340px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  padding: 30px;
  text-align: center;
}

.empty-deals > span {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 14px;
  border-radius: 18px;
  color: #26736a;
  background: #e8f2ef;
  place-items: center;
}

.empty-deals h2 {
  margin: 0;
  color: #30434f;
  font-family: Georgia, serif;
  font-size: 20px;
}

.empty-deals p {
  max-width: 420px;
  margin: 8px 0 18px;
  color: #8b969d;
  font-size: 11px;
}

.deals-pagination {
  display: flex;
  justify-content: center;
  padding: 16px;
  border-top: 1px solid #edf0ed;
}

.client-picker-card,
.delete-card {
  padding: 8px;
}

.client-picker-card :deep(.v-card-title),
.delete-card :deep(.v-card-title) {
  color: #2b3e4b;
  font-family: Georgia, serif;
}

.client-picker-card p {
  margin: 0 0 16px;
  color: #7d8991;
  font-size: 11px;
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

@media (max-width: 1250px) {
  .deals-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .global-deal-row {
    grid-template-columns: 42px minmax(180px, 1.5fr) minmax(110px, 0.8fr) minmax(105px, 0.8fr) minmax(115px, 0.8fr) 72px;
  }

  .deal-owner-cell {
    display: none;
  }
}

@media (max-width: 960px) {
  .filters-card {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-actions {
    justify-content: flex-end;
  }

  .global-deal-row {
    grid-template-columns: 42px minmax(170px, 1.6fr) minmax(105px, 0.8fr) minmax(110px, 0.8fr) 72px;
  }

  .deal-date-cell {
    display: none;
  }
}

@media (max-width: 700px) {
  .deals-header {
    align-items: stretch;
    flex-direction: column;
  }

  .eyebrow,
  .page-subtitle {
    display: none;
  }

  .deals-metrics {
    gap: 9px;
  }

  .deal-metric {
    align-items: flex-start;
    min-height: 130px;
    flex-direction: column;
    padding: 14px;
  }

  .filter-fields {
    grid-template-columns: 1fr;
  }

  .global-deal-row {
    align-items: start;
    padding: 16px;
    grid-template-columns: 40px minmax(0, 1fr) auto;
  }

  .deal-main {
    grid-column: 2;
  }

  .deal-stage-cell {
    grid-column: 2;
  }

  .deal-value-cell {
    grid-column: 2;
    text-align: left;
  }

  .deal-row-actions {
    grid-column: 3;
    grid-row: 1 / 4;
  }
}
</style>
