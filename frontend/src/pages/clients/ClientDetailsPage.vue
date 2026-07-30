<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ClientDealDialog from '@/components/clients/ClientDealDialog.vue';
import ClientCommentsPanel from '@/components/clients/ClientCommentsPanel.vue';
import ClientDocumentsPanel from '@/components/clients/ClientDocumentsPanel.vue';
import ClientEditDialog from '@/components/clients/ClientEditDialog.vue';
import ClientStatusChip from '@/components/clients/ClientStatusChip.vue';
import ClientTasksPanel from '@/components/clients/ClientTasksPanel.vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import { useClientsStore } from '@/stores/clients';
import {
  CLIENT_ACTIVITY_TYPES,
  CLIENT_DEAL_STAGES,
  CLIENT_TYPES,
  clientDisplayName,
  type ClientActivity,
  type ClientActivityType,
  type ClientDeal,
  type ClientDealPayload,
  type ClientDealStage,
  type ClientPayload,
  type ManualClientActivityType,
} from '@/types/client';

const route = useRoute();
const router = useRouter();
const store = useClientsStore();
const auth = useAuthStore();

const editDialog = ref(false);
const activeTab = ref('overview');
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('primary');
const activities = ref<ClientActivity[]>([]);
const activitiesLoading = ref(false);
const activitySaving = ref(false);
const composerOpen = ref(false);
const activityFilter = ref<'ALL' | ClientActivityType>('ALL');
const deleteActivityDialog = ref(false);
const activityToDelete = ref<ClientActivity | null>(null);
const deals = ref<ClientDeal[]>([]);
const dealsLoading = ref(false);
const dealSaving = ref(false);
const dealDialog = ref(false);
const editingDeal = ref<ClientDeal | null>(null);
const dealFilter = ref<'ALL' | ClientDealStage>('ALL');
const deleteDealDialog = ref(false);
const dealToDelete = ref<ClientDeal | null>(null);
const clientId = computed(() => Number(route.params.id));
const client = computed(() => store.selectedClient);
const creatorDisplayName = computed(
  () =>
    client.value?.creator?.name ||
    client.value?.creatorName ||
    'Автор не зафіксований',
);

const currentLocalDateTime = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const activityForm = reactive<{
  type: ManualClientActivityType;
  content: string;
  occurredAt: string;
}>({
  type: 'NOTE',
  content: '',
  occurredAt: currentLocalDateTime(),
});

const activityMeta: Record<
  ClientActivityType,
  { title: string; icon: string; color: string; background: string }
> = {
  NOTE: {
    title: 'Нотатка',
    icon: 'mdi-note-text-outline',
    color: '#3b6f67',
    background: '#e8f2ef',
  },
  CALL: {
    title: 'Дзвінок',
    icon: 'mdi-phone-outline',
    color: '#356a96',
    background: '#e9f2f9',
  },
  EMAIL: {
    title: 'Email',
    icon: 'mdi-email-outline',
    color: '#755b91',
    background: '#f1ecf7',
  },
  MEETING: {
    title: 'Зустріч',
    icon: 'mdi-account-group-outline',
    color: '#9a642f',
    background: '#faf0e4',
  },
  STATUS_CHANGE: {
    title: 'Зміна статусу',
    icon: 'mdi-swap-horizontal',
    color: '#8a6b2f',
    background: '#f8f2df',
  },
  SYSTEM: {
    title: 'Системна подія',
    icon: 'mdi-cog-outline',
    color: '#65717a',
    background: '#edf0f2',
  },
};

const manualActivityOptions = CLIENT_ACTIVITY_TYPES.map((option) => ({
  ...option,
  ...activityMeta[option.value],
}));

const activityFilterOptions: {
  title: string;
  value: 'ALL' | ClientActivityType;
}[] = [
  { title: 'Усі', value: 'ALL' },
  ...CLIENT_ACTIVITY_TYPES,
  { title: 'Зміни статусу', value: 'STATUS_CHANGE' },
  { title: 'Системні', value: 'SYSTEM' },
];

const filteredActivities = computed(() =>
  activityFilter.value === 'ALL'
    ? activities.value
    : activities.value.filter(
        (activity) => activity.type === activityFilter.value,
      ),
);

const dealStageMeta: Record<
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

const dealFilterOptions: {
  title: string;
  value: 'ALL' | ClientDealStage;
}[] = [{ title: 'Усі', value: 'ALL' }, ...CLIENT_DEAL_STAGES];

const filteredDeals = computed(() =>
  dealFilter.value === 'ALL'
    ? deals.value
    : deals.value.filter((deal) => deal.stage === dealFilter.value),
);

const openDeals = computed(() =>
  deals.value.filter((deal) => !['WON', 'LOST'].includes(deal.stage)),
);

const wonDeals = computed(() =>
  deals.value.filter((deal) => deal.stage === 'WON'),
);

const typeLabel = computed(
  () =>
    CLIENT_TYPES.find((item) => item.value === client.value?.type)?.title ?? '',
);

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
};

const formatMoney = (amount: string | number, currency: string) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));

function formatDealTotals(items: ClientDeal[]) {
  if (!items.length) return '—';
  const totals = items.reduce<Record<string, number>>((result, deal) => {
    result[deal.currency] =
      (result[deal.currency] ?? 0) + Number(deal.amount);
    return result;
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(' + ');
}

function notify(message: string, color = 'primary') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function resetActivityForm() {
  activityForm.type = 'NOTE';
  activityForm.content = '';
  activityForm.occurredAt = currentLocalDateTime();
}

async function fetchActivities() {
  activitiesLoading.value = true;
  try {
    activities.value = await clientsApi.getActivities(clientId.value);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    activitiesLoading.value = false;
  }
}

async function fetchDeals() {
  dealsLoading.value = true;
  try {
    deals.value = await clientsApi.getDeals(clientId.value);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    dealsLoading.value = false;
  }
}

async function addActivity() {
  if (!activityForm.content.trim()) {
    notify('Опишіть результат взаємодії з клієнтом', 'warning');
    return;
  }

  activitySaving.value = true;
  try {
    const activity = await clientsApi.createActivity(clientId.value, {
      type: activityForm.type,
      content: activityForm.content.trim(),
      occurredAt: activityForm.occurredAt
        ? new Date(activityForm.occurredAt).toISOString()
        : undefined,
    });
    activities.value = [activity, ...activities.value];
    resetActivityForm();
    composerOpen.value = false;
    activityFilter.value = 'ALL';
    notify('Активність додано');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    activitySaving.value = false;
  }
}

function canDeleteActivity(activity: ClientActivity) {
  const isManual = !['SYSTEM', 'STATUS_CHANGE'].includes(activity.type);
  return (
    auth.isAdmin ||
    (isManual && activity.authorId !== null && activity.authorId === auth.user?.id)
  );
}

function requestActivityDelete(activity: ClientActivity) {
  activityToDelete.value = activity;
  deleteActivityDialog.value = true;
}

async function deleteActivity() {
  if (!activityToDelete.value) return;

  activitySaving.value = true;
  try {
    await clientsApi.removeActivity(clientId.value, activityToDelete.value.id);
    activities.value = activities.value.filter(
      (activity) => activity.id !== activityToDelete.value?.id,
    );
    deleteActivityDialog.value = false;
    activityToDelete.value = null;
    notify('Запис активності видалено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    activitySaving.value = false;
  }
}

function openNewDeal() {
  editingDeal.value = null;
  dealDialog.value = true;
}

function openDealEditor(deal: ClientDeal) {
  editingDeal.value = deal;
  dealDialog.value = true;
}

function canManageDeal(deal: ClientDeal) {
  return (
    auth.isAdmin ||
    deal.ownerId === auth.user?.id ||
    client.value?.managerId === auth.user?.id
  );
}

async function saveDeal(payload: ClientDealPayload) {
  dealSaving.value = true;
  try {
    if (editingDeal.value) {
      const updated = await clientsApi.updateDeal(
        clientId.value,
        editingDeal.value.id,
        payload,
      );
      deals.value = deals.value.map((deal) =>
        deal.id === updated.id ? updated : deal,
      );
      notify('Угоду оновлено');
    } else {
      const created = await clientsApi.createDeal(clientId.value, payload);
      deals.value = [created, ...deals.value];
      dealFilter.value = 'ALL';
      notify('Угоду створено');
    }
    dealDialog.value = false;
    editingDeal.value = null;
    await fetchActivities();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    dealSaving.value = false;
  }
}

function requestDealDelete(deal: ClientDeal) {
  dealToDelete.value = deal;
  deleteDealDialog.value = true;
}

async function deleteDeal() {
  if (!dealToDelete.value) return;

  dealSaving.value = true;
  try {
    await clientsApi.removeDeal(clientId.value, dealToDelete.value.id);
    deals.value = deals.value.filter(
      (deal) => deal.id !== dealToDelete.value?.id,
    );
    deleteDealDialog.value = false;
    dealToDelete.value = null;
    await fetchActivities();
    notify('Угоду видалено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    dealSaving.value = false;
  }
}

async function saveClient(payload: ClientPayload) {
  if (!client.value) return;
  try {
    await store.updateClient(client.value.id, payload);
    await fetchActivities();
    editDialog.value = false;
    notify('Картку клієнта оновлено');
  } catch {
    notify(store.error, 'error');
  }
}

onMounted(async () => {
  await store.fetchManagers();
  if (!Number.isInteger(clientId.value)) {
    await router.replace('/clients');
    return;
  }
  try {
    await store.fetchClient(clientId.value);
    await Promise.all([fetchActivities(), fetchDeals()]);
  } catch {
    // Error state is rendered below.
  }
});
</script>

<template>
  <div class="page-shell details-page">
    <div class="details-toolbar">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="back-button"
        @click="router.push('/clients')"
      >
        Усі клієнти
      </v-btn>
      <div v-if="client" class="record-number">Картка #{{ client.id }}</div>
    </div>

    <template v-if="store.detailsLoading">
      <v-skeleton-loader type="heading, paragraph, image" class="section-card" />
    </template>

    <v-card v-else-if="store.error && !client" class="section-card error-card">
      <v-icon icon="mdi-alert-circle-outline" size="42" color="error" />
      <h2>Не вдалося відкрити клієнта</h2>
      <p>{{ store.error }}</p>
      <v-btn color="primary" @click="router.push('/clients')">
        Повернутися до списку
      </v-btn>
    </v-card>

    <template v-else-if="client">
      <v-card class="section-card hero-card">
        <div class="hero-accent" />
        <div class="hero-main">
          <v-avatar size="76" color="#e8f2ee" class="hero-avatar">
            {{ clientDisplayName(client).slice(0, 2).toUpperCase() }}
          </v-avatar>
          <div class="hero-copy">
            <div class="hero-meta">
              {{ typeLabel }}
              <span />
              Додано {{ formatDate(client.createdAt) }}
            </div>
            <h1>{{ clientDisplayName(client) }}</h1>
            <div v-if="client.companyName && client.contactName" class="contact-name">
              {{ client.contactName }}
            </div>
            <ClientStatusChip :status="client.status" class="mt-3" />
          </div>

          <div class="hero-actions">
            <v-btn
              v-if="client.phone"
              :href="`tel:${client.phone}`"
              variant="outlined"
              prepend-icon="mdi-phone-outline"
            >
              Зателефонувати
            </v-btn>
            <v-btn
              v-if="client.email"
              :href="`mailto:${client.email}`"
              variant="outlined"
              prepend-icon="mdi-email-outline"
            >
              Написати
            </v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-pencil-outline"
              @click="editDialog = true"
            >
              Редагувати
            </v-btn>
          </div>
        </div>
      </v-card>

      <div class="details-grid">
        <div class="details-main">
          <v-card class="section-card info-card">
            <div class="card-heading">
              <div>
                <h2>Контактна інформація</h2>
                <p>Основні дані клієнта</p>
              </div>
              <v-icon icon="mdi-card-account-details-outline" color="#8a979f" />
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span class="info-icon"><v-icon icon="mdi-phone-outline" /></span>
                <div>
                  <label>Телефон</label>
                  <a v-if="client.phone" :href="`tel:${client.phone}`">
                    {{ client.phone }}
                  </a>
                  <strong v-else>—</strong>
                  <small v-if="client.secondaryPhone">
                    {{ client.secondaryPhone }}
                  </small>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon"><v-icon icon="mdi-email-outline" /></span>
                <div>
                  <label>Email</label>
                  <a v-if="client.email" :href="`mailto:${client.email}`">
                    {{ client.email }}
                  </a>
                  <strong v-else>—</strong>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon"><v-icon icon="mdi-identifier" /></span>
                <div>
                  <label>ЄДРПОУ / ІПН</label>
                  <strong>{{ client.edrpou || '—' }}</strong>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon"><v-icon icon="mdi-map-marker-outline" /></span>
                <div>
                  <label>Адреса</label>
                  <strong>{{ [client.city, client.address].filter(Boolean).join(', ') || '—' }}</strong>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon"><v-icon icon="mdi-web" /></span>
                <div>
                  <label>Сайт</label>
                  <a
                    v-if="client.website"
                    :href="client.website"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ client.website }}
                  </a>
                  <strong v-else>—</strong>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon"><v-icon icon="mdi-source-branch" /></span>
                <div>
                  <label>Джерело</label>
                  <strong>{{ client.source || '—' }}</strong>
                </div>
              </div>
            </div>

            <div v-if="client.comment" class="comment-box">
              <div class="comment-label">
                <v-icon icon="mdi-text-box-outline" size="16" />
                Коментар
              </div>
              <p>{{ client.comment }}</p>
            </div>
          </v-card>

          <v-card class="section-card activity-card">
            <v-tabs v-model="activeTab" color="primary" class="activity-tabs">
              <v-tab value="overview">Активність</v-tab>
              <v-tab value="comments">Коментарі</v-tab>
              <v-tab value="tasks">Завдання</v-tab>
              <v-tab value="deals">Угоди</v-tab>
              <v-tab value="documents">Документи</v-tab>
            </v-tabs>
            <v-divider />
            <v-window v-model="activeTab">
              <v-window-item value="overview">
                <div class="activity-panel">
                  <div class="activity-toolbar">
                    <div>
                      <h3>Історія взаємодій</h3>
                      <p>
                        {{ activities.length }}
                        {{
                          activities.length === 1
                            ? 'подія'
                            : activities.length > 1 && activities.length < 5
                              ? 'події'
                              : 'подій'
                        }}
                      </p>
                    </div>
                    <v-btn
                      color="primary"
                      prepend-icon="mdi-plus"
                      @click="composerOpen = !composerOpen"
                    >
                      Додати активність
                    </v-btn>
                  </div>

                  <v-expand-transition>
                    <div v-if="composerOpen" class="activity-composer">
                      <div class="composer-heading">
                        <div>
                          <strong>Нова активність</strong>
                          <span>Зафіксуйте результат контакту з клієнтом</span>
                        </div>
                        <v-btn
                          icon="mdi-close"
                          variant="text"
                          size="small"
                          aria-label="Закрити форму"
                          @click="composerOpen = false"
                        />
                      </div>

                      <div class="activity-type-grid">
                        <button
                          v-for="option in manualActivityOptions"
                          :key="option.value"
                          type="button"
                          class="activity-type-button"
                          :class="{ active: activityForm.type === option.value }"
                          :style="{
                            '--activity-color': option.color,
                            '--activity-background': option.background,
                          }"
                          @click="activityForm.type = option.value"
                        >
                          <v-icon :icon="option.icon" size="18" />
                          {{ option.title }}
                        </button>
                      </div>

                      <v-textarea
                        v-model="activityForm.content"
                        label="Що відбулося?"
                        placeholder="Наприклад: обговорили умови та домовилися про наступний дзвінок"
                        variant="outlined"
                        rows="3"
                        auto-grow
                        maxlength="5000"
                        counter
                        hide-details="auto"
                        class="activity-textarea"
                        @keydown.ctrl.enter="addActivity"
                      />

                      <div class="composer-footer">
                        <v-text-field
                          v-model="activityForm.occurredAt"
                          type="datetime-local"
                          label="Дата й час"
                          variant="outlined"
                          density="compact"
                          hide-details
                          class="activity-date-field"
                        />
                        <div class="composer-actions">
                          <v-btn
                            variant="text"
                            :disabled="activitySaving"
                            @click="composerOpen = false"
                          >
                            Скасувати
                          </v-btn>
                          <v-btn
                            color="primary"
                            prepend-icon="mdi-check"
                            :loading="activitySaving"
                            :disabled="!activityForm.content.trim()"
                            @click="addActivity"
                          >
                            Зберегти
                          </v-btn>
                        </div>
                      </div>
                    </div>
                  </v-expand-transition>

                  <div class="activity-filters">
                    <button
                      v-for="filter in activityFilterOptions"
                      :key="filter.value"
                      type="button"
                      :class="{ active: activityFilter === filter.value }"
                      @click="activityFilter = filter.value"
                    >
                      {{ filter.title }}
                    </button>
                  </div>

                  <div v-if="activitiesLoading" class="activity-loading">
                    <v-skeleton-loader
                      v-for="item in 3"
                      :key="item"
                      type="list-item-avatar-three-line"
                    />
                  </div>

                  <div
                    v-else-if="filteredActivities.length"
                    class="activity-timeline"
                  >
                    <article
                      v-for="activity in filteredActivities"
                      :key="activity.id"
                      class="timeline-item"
                    >
                      <div
                        class="timeline-icon"
                        :style="{
                          color: activityMeta[activity.type].color,
                          background: activityMeta[activity.type].background,
                        }"
                      >
                        <v-icon
                          :icon="activityMeta[activity.type].icon"
                          size="19"
                        />
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-heading">
                          <div class="timeline-title">
                            <strong>{{ activityMeta[activity.type].title }}</strong>
                            <span>{{ activity.authorName }}</span>
                          </div>
                          <div class="timeline-actions">
                            <time :datetime="activity.occurredAt">
                              {{ formatDate(activity.occurredAt, true) }}
                            </time>
                            <v-btn
                              v-if="canDeleteActivity(activity)"
                              icon="mdi-trash-can-outline"
                              variant="text"
                              size="x-small"
                              color="error"
                              aria-label="Видалити активність"
                              @click="requestActivityDelete(activity)"
                            />
                          </div>
                        </div>
                        <p>{{ activity.content }}</p>
                      </div>
                    </article>
                  </div>

                  <div v-else class="activity-empty timeline-empty">
                    <div class="activity-empty__icon">
                      <v-icon icon="mdi-timeline-clock-outline" size="28" />
                    </div>
                    <h3>
                      {{
                        activityFilter === 'ALL'
                          ? 'Історія починається тут'
                          : 'У цій категорії ще немає подій'
                      }}
                    </h3>
                    <p v-if="activityFilter === 'ALL'">
                      Додайте нотатку, дзвінок, email або зустріч — усе
                      зберігатиметься в єдиній стрічці клієнта.
                    </p>
                    <v-btn
                      v-else
                      variant="text"
                      color="primary"
                      @click="activityFilter = 'ALL'"
                    >
                      Показати всю історію
                    </v-btn>
                  </div>
                </div>
              </v-window-item>
              <v-window-item value="comments">
                <ClientCommentsPanel :client-id="client.id" />
              </v-window-item>
              <v-window-item value="deals">
                <div class="deals-panel">
                  <div class="deals-toolbar">
                    <div>
                      <h3>Угоди клієнта</h3>
                      <p>Воронка продажів, суми та заплановані дати закриття</p>
                    </div>
                    <v-btn
                      color="primary"
                      prepend-icon="mdi-plus"
                      @click="openNewDeal"
                    >
                      Нова угода
                    </v-btn>
                  </div>

                  <div class="deal-summary-grid">
                    <div class="deal-summary-card">
                      <span class="deal-summary-icon all">
                        <v-icon icon="mdi-handshake-outline" size="19" />
                      </span>
                      <div>
                        <small>Усього угод</small>
                        <strong>{{ deals.length }}</strong>
                      </div>
                    </div>
                    <div class="deal-summary-card">
                      <span class="deal-summary-icon open">
                        <v-icon icon="mdi-progress-clock" size="19" />
                      </span>
                      <div>
                        <small>Активні</small>
                        <strong>{{ openDeals.length }}</strong>
                      </div>
                    </div>
                    <div class="deal-summary-card">
                      <span class="deal-summary-icon won">
                        <v-icon icon="mdi-trophy-outline" size="19" />
                      </span>
                      <div>
                        <small>Успішні</small>
                        <strong>{{ wonDeals.length }}</strong>
                      </div>
                    </div>
                    <div class="deal-summary-card value">
                      <span class="deal-summary-icon money">
                        <v-icon icon="mdi-cash-multiple" size="19" />
                      </span>
                      <div>
                        <small>Активна сума</small>
                        <strong>{{ formatDealTotals(openDeals) }}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="deal-filters">
                    <button
                      v-for="filter in dealFilterOptions"
                      :key="filter.value"
                      type="button"
                      :class="{ active: dealFilter === filter.value }"
                      @click="dealFilter = filter.value"
                    >
                      {{ filter.title }}
                      <span v-if="filter.value !== 'ALL'">
                        {{
                          deals.filter((deal) => deal.stage === filter.value)
                            .length
                        }}
                      </span>
                    </button>
                  </div>

                  <div v-if="dealsLoading" class="deals-loading">
                    <v-skeleton-loader
                      v-for="item in 3"
                      :key="item"
                      type="article"
                    />
                  </div>

                  <div v-else-if="filteredDeals.length" class="deal-list">
                    <article
                      v-for="deal in filteredDeals"
                      :key="deal.id"
                      class="deal-card"
                    >
                      <div class="deal-card-heading">
                        <span
                          class="deal-stage"
                          :style="{
                            color: dealStageMeta[deal.stage].color,
                            background: dealStageMeta[deal.stage].background,
                          }"
                        >
                          <v-icon
                            :icon="dealStageMeta[deal.stage].icon"
                            size="14"
                          />
                          {{ dealStageMeta[deal.stage].title }}
                        </span>
                        <div v-if="canManageDeal(deal)" class="deal-card-actions">
                          <v-btn
                            icon="mdi-pencil-outline"
                            variant="text"
                            size="x-small"
                            aria-label="Редагувати угоду"
                            @click="openDealEditor(deal)"
                          />
                          <v-btn
                            icon="mdi-trash-can-outline"
                            variant="text"
                            size="x-small"
                            color="error"
                            aria-label="Видалити угоду"
                            @click="requestDealDelete(deal)"
                          />
                        </div>
                      </div>

                      <h4>{{ deal.title }}</h4>
                      <p v-if="deal.description" class="deal-description">
                        {{ deal.description }}
                      </p>

                      <div class="deal-amount">
                        {{ formatMoney(deal.amount, deal.currency) }}
                      </div>

                      <div class="deal-meta">
                        <span>
                          <v-icon icon="mdi-calendar-outline" size="15" />
                          {{
                            deal.expectedCloseAt
                              ? `До ${formatDate(deal.expectedCloseAt)}`
                              : 'Дата не визначена'
                          }}
                        </span>
                        <span>
                          <v-icon icon="mdi-account-outline" size="15" />
                          {{ deal.ownerName }}
                        </span>
                      </div>
                    </article>
                  </div>

                  <div v-else class="activity-empty deals-empty">
                    <div class="activity-empty__icon">
                      <v-icon icon="mdi-handshake-outline" size="29" />
                    </div>
                    <h3>
                      {{
                        dealFilter === 'ALL'
                          ? 'Угод ще немає'
                          : 'На цьому етапі немає угод'
                      }}
                    </h3>
                    <p v-if="dealFilter === 'ALL'">
                      Створіть першу угоду, щоб контролювати суму, етап і
                      заплановану дату закриття.
                    </p>
                    <v-btn
                      v-if="dealFilter === 'ALL'"
                      color="primary"
                      variant="tonal"
                      prepend-icon="mdi-plus"
                      @click="openNewDeal"
                    >
                      Створити угоду
                    </v-btn>
                    <v-btn
                      v-else
                      variant="text"
                      color="primary"
                      @click="dealFilter = 'ALL'"
                    >
                      Показати всі угоди
                    </v-btn>
                  </div>
                </div>
              </v-window-item>
              <v-window-item value="documents">
                <ClientDocumentsPanel
                  :client-id="client.id"
                  :client-manager-id="client.managerId"
                  @changed="fetchActivities"
                />
              </v-window-item>
              <v-window-item value="tasks">
                <ClientTasksPanel
                  :client-id="client.id"
                  :client-manager-id="client.managerId"
                  :managers="store.managers"
                  @changed="fetchActivities"
                />
              </v-window-item>
            </v-window>
          </v-card>
        </div>

        <aside class="details-aside">
          <v-card class="section-card manager-card">
            <div class="aside-label">Відповідальний</div>
            <div v-if="client.manager" class="manager-profile">
              <v-avatar color="#17293e" size="46">
                {{ client.manager.name.split(' ').map((part) => part[0]).join('').slice(0, 2) }}
              </v-avatar>
              <div>
                <strong>{{ client.manager.name }}</strong>
                <a :href="`mailto:${client.manager.email}`">{{ client.manager.email }}</a>
              </div>
            </div>
            <div v-else class="unassigned-manager">
              <v-icon icon="mdi-account-question-outline" />
              Менеджера не призначено
            </div>
          </v-card>

          <v-card class="section-card manager-card creator-card">
            <div class="aside-label">Створив клієнта</div>
            <div
              v-if="client.creator || client.creatorName"
              class="manager-profile"
            >
              <v-avatar color="#e8f2ee" size="46" class="creator-avatar">
                {{
                  creatorDisplayName
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                }}
              </v-avatar>
              <div>
                <strong>{{ creatorDisplayName }}</strong>
                <a
                  v-if="client.creator?.email"
                  :href="`mailto:${client.creator.email}`"
                >
                  {{ client.creator.email }}
                </a>
                <small class="creator-role">
                  {{
                    client.creator?.role === 'ADMIN'
                      ? 'Адміністратор'
                      : 'Менеджер-автор'
                  }}
                </small>
              </div>
            </div>
            <div v-else class="unassigned-manager">
              <v-icon icon="mdi-account-clock-outline" />
              Автор не зафіксований
            </div>
          </v-card>

          <v-card class="section-card record-card">
            <div class="aside-label">Про запис</div>
            <dl>
              <div>
                <dt>Створено</dt>
                <dd>{{ formatDate(client.createdAt, true) }}</dd>
              </div>
              <div>
                <dt>Оновлено</dt>
                <dd>{{ formatDate(client.updatedAt, true) }}</dd>
              </div>
              <div>
                <dt>ID клієнта</dt>
                <dd>#{{ client.id }}</dd>
              </div>
            </dl>
          </v-card>
        </aside>
      </div>

      <ClientEditDialog
        v-model="editDialog"
        :client="client"
        :managers="store.managers"
        :loading="store.saving"
        @save="saveClient"
      />

      <ClientDealDialog
        v-model="dealDialog"
        :deal="editingDeal"
        :loading="dealSaving"
        @save="saveDeal"
      />

      <v-dialog v-model="deleteActivityDialog" max-width="430">
        <v-card class="delete-activity-card">
          <v-card-title>Видалити активність?</v-card-title>
          <v-card-text>
            Запис «{{ activityToDelete?.content }}» буде видалено без можливості
            відновлення.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              variant="text"
              :disabled="activitySaving"
              @click="deleteActivityDialog = false"
            >
              Скасувати
            </v-btn>
            <v-btn
              color="error"
              variant="flat"
              :loading="activitySaving"
              @click="deleteActivity"
            >
              Видалити
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDealDialog" max-width="430">
        <v-card class="delete-activity-card">
          <v-card-title>Видалити угоду?</v-card-title>
          <v-card-text>
            Угоду «{{ dealToDelete?.title }}» буде видалено без можливості
            відновлення. Подія про видалення залишиться в історії клієнта.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              variant="text"
              :disabled="dealSaving"
              @click="deleteDealDialog = false"
            >
              Скасувати
            </v-btn>
            <v-btn
              color="error"
              variant="flat"
              :loading="dealSaving"
              @click="deleteDeal"
            >
              Видалити
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <v-snackbar
      v-model="snackbar"
      location="bottom right"
      :color="snackbarColor"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="snackbar = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.details-page {
  animation: details-in 0.35s ease-out;
}

.details-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.back-button {
  margin-left: -12px;
  color: #62717c;
}

.record-number {
  color: #9aa3aa;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
}

.hero-accent {
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: linear-gradient(#26736a, #f1b76c);
}

.hero-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 166px;
  padding: 28px 30px 28px 35px;
}

.hero-avatar {
  color: #26736a;
  font-family: Georgia, serif;
  font-size: 22px;
  font-weight: 800;
}

.hero-copy {
  flex: 1;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  color: #8a959e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.hero-meta span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #c2c8cc;
}

.hero-copy h1 {
  margin: 0;
  color: #17293e;
  font-family: Georgia, serif;
  font-size: clamp(27px, 3vw, 38px);
  letter-spacing: -0.03em;
}

.contact-name {
  margin-top: 5px;
  color: #6e7c87;
  font-size: 14px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.details-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
}

.details-main {
  display: grid;
  gap: 20px;
}

.info-card {
  padding: 24px;
}

.card-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 25px;
}

.card-heading h2 {
  margin: 0;
  color: #263747;
  font-family: Georgia, serif;
  font-size: 20px;
}

.card-heading p {
  margin: 4px 0 0;
  color: #909aa2;
  font-size: 11px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px 30px;
}

.info-item {
  display: flex;
  gap: 12px;
}

.info-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #4a796f;
  background: #eff4f1;
}

.info-icon .v-icon {
  font-size: 18px;
}

.info-item label {
  display: block;
  margin-bottom: 4px;
  color: #9099a1;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.info-item strong,
.info-item a {
  display: block;
  color: #344552;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  text-decoration: none;
}

.info-item a {
  color: #26736a;
}

.info-item small {
  display: block;
  margin-top: 3px;
  color: #89949c;
}

.comment-box {
  margin-top: 26px;
  padding: 16px 18px;
  border-left: 3px solid #f1b76c;
  border-radius: 0 12px 12px 0;
  background: #faf7f1;
}

.comment-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9a7044;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.comment-box p {
  margin: 8px 0 0;
  color: #59666f;
  font-size: 13px;
  line-height: 1.6;
}

.activity-card {
  overflow: hidden;
}

.activity-tabs {
  padding: 0 10px;
}

.deals-panel {
  padding: 24px;
}

.deals-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.deals-toolbar h3 {
  margin: 0;
  color: #314450;
  font-family: Georgia, serif;
  font-size: 18px;
}

.deals-toolbar p {
  margin: 4px 0 0;
  color: #929ca3;
  font-size: 11px;
}

.deal-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.deal-summary-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 13px;
  border: 1px solid #e7ebe8;
  border-radius: 13px;
  background: #fbfcfb;
}

.deal-summary-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
}

.deal-summary-icon.all {
  color: #506f88;
  background: #eaf1f6;
}

.deal-summary-icon.open {
  color: #9a642f;
  background: #faf0e4;
}

.deal-summary-icon.won {
  color: #26736a;
  background: #e5f1ed;
}

.deal-summary-icon.money {
  color: #755b91;
  background: #f1ecf7;
}

.deal-summary-card small {
  display: block;
  color: #9099a0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.deal-summary-card strong {
  display: block;
  margin-top: 3px;
  color: #324550;
  font-size: 16px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.deal-summary-card.value strong {
  font-size: 12px;
}

.deal-filters {
  display: flex;
  gap: 6px;
  margin: 22px 0 14px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.deal-filters button {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  border: 0;
  border-radius: 20px;
  color: #7b878e;
  background: transparent;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.deal-filters button span {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  color: #8a949b;
  background: #eef1ef;
  font-size: 9px;
}

.deal-filters button:hover {
  background: #f3f5f3;
}

.deal-filters button.active {
  color: #26736a;
  background: #e8f2ef;
}

.deal-filters button.active span {
  color: #fff;
  background: #4d8178;
}

.deals-loading,
.deal-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.deal-card {
  min-width: 0;
  padding: 17px;
  border: 1px solid #e5eae7;
  border-radius: 15px;
  background:
    linear-gradient(135deg, rgba(238, 245, 242, 0.55), transparent 40%),
    #fff;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.deal-card:hover {
  border-color: #ccdcd6;
  box-shadow: 0 10px 25px rgba(37, 66, 59, 0.07);
  transform: translateY(-1px);
}

.deal-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
}

.deal-stage {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 9px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.deal-card-actions {
  display: flex;
  gap: 1px;
}

.deal-card h4 {
  margin: 13px 0 0;
  color: #293c48;
  font-family: Georgia, serif;
  font-size: 16px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.deal-description {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  color: #7b878e;
  font-size: 11px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.deal-amount {
  margin-top: 16px;
  color: #26736a;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.deal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #edf0ee;
}

.deal-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #8c969c;
  font-size: 9px;
}

.deals-empty {
  min-height: 260px;
  padding-bottom: 28px;
}

.activity-panel {
  padding: 24px;
}

.activity-toolbar,
.composer-heading,
.composer-footer,
.timeline-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.activity-toolbar h3 {
  margin: 0;
  color: #314450;
  font-family: Georgia, serif;
  font-size: 18px;
}

.activity-toolbar p {
  margin: 3px 0 0;
  color: #929ca3;
  font-size: 11px;
}

.activity-composer {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #dfe7e3;
  border-radius: 16px;
  background: #fbfcfb;
  box-shadow: 0 12px 28px rgba(39, 66, 60, 0.06);
}

.composer-heading {
  margin-bottom: 16px;
}

.composer-heading strong {
  display: block;
  color: #2f414c;
  font-size: 14px;
}

.composer-heading span {
  display: block;
  margin-top: 2px;
  color: #8b969d;
  font-size: 11px;
}

.activity-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.activity-type-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #e1e6e3;
  border-radius: 11px;
  color: #68757d;
  background: #fff;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.activity-type-button:hover {
  transform: translateY(-1px);
}

.activity-type-button.active {
  border-color: var(--activity-color);
  color: var(--activity-color);
  background: var(--activity-background);
}

.activity-textarea :deep(.v-field) {
  background: #fff;
}

.composer-footer {
  align-items: flex-end;
  margin-top: 14px;
}

.activity-date-field {
  max-width: 250px;
}

.composer-actions {
  display: flex;
  gap: 6px;
}

.activity-filters {
  display: flex;
  gap: 6px;
  margin: 22px 0 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.activity-filters button {
  flex: 0 0 auto;
  padding: 7px 11px;
  border: 0;
  border-radius: 20px;
  color: #7b878e;
  background: transparent;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.activity-filters button:hover {
  background: #f3f5f3;
}

.activity-filters button.active {
  color: #26736a;
  background: #e8f2ef;
}

.activity-loading {
  padding: 8px 0;
}

.activity-timeline {
  position: relative;
  padding-top: 8px;
}

.activity-timeline::before {
  position: absolute;
  top: 28px;
  bottom: 28px;
  left: 20px;
  width: 1px;
  background: #e1e7e4;
  content: '';
}

.timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  padding: 12px 0;
}

.timeline-icon {
  z-index: 1;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 4px solid #fff;
  border-radius: 50%;
}

.timeline-content {
  min-width: 0;
  padding: 13px 15px;
  border: 1px solid #e8ebe9;
  border-radius: 13px;
  background: #fff;
}

.timeline-heading {
  align-items: flex-start;
}

.timeline-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.timeline-title strong {
  color: #344650;
  font-size: 12px;
}

.timeline-title span {
  color: #9099a0;
  font-size: 10px;
}

.timeline-title span::before {
  margin-right: 7px;
  content: '·';
}

.timeline-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
}

.timeline-actions time {
  color: #9aa2a8;
  font-size: 9px;
  white-space: nowrap;
}

.timeline-content > p {
  margin: 7px 0 0;
  color: #5f6d75;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.activity-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 270px;
  padding: 46px 24px;
  text-align: center;
}

.activity-empty.timeline-empty {
  min-height: 230px;
  padding-bottom: 25px;
}

.activity-empty.compact {
  min-height: 220px;
}

.activity-empty__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 14px;
  border-radius: 18px;
  color: #26736a;
  background: #e9f2ef;
}

.activity-empty h3 {
  margin: 0;
  color: #344653;
  font-family: Georgia, serif;
  font-size: 18px;
}

.activity-empty p {
  max-width: 430px;
  margin: 8px 0 18px;
  color: #87929a;
  font-size: 12px;
  line-height: 1.55;
}

.details-aside {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.manager-card,
.record-card {
  padding: 21px;
}

.aside-label {
  margin-bottom: 16px;
  color: #8d969e;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.manager-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.manager-profile strong {
  display: block;
  color: #32434f;
  font-size: 13px;
}

.manager-profile a {
  display: block;
  margin-top: 4px;
  color: #89949d;
  font-size: 10px;
  text-decoration: none;
}

.creator-avatar {
  color: #26736a !important;
  font-size: 11px;
  font-weight: 800;
}

.creator-role {
  display: block;
  margin-top: 4px;
  color: #8f9aa1;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.unassigned-manager {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8b959c;
  font-size: 12px;
}

.record-card dl {
  margin: 0;
}

.record-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eef0ed;
}

.record-card dl div:last-child {
  border: 0;
}

.record-card dt {
  color: #929aa1;
  font-size: 11px;
}

.record-card dd {
  margin: 0;
  color: #42515c;
  font-size: 11px;
  font-weight: 600;
  text-align: right;
}

.error-card {
  padding: 70px 24px;
  text-align: center;
}

.error-card h2 {
  margin: 15px 0 5px;
  font-family: Georgia, serif;
}

.error-card p {
  margin: 0 0 20px;
  color: #7b8790;
}

.delete-activity-card {
  padding: 8px;
}

.delete-activity-card :deep(.v-card-title) {
  color: #2e404b;
  font-family: Georgia, serif;
}

.delete-activity-card :deep(.v-card-text) {
  color: #6f7c84;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

@keyframes details-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1150px) {
  .details-grid {
    grid-template-columns: 1fr;
  }

  .details-aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 800px) {
  .hero-main {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 24px;
  }

  .hero-copy {
    min-width: calc(100% - 100px);
  }

  .hero-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .activity-type-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .deal-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .hero-avatar {
    width: 52px !important;
    height: 52px !important;
  }

  .hero-copy {
    min-width: calc(100% - 75px);
  }

  .hero-meta {
    flex-wrap: wrap;
  }

  .hero-actions .v-btn {
    flex: 1;
  }

  .details-aside {
    display: flex;
  }

  .activity-tabs :deep(.v-btn) {
    min-width: 100px;
    padding: 0 10px;
    font-size: 11px;
  }

  .activity-panel {
    padding: 18px 15px;
  }

  .deals-panel {
    padding: 18px 15px;
  }

  .deals-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .deals-toolbar .v-btn {
    width: 100%;
  }

  .deals-loading,
  .deal-list {
    grid-template-columns: 1fr;
  }

  .deal-summary-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .activity-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .activity-toolbar .v-btn {
    width: 100%;
  }

  .composer-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .activity-date-field {
    max-width: none;
  }

  .composer-actions {
    justify-content: flex-end;
  }

  .timeline-heading {
    flex-direction: column;
    gap: 4px;
  }

  .timeline-actions {
    width: 100%;
  }

  .timeline-actions .v-btn {
    margin-left: auto;
  }
}
</style>
