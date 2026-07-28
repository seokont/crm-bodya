<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { overviewApi } from '@/services/overview.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import {
  CLIENT_STATUSES,
  clientDisplayName,
  type ClientStatus,
} from '@/types/client';
import type {
  OverviewPeriod,
  OverviewResponse,
} from '@/types/overview';

const auth = useAuthStore();
const router = useRouter();
const period = ref<OverviewPeriod>(30);
const overview = ref<OverviewResponse | null>(null);
const loading = ref(true);
const error = ref('');

const periods: { title: string; value: OverviewPeriod }[] = [
  { title: '7 днів', value: 7 },
  { title: '30 днів', value: 30 },
  { title: '90 днів', value: 90 },
];

const statusColors: Record<ClientStatus, string> = {
  NEW: '#4b78a8',
  IN_PROGRESS: '#d87942',
  CONTACTED: '#8b68a8',
  WAITING: '#d2a43b',
  INTERESTED: '#3f8d75',
  NOT_INTERESTED: '#9ba3a8',
  CLIENT: '#26736a',
  REJECTED: '#b95b5b',
  ARCHIVED: '#76828a',
};

const statusLabels = Object.fromEntries(
  CLIENT_STATUSES.map((item) => [item.value, item.title]),
) as Record<ClientStatus, string>;

const firstName = computed(() => auth.user?.name.split(' ')[0] || '');
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Доброго ранку';
  if (hour < 18) return 'Добрий день';
  return 'Добрий вечір';
});
const currentDate = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

const statusTotal = computed(
  () =>
    overview.value?.statuses.reduce((sum, item) => sum + item.count, 0) || 0,
);

const statuses = computed(() =>
  (overview.value?.statuses || []).map((item) => ({
    ...item,
    label: statusLabels[item.status],
    color: statusColors[item.status],
    percent: statusTotal.value
      ? Math.round((item.count / statusTotal.value) * 100)
      : 0,
  })),
);

const donutStyle = computed(() => {
  if (!statusTotal.value) return { background: '#edf0eb' };
  let cursor = 0;
  const segments = statuses.value.map((item) => {
    const start = cursor;
    cursor += (item.count / statusTotal.value) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return { background: `conic-gradient(${segments.join(', ')})` };
});

const activityMax = computed(() =>
  Math.max(1, ...(overview.value?.activity.map((item) => item.count) || [1])),
);
const sourceMax = computed(() =>
  Math.max(1, ...(overview.value?.sources.map((item) => item.count) || [1])),
);
const teamMax = computed(() =>
  Math.max(1, ...(overview.value?.team.map((item) => item.clients) || [1])),
);

const periodLabel = computed(
  () => periods.find((item) => item.value === period.value)?.title,
);

const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(value))
    .replace('.', '');

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

async function fetchOverview() {
  loading.value = true;
  error.value = '';
  try {
    overview.value = await overviewApi.get(period.value);
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

function openStatus(status: ClientStatus) {
  void router.push({ path: '/clients', query: { status } });
}

function openClient(id: number) {
  void router.push(`/clients/${id}`);
}

watch(period, fetchOverview);
onMounted(fetchOverview);
</script>

<template>
  <div class="page-shell overview-page">
    <header class="overview-header">
      <div>
        <div class="overview-date">{{ currentDate }}</div>
        <h1 class="page-title">{{ greeting }}, {{ firstName }}</h1>
        <p class="page-subtitle">
          {{
            auth.isAdmin
              ? 'Ось актуальний стан клієнтської бази та команди.'
              : 'Ось актуальний стан ваших клієнтів і робочого процесу.'
          }}
        </p>
      </div>

      <div class="header-actions">
        <v-btn
          v-if="auth.isAdmin"
          variant="outlined"
          prepend-icon="mdi-account-plus-outline"
          to="/team?create=1"
        >
          Менеджер
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          to="/clients?create=1"
        >
          Додати клієнта
        </v-btn>
      </div>
    </header>

    <div class="overview-toolbar">
      <div>
        <strong>Робочі показники</strong>
        <span>{{ auth.isAdmin ? 'Уся команда' : 'Мої клієнти' }}</span>
      </div>
      <v-btn-toggle
        v-model="period"
        mandatory
        density="compact"
        color="primary"
        variant="text"
        class="period-toggle"
      >
        <v-btn
          v-for="item in periods"
          :key="item.value"
          :value="item.value"
          size="small"
        >
          {{ item.title }}
        </v-btn>
      </v-btn-toggle>
    </div>

    <v-card v-if="error && !overview" class="section-card error-state">
      <div class="error-state__icon">
        <v-icon icon="mdi-cloud-alert-outline" size="28" />
      </div>
      <h2>Не вдалося завантажити огляд</h2>
      <p>{{ error }}</p>
      <v-btn color="primary" variant="tonal" @click="fetchOverview">
        Спробувати ще раз
      </v-btn>
    </v-card>

    <template v-else>
      <div class="metric-grid">
        <v-card class="section-card metric-card metric-card--primary">
          <div class="metric-card__top">
            <div class="metric-icon">
              <v-icon icon="mdi-account-group-outline" />
            </div>
            <span>У базі зараз</span>
          </div>
          <div class="metric-value">
            {{ overview?.metrics.activeClients ?? '—' }}
          </div>
          <div class="metric-label">Активні клієнти</div>
        </v-card>

        <v-card class="section-card metric-card">
          <div class="metric-card__top">
            <div class="metric-icon metric-icon--orange">
              <v-icon icon="mdi-account-plus-outline" />
            </div>
            <span>За {{ periodLabel }}</span>
          </div>
          <div class="metric-value">
            {{ overview?.metrics.newClients ?? '—' }}
          </div>
          <div class="metric-label">
            Нові клієнти
            <span
              v-if="overview"
              class="metric-change"
              :class="{ 'metric-change--down': overview.metrics.newClientsChange < 0 }"
            >
              <v-icon
                :icon="overview.metrics.newClientsChange >= 0 ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                size="13"
              />
              {{ Math.abs(overview.metrics.newClientsChange) }}%
            </span>
          </div>
        </v-card>

        <v-card class="section-card metric-card">
          <div class="metric-card__top">
            <div class="metric-icon metric-icon--violet">
              <v-icon icon="mdi-progress-clock" />
            </div>
            <span>Потребують уваги</span>
          </div>
          <div class="metric-value">
            {{ overview?.metrics.inWorkClients ?? '—' }}
          </div>
          <div class="metric-label">Клієнти в роботі</div>
        </v-card>

        <v-card class="section-card metric-card">
          <div class="metric-card__top">
            <div class="metric-icon metric-icon--slate">
              <v-icon icon="mdi-archive-outline" />
            </div>
            <span>За весь час</span>
          </div>
          <div class="metric-value">
            {{ overview?.metrics.archivedClients ?? '—' }}
          </div>
          <div class="metric-label">В архіві</div>
        </v-card>
      </div>

      <v-card
        v-if="auth.isAdmin && overview?.metrics.unassignedClients"
        class="unassigned-alert"
        to="/clients"
      >
        <div class="unassigned-alert__icon">
          <v-icon icon="mdi-account-question-outline" />
        </div>
        <div>
          <strong>
            {{ overview.metrics.unassignedClients }}
            клієнтів без менеджера
          </strong>
          <span>Призначте відповідальних, щоб жодне звернення не загубилося.</span>
        </div>
        <v-icon icon="mdi-arrow-right" class="ml-auto" />
      </v-card>

      <div class="insights-grid">
        <v-card class="section-card chart-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Динаміка</span>
              <h2>Надходження клієнтів</h2>
            </div>
            <div class="chart-total">
              <strong>{{ overview?.metrics.newClients ?? 0 }}</strong>
              <span>за {{ periodLabel }}</span>
            </div>
          </div>

          <div v-if="loading && !overview" class="chart-loading">
            <v-progress-circular indeterminate color="primary" size="28" />
          </div>
          <div v-else class="activity-chart">
            <div
              v-for="(item, index) in overview?.activity"
              :key="`${item.label}-${index}`"
              class="activity-column"
            >
              <div class="activity-value">{{ item.count }}</div>
              <div class="activity-track">
                <div
                  class="activity-bar"
                  :style="{
                    height: `${Math.max(item.count ? 12 : 3, (item.count / activityMax) * 100)}%`,
                  }"
                />
              </div>
              <div class="activity-label">{{ item.label }}</div>
            </div>
          </div>
        </v-card>

        <v-card class="section-card chart-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Структура бази</span>
              <h2>Статуси клієнтів</h2>
            </div>
          </div>

          <div class="status-content">
            <div class="donut" :style="donutStyle">
              <div class="donut__center">
                <strong>{{ statusTotal }}</strong>
                <span>клієнтів</span>
              </div>
            </div>
            <div class="status-list">
              <button
                v-for="item in statuses.slice(0, 5)"
                :key="item.status"
                type="button"
                class="status-row"
                @click="openStatus(item.status)"
              >
                <span
                  class="status-row__dot"
                  :style="{ backgroundColor: item.color }"
                />
                <span>{{ item.label }}</span>
                <strong>{{ item.count }}</strong>
                <small>{{ item.percent }}%</small>
              </button>
              <div v-if="!statuses.length" class="empty-copy">
                Даних за статусами ще немає
              </div>
            </div>
          </div>
        </v-card>
      </div>

      <div
        class="details-grid"
        :class="{ 'details-grid--personal': !auth.isAdmin }"
      >
        <v-card class="section-card detail-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Залучення</span>
              <h2>Джерела клієнтів</h2>
            </div>
          </div>
          <div class="bar-list">
            <div
              v-for="source in overview?.sources"
              :key="source.source"
              class="bar-row"
            >
              <div class="bar-row__label">
                <span>{{ source.source }}</span>
                <strong>{{ source.count }}</strong>
              </div>
              <div class="horizontal-track">
                <div
                  class="horizontal-bar horizontal-bar--source"
                  :style="{ width: `${(source.count / sourceMax) * 100}%` }"
                />
              </div>
            </div>
            <div v-if="!overview?.sources.length" class="empty-copy">
              Джерела ще не вказані
            </div>
          </div>
        </v-card>

        <v-card v-if="auth.isAdmin" class="section-card detail-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Команда</span>
              <h2>Навантаження менеджерів</h2>
            </div>
            <v-btn
              variant="text"
              size="small"
              append-icon="mdi-arrow-right"
              to="/team"
            >
              Усі
            </v-btn>
          </div>
          <div class="manager-list">
            <div
              v-for="manager in overview?.team.slice(0, 5)"
              :key="manager.id"
              class="manager-row"
            >
              <v-avatar size="34" color="#e8f2ee">
                {{ initials(manager.name) }}
              </v-avatar>
              <div class="manager-row__body">
                <div class="bar-row__label">
                  <span>{{ manager.name }}</span>
                  <strong>{{ manager.clients }}</strong>
                </div>
                <div class="horizontal-track">
                  <div
                    class="horizontal-bar"
                    :style="{ width: `${(manager.clients / teamMax) * 100}%` }"
                  />
                </div>
              </div>
            </div>
            <div v-if="!overview?.team.length" class="empty-copy">
              Активних менеджерів ще немає
            </div>
          </div>
        </v-card>

        <v-card class="section-card detail-card recent-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Останні зміни</span>
              <h2>Нові клієнти</h2>
            </div>
            <v-btn
              variant="text"
              size="small"
              append-icon="mdi-arrow-right"
              to="/clients"
            >
              Усі
            </v-btn>
          </div>
          <div class="recent-list">
            <button
              v-for="client in overview?.recentClients"
              :key="client.id"
              type="button"
              class="recent-row"
              @click="openClient(client.id)"
            >
              <div class="client-avatar">
                {{ initials(clientDisplayName(client)) }}
              </div>
              <div class="recent-row__copy">
                <strong>{{ clientDisplayName(client) }}</strong>
                <span>
                  {{ client.city || client.source || 'Дані уточнюються' }}
                  <template v-if="auth.isAdmin && client.manager">
                    · {{ client.manager.name }}
                  </template>
                </span>
              </div>
              <div class="recent-row__date">
                {{ formatShortDate(client.createdAt) }}
              </div>
              <v-icon icon="mdi-chevron-right" size="18" />
            </button>
            <div v-if="!overview?.recentClients.length" class="empty-copy">
              Клієнтів ще немає
            </div>
          </div>
        </v-card>
      </div>
    </template>
  </div>
</template>

<style scoped>
.overview-page {
  animation: page-in 0.35s ease-out;
}

.overview-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
}

.overview-date {
  margin-bottom: 8px;
  color: #d87942;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  gap: 9px;
}

.overview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
}

.overview-toolbar > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.overview-toolbar strong {
  color: #344553;
  font-size: 13px;
}

.overview-toolbar span {
  color: #8a959d;
  font-size: 11px;
}

.period-toggle {
  padding: 3px;
  border: 1px solid #e1e5df;
  border-radius: 12px;
  background: #fff;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  min-height: 156px;
  padding: 18px 20px;
  overflow: hidden;
}

.metric-card--primary {
  color: #fff;
  border-color: #1d625b;
  background:
    radial-gradient(circle at 100% 0%, rgba(241, 183, 108, 0.28), transparent 55%),
    #26736a;
}

.metric-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #8a959d;
  font-size: 10px;
}

.metric-card--primary .metric-card__top {
  color: rgba(255, 255, 255, 0.65);
}

.metric-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #26736a;
  background: #e7f1ed;
}

.metric-card--primary .metric-icon {
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
}

.metric-icon--orange {
  color: #c46d39;
  background: #fbece3;
}

.metric-icon--violet {
  color: #795b99;
  background: #f0eaf5;
}

.metric-icon--slate {
  color: #657682;
  background: #edf0f1;
}

.metric-value {
  margin-top: 15px;
  color: #17293e;
  font-family: Georgia, serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.metric-card--primary .metric-value {
  color: #fff;
}

.metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
  color: #6f7d87;
  font-size: 11px;
}

.metric-card--primary .metric-label {
  color: rgba(255, 255, 255, 0.72);
}

.metric-change {
  display: inline-flex;
  align-items: center;
  color: #27765d;
  font-weight: 700;
}

.metric-change--down {
  color: #b25252;
}

.unassigned-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 13px 17px;
  color: #795228;
  border: 1px solid #ecd7bd;
  background: #fff8ed;
}

.unassigned-alert__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #f7e7ce;
}

.unassigned-alert strong,
.unassigned-alert span {
  display: block;
}

.unassigned-alert strong {
  font-size: 12px;
}

.unassigned-alert span {
  margin-top: 2px;
  color: #9b7956;
  font-size: 10px;
}

.insights-grid {
  display: grid;
  margin-top: 14px;
  grid-template-columns: minmax(0, 1.55fr) minmax(330px, 0.85fr);
  gap: 14px;
}

.chart-card,
.detail-card {
  padding: 20px;
}

.chart-card {
  min-height: 350px;
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  min-height: 46px;
}

.card-kicker {
  display: block;
  margin-bottom: 4px;
  color: #b07047;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.card-heading h2 {
  margin: 0;
  color: #263746;
  font-family: Georgia, serif;
  font-size: 19px;
}

.chart-total {
  text-align: right;
}

.chart-total strong,
.chart-total span {
  display: block;
}

.chart-total strong {
  color: #26736a;
  font-family: Georgia, serif;
  font-size: 24px;
}

.chart-total span {
  color: #929ba2;
  font-size: 9px;
}

.chart-loading {
  display: grid;
  min-height: 230px;
  place-items: center;
}

.activity-chart {
  display: flex;
  height: 245px;
  align-items: flex-end;
  gap: clamp(8px, 2.2vw, 24px);
  padding: 24px 6px 0;
  border-bottom: 1px solid #e8ebe7;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent,
      transparent 54px,
      rgba(225, 229, 224, 0.72) 55px
    );
}

.activity-column {
  display: flex;
  height: 100%;
  min-width: 0;
  flex: 1;
  align-items: center;
  flex-direction: column;
  justify-content: flex-end;
}

.activity-value {
  min-height: 18px;
  color: #78848d;
  font-size: 10px;
  font-weight: 700;
}

.activity-track {
  display: flex;
  width: min(36px, 72%);
  height: 180px;
  align-items: flex-end;
}

.activity-bar {
  width: 100%;
  min-height: 3px;
  border-radius: 9px 9px 3px 3px;
  background: linear-gradient(180deg, #48a08f, #26736a);
  transition: height 0.3s ease;
}

.activity-label {
  min-height: 26px;
  padding-top: 8px;
  color: #8e989f;
  font-size: 9px;
  white-space: nowrap;
}

.status-content {
  display: grid;
  min-height: 270px;
  align-items: center;
  grid-template-columns: 152px 1fr;
  gap: 24px;
}

.donut {
  display: grid;
  width: 152px;
  height: 152px;
  padding: 21px;
  border-radius: 50%;
  place-items: center;
}

.donut__center {
  display: grid;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff;
  place-content: center;
  text-align: center;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.2);
}

.donut__center strong,
.donut__center span {
  display: block;
}

.donut__center strong {
  color: #203444;
  font-family: Georgia, serif;
  font-size: 27px;
}

.donut__center span {
  color: #929ba2;
  font-size: 9px;
}

.status-list {
  min-width: 0;
}

.status-row {
  display: grid;
  width: 100%;
  align-items: center;
  padding: 8px 0;
  border: 0;
  color: #53616b;
  background: transparent;
  grid-template-columns: 9px minmax(0, 1fr) auto 31px;
  gap: 8px;
  font: inherit;
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}

.status-row:hover span:nth-child(2) {
  color: #26736a;
}

.status-row__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-row strong {
  color: #354752;
  font-size: 11px;
}

.status-row small {
  color: #a0a7ac;
  text-align: right;
}

.details-grid {
  display: grid;
  margin-top: 14px;
  grid-template-columns: minmax(230px, 0.75fr) minmax(250px, 0.9fr) minmax(360px, 1.35fr);
  gap: 14px;
}

.details-grid--personal {
  grid-template-columns: minmax(280px, 0.8fr) minmax(400px, 1.4fr);
}

.detail-card {
  min-height: 330px;
}

.bar-list,
.manager-list,
.recent-list {
  margin-top: 13px;
}

.bar-row {
  margin-bottom: 15px;
}

.bar-row__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  color: #5c6972;
  font-size: 10px;
}

.bar-row__label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-row__label strong {
  color: #354753;
}

.horizontal-track {
  height: 5px;
  overflow: hidden;
  border-radius: 5px;
  background: #edf0ec;
}

.horizontal-bar {
  height: 100%;
  min-width: 3px;
  border-radius: inherit;
  background: #26736a;
}

.horizontal-bar--source {
  background: #d87942;
}

.manager-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 13px;
}

.manager-row .v-avatar {
  flex: 0 0 auto;
  color: #26736a;
  font-size: 9px;
  font-weight: 800;
}

.manager-row__body {
  min-width: 0;
  flex: 1;
}

.recent-card {
  padding-right: 12px;
}

.recent-row {
  display: grid;
  width: 100%;
  align-items: center;
  padding: 10px 7px 10px 0;
  border: 0;
  border-bottom: 1px solid #edf0ec;
  color: #43525d;
  background: transparent;
  grid-template-columns: 36px minmax(0, 1fr) auto 18px;
  gap: 10px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.recent-row:last-child {
  border-bottom: 0;
}

.recent-row:hover {
  color: #26736a;
}

.client-avatar {
  display: grid;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  color: #26736a;
  background: #e8f2ee;
  font-size: 9px;
  font-weight: 800;
  place-items: center;
}

.recent-row__copy {
  min-width: 0;
}

.recent-row__copy strong,
.recent-row__copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-row__copy strong {
  font-size: 11px;
}

.recent-row__copy span {
  margin-top: 3px;
  color: #929ba2;
  font-size: 9px;
}

.recent-row__date {
  color: #929ba2;
  font-size: 9px;
  white-space: nowrap;
}

.empty-copy {
  display: grid;
  min-height: 110px;
  color: #99a2a8;
  font-size: 11px;
  place-items: center;
  text-align: center;
}

.error-state {
  display: grid;
  min-height: 340px;
  place-items: center;
  align-content: center;
  text-align: center;
}

.error-state__icon {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 14px;
  border-radius: 18px;
  color: #b45c4e;
  background: #fae9e6;
  place-items: center;
}

.error-state h2 {
  margin: 0;
  color: #263746;
  font-family: Georgia, serif;
  font-size: 22px;
}

.error-state p {
  margin: 8px 0 18px;
  color: #818c94;
  font-size: 12px;
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

@media (max-width: 1260px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .details-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recent-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .insights-grid,
  .details-grid,
  .details-grid--personal {
    grid-template-columns: 1fr;
  }

  .recent-card {
    grid-column: auto;
  }
}

@media (max-width: 700px) {
  .overview-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .v-btn {
    flex: 1;
  }

  .overview-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .period-toggle {
    width: 100%;
  }

  .period-toggle .v-btn {
    flex: 1;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card {
    min-height: 142px;
    padding: 15px;
  }

  .metric-card__top > span {
    display: none;
  }

  .metric-value {
    margin-top: 13px;
    font-size: 28px;
  }

  .status-content {
    grid-template-columns: 120px 1fr;
    gap: 16px;
  }

  .donut {
    width: 120px;
    height: 120px;
    padding: 18px;
  }
}

@media (max-width: 430px) {
  .header-actions {
    flex-direction: column-reverse;
  }

  .metric-grid {
    gap: 9px;
  }

  .metric-label {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .status-content {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .status-list {
    width: 100%;
  }

  .activity-chart {
    gap: 5px;
  }

  .activity-label {
    font-size: 8px;
    transform: rotate(-25deg);
    transform-origin: center top;
  }
}
</style>
