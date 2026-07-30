<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { analyticsApi } from '@/services/analytics.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import {
  CLIENT_DEAL_STAGES,
  CLIENT_STATUSES,
  type ClientActivityType,
  type ClientDealStage,
  type ClientStatus,
} from '@/types/client';
import type {
  AnalyticsPeriod,
  AnalyticsResponse,
  CurrencyAmount,
} from '@/types/analytics';

const auth = useAuthStore();
const analytics = ref<AnalyticsResponse | null>(null);
const period = ref<AnalyticsPeriod>(90);
const loading = ref(true);
const error = ref('');

const periods: { title: string; value: AnalyticsPeriod }[] = [
  { title: '30 днів', value: 30 },
  { title: '90 днів', value: 90 },
  { title: '6 місяців', value: 180 },
  { title: '1 рік', value: 365 },
];

const statusLabels = Object.fromEntries(
  CLIENT_STATUSES.map((item) => [item.value, item.title]),
) as Record<ClientStatus, string>;

const stageLabels = Object.fromEntries(
  CLIENT_DEAL_STAGES.map((item) => [item.value, item.title]),
) as Record<ClientDealStage, string>;

const stageColors: Record<ClientDealStage, string> = {
  NEW: '#5a7fa8',
  QUALIFICATION: '#7568a6',
  PROPOSAL: '#d8954c',
  NEGOTIATION: '#c76e45',
  WON: '#26736a',
  LOST: '#a6adb1',
};

const activityLabels: Record<ClientActivityType, string> = {
  NOTE: 'Нотатки',
  CALL: 'Дзвінки',
  EMAIL: 'Листи',
  MEETING: 'Зустрічі',
  STATUS_CHANGE: 'Зміни статусу',
  SYSTEM: 'Системні події',
};

const activityIcons: Record<ClientActivityType, string> = {
  NOTE: 'mdi-note-text-outline',
  CALL: 'mdi-phone-outline',
  EMAIL: 'mdi-email-outline',
  MEETING: 'mdi-calendar-account-outline',
  STATUS_CHANGE: 'mdi-swap-horizontal',
  SYSTEM: 'mdi-cog-outline',
};

const periodLabel = computed(
  () => periods.find((item) => item.value === period.value)?.title || '',
);

const trendMax = computed(() =>
  Math.max(
    1,
    ...(analytics.value?.trend.flatMap((item) => [
      item.clients,
      item.deals,
      item.activities,
    ]) || [1]),
  ),
);

const pipelineMax = computed(() =>
  Math.max(1, ...(analytics.value?.pipeline.map((item) => item.count) || [1])),
);

const sourceMax = computed(() =>
  Math.max(1, ...(analytics.value?.sources.map((item) => item.count) || [1])),
);

const activityMax = computed(() =>
  Math.max(
    1,
    ...(analytics.value?.activityTypes.map((item) => item.count) || [1]),
  ),
);

const taskDonePercent = computed(() => {
  const tasks = analytics.value?.tasks;
  return tasks?.total ? Math.round((tasks.done / tasks.total) * 100) : 0;
});

const taskChartStyle = computed(() => {
  const tasks = analytics.value?.tasks;
  if (!tasks?.total) return { background: '#edf0eb' };

  const done = (tasks.done / tasks.total) * 100;
  const open = (tasks.open / tasks.total) * 100;
  const cancelled = (tasks.cancelled / tasks.total) * 100;
  return {
    background: `conic-gradient(
      #26736a 0 ${done}%,
      #d87942 ${done}% ${done + open}%,
      #a7afb4 ${done + open}% ${done + open + cancelled}%,
      #e3e7e3 ${done + open + cancelled}% 100%
    )`,
  };
});

function formatMoney(item: CurrencyAmount) {
  const amount = Number(item.amount);
  try {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: item.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('uk-UA').format(amount)} ${item.currency}`;
  }
}

function formatValues(values: CurrencyAmount[]) {
  return values.length ? values.map(formatMoney).join(' · ') : 'Без суми';
}

function barHeight(value: number) {
  if (!value) return '3px';
  return `${Math.max(12, (value / trendMax.value) * 100)}%`;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

async function fetchAnalytics() {
  loading.value = true;
  error.value = '';
  try {
    analytics.value = await analyticsApi.get(period.value);
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

watch(period, fetchAnalytics);
onMounted(fetchAnalytics);
</script>

<template>
  <div class="page-shell analytics-page">
    <header class="analytics-header">
      <div>
        <div class="page-kicker">
          {{ auth.isAdmin ? 'Уся команда' : 'Особисті показники' }}
        </div>
        <h1 class="page-title">Аналітика</h1>
        <p class="page-subtitle">
          Ключові результати за {{ periodLabel }} та точки, які потребують уваги.
        </p>
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
    </header>

    <v-alert
      v-if="error && analytics"
      class="mb-4"
      type="error"
      variant="tonal"
      closable
    >
      {{ error }}
    </v-alert>

    <v-card v-if="error && !analytics" class="section-card error-state">
      <div class="error-state__icon">
        <v-icon icon="mdi-chart-box-outline" size="30" />
      </div>
      <h2>Не вдалося завантажити аналітику</h2>
      <p>{{ error }}</p>
      <v-btn color="primary" variant="tonal" @click="fetchAnalytics">
        Спробувати ще раз
      </v-btn>
    </v-card>

    <div v-else-if="loading && !analytics" class="loading-state">
      <v-progress-circular indeterminate color="primary" size="34" />
      <span>Формуємо показники…</span>
    </div>

    <template v-else-if="analytics">
      <div class="metric-grid">
        <v-card class="section-card metric-card metric-card--primary">
          <div class="metric-card__icon">
            <v-icon icon="mdi-account-group-outline" />
          </div>
          <span>Активні клієнти</span>
          <strong>{{ analytics.metrics.activeClients }}</strong>
          <small>Нових за період: {{ analytics.metrics.newClients }}</small>
        </v-card>

        <v-card class="section-card metric-card">
          <div class="metric-card__icon metric-card__icon--orange">
            <v-icon icon="mdi-target-account" />
          </div>
          <span>Конверсія у клієнта</span>
          <strong>{{ analytics.metrics.conversionRate }}%</strong>
          <small>Частка клієнтів зі статусом «Клієнт»</small>
        </v-card>

        <v-card class="section-card metric-card">
          <div class="metric-card__icon metric-card__icon--violet">
            <v-icon icon="mdi-handshake-outline" />
          </div>
          <span>Угоди за період</span>
          <strong>{{ analytics.metrics.totalDeals }}</strong>
          <small>
            Виграно {{ analytics.metrics.wonDeals }} ·
            {{ analytics.metrics.dealWinRate }}%
          </small>
        </v-card>

        <v-card
          class="section-card metric-card"
          :class="{ 'metric-card--warning': analytics.metrics.overdueTasks }"
        >
          <div class="metric-card__icon metric-card__icon--red">
            <v-icon icon="mdi-clipboard-clock-outline" />
          </div>
          <span>Відкриті завдання</span>
          <strong>{{ analytics.metrics.openTasks }}</strong>
          <small>
            Прострочено: {{ analytics.metrics.overdueTasks }}
          </small>
        </v-card>
      </div>

      <div class="main-grid">
        <v-card class="section-card trend-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Динаміка</span>
              <h2>Робоча активність</h2>
            </div>
            <div class="chart-legend">
              <span><i class="legend-client" /> Клієнти</span>
              <span><i class="legend-deal" /> Угоди</span>
              <span><i class="legend-activity" /> Активності</span>
            </div>
          </div>

          <div class="trend-chart">
            <div
              v-for="(item, index) in analytics.trend"
              :key="`${item.label}-${index}`"
              class="trend-column"
            >
              <div class="trend-bars">
                <v-tooltip :text="`Нові клієнти: ${item.clients}`">
                  <template #activator="{ props }">
                    <div
                      v-bind="props"
                      class="trend-bar trend-bar--client"
                      :style="{ height: barHeight(item.clients) }"
                    />
                  </template>
                </v-tooltip>
                <v-tooltip :text="`Нові угоди: ${item.deals}`">
                  <template #activator="{ props }">
                    <div
                      v-bind="props"
                      class="trend-bar trend-bar--deal"
                      :style="{ height: barHeight(item.deals) }"
                    />
                  </template>
                </v-tooltip>
                <v-tooltip :text="`Активності: ${item.activities}`">
                  <template #activator="{ props }">
                    <div
                      v-bind="props"
                      class="trend-bar trend-bar--activity"
                      :style="{ height: barHeight(item.activities) }"
                    />
                  </template>
                </v-tooltip>
              </div>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </v-card>

        <v-card class="section-card task-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Виконання</span>
              <h2>Завдання</h2>
            </div>
            <v-btn
              to="/tasks"
              variant="text"
              size="small"
              append-icon="mdi-arrow-right"
            >
              Відкрити
            </v-btn>
          </div>

          <div class="task-overview">
            <div class="task-donut" :style="taskChartStyle">
              <div class="task-donut__center">
                <strong>{{ taskDonePercent }}%</strong>
                <span>виконано</span>
              </div>
            </div>
            <div class="task-stats">
              <div>
                <i class="task-dot task-dot--open" />
                <span>Відкриті</span>
                <strong>{{ analytics.tasks.open }}</strong>
              </div>
              <div>
                <i class="task-dot task-dot--done" />
                <span>Виконані</span>
                <strong>{{ analytics.tasks.done }}</strong>
              </div>
              <div>
                <i class="task-dot task-dot--cancelled" />
                <span>Скасовані</span>
                <strong>{{ analytics.tasks.cancelled }}</strong>
              </div>
              <div class="task-stat--danger">
                <i class="task-dot task-dot--danger" />
                <span>Прострочені</span>
                <strong>{{ analytics.tasks.overdue }}</strong>
              </div>
            </div>
          </div>
          <div class="completion-note">
            <v-icon icon="mdi-check-decagram-outline" size="18" />
            <span>
              Якість виконання:
              <strong>{{ analytics.metrics.taskCompletionRate }}%</strong>
              завершених без скасування
            </span>
          </div>
        </v-card>
      </div>

      <div class="business-grid">
        <v-card class="section-card pipeline-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Продажі</span>
              <h2>Воронка угод</h2>
            </div>
            <v-btn
              to="/deals"
              variant="text"
              size="small"
              append-icon="mdi-arrow-right"
            >
              Усі угоди
            </v-btn>
          </div>

          <div class="pipeline-list">
            <div
              v-for="item in analytics.pipeline"
              :key="item.stage"
              class="pipeline-row"
            >
              <div class="pipeline-row__copy">
                <div>
                  <i :style="{ backgroundColor: stageColors[item.stage] }" />
                  <span>{{ stageLabels[item.stage] }}</span>
                </div>
                <strong>{{ item.count }}</strong>
              </div>
              <div class="pipeline-track">
                <div
                  class="pipeline-bar"
                  :style="{
                    width: `${(item.count / pipelineMax) * 100}%`,
                    backgroundColor: stageColors[item.stage],
                  }"
                />
              </div>
              <small>{{ formatValues(item.values) }}</small>
            </div>
          </div>
        </v-card>

        <v-card class="section-card revenue-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Результат</span>
              <h2>Дохід із виграних угод</h2>
            </div>
          </div>

          <div v-if="analytics.revenue.length" class="revenue-list">
            <div
              v-for="item in analytics.revenue"
              :key="item.currency"
              class="revenue-item"
            >
              <div class="revenue-item__icon">
                {{ item.currency === 'UAH' ? '₴' : item.currency === 'USD' ? '$' : '€' }}
              </div>
              <div>
                <span>{{ item.currency }}</span>
                <strong>{{ formatMoney(item) }}</strong>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <v-icon icon="mdi-cash-check" size="28" />
            <span>За цей період ще немає виграних угод</span>
          </div>

          <div class="revenue-foot">
            <span>Виграні угоди</span>
            <strong>{{ analytics.metrics.wonDeals }}</strong>
          </div>
        </v-card>

        <v-card class="section-card sources-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Залучення</span>
              <h2>Джерела клієнтів</h2>
            </div>
          </div>

          <div v-if="analytics.sources.length" class="bar-list">
            <div
              v-for="source in analytics.sources"
              :key="source.source"
              class="bar-row"
            >
              <div>
                <span>{{ source.source }}</span>
                <strong>{{ source.count }}</strong>
              </div>
              <div class="horizontal-track">
                <div
                  class="horizontal-bar"
                  :style="{ width: `${(source.count / sourceMax) * 100}%` }"
                />
              </div>
            </div>
          </div>
          <div v-else class="empty-state">Джерела ще не вказані</div>
        </v-card>
      </div>

      <div class="secondary-grid">
        <v-card class="section-card statuses-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Клієнтська база</span>
              <h2>Розподіл за статусами</h2>
            </div>
          </div>
          <div class="status-chips">
            <router-link
              v-for="item in analytics.statuses"
              :key="item.status"
              :to="{ path: '/clients', query: { status: item.status } }"
              class="status-chip"
            >
              <span>{{ statusLabels[item.status] }}</span>
              <strong>{{ item.count }}</strong>
            </router-link>
            <div v-if="!analytics.statuses.length" class="empty-state">
              Клієнтів ще немає
            </div>
          </div>
        </v-card>

        <v-card class="section-card activity-card">
          <div class="card-heading">
            <div>
              <span class="card-kicker">Комунікації</span>
              <h2>Типи активностей</h2>
            </div>
            <strong class="activity-total">
              {{ analytics.metrics.activities }}
            </strong>
          </div>
          <div v-if="analytics.activityTypes.length" class="activity-list">
            <div
              v-for="item in analytics.activityTypes"
              :key="item.type"
              class="activity-row"
            >
              <div class="activity-icon">
                <v-icon :icon="activityIcons[item.type]" size="18" />
              </div>
              <div class="activity-row__body">
                <div>
                  <span>{{ activityLabels[item.type] }}</span>
                  <strong>{{ item.count }}</strong>
                </div>
                <div class="horizontal-track">
                  <div
                    class="horizontal-bar horizontal-bar--activity"
                    :style="{ width: `${(item.count / activityMax) * 100}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            Активностей за цей період ще немає
          </div>
        </v-card>
      </div>

      <v-card v-if="auth.isAdmin" class="section-card team-card">
        <div class="card-heading">
          <div>
            <span class="card-kicker">Команда</span>
            <h2>Показники менеджерів</h2>
          </div>
          <v-btn
            to="/team"
            variant="text"
            size="small"
            append-icon="mdi-arrow-right"
          >
            Менеджери
          </v-btn>
        </div>

        <div v-if="analytics.team.length" class="team-table">
          <div class="team-row team-row--head">
            <span>Менеджер</span>
            <span>Клієнти</span>
            <span>Виграні угоди</span>
            <span>Відкриті</span>
            <span>Виконані</span>
            <span>Прострочені</span>
          </div>
          <div
            v-for="manager in analytics.team"
            :key="manager.id"
            class="team-row"
          >
            <div class="manager-cell">
              <div class="manager-avatar">{{ initials(manager.name) }}</div>
              <strong>{{ manager.name }}</strong>
            </div>
            <span data-label="Клієнти">{{ manager.clients }}</span>
            <span data-label="Виграні угоди">{{ manager.wonDeals }}</span>
            <span data-label="Відкриті">{{ manager.openTasks }}</span>
            <span data-label="Виконані">{{ manager.completedTasks }}</span>
            <span
              data-label="Прострочені"
              :class="{ 'danger-value': manager.overdueTasks }"
            >
              {{ manager.overdueTasks }}
            </span>
          </div>
        </div>
        <div v-else class="empty-state">Активних менеджерів ще немає</div>
      </v-card>
    </template>
  </div>
</template>

<style scoped>
.analytics-page {
  animation: page-in 0.35s ease-out;
}

.analytics-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.page-kicker,
.card-kicker {
  display: block;
  margin-bottom: 6px;
  color: #b07047;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
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
  min-height: 164px;
  padding: 18px 20px;
  border-top: 3px solid transparent;
}

.metric-card--primary {
  color: #fff;
  border-top-color: #1e5f59;
  background:
    radial-gradient(circle at 100% 0%, rgba(241, 183, 108, 0.26), transparent 55%),
    #26736a;
}

.metric-card--warning {
  border-top-color: #bc5b4d;
}

.metric-card__icon {
  display: grid;
  width: 38px;
  height: 38px;
  margin-bottom: 15px;
  border-radius: 12px;
  color: #26736a;
  background: #e6f1ed;
  place-items: center;
}

.metric-card--primary .metric-card__icon {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

.metric-card__icon--orange {
  color: #c36c39;
  background: #fbece2;
}

.metric-card__icon--violet {
  color: #785c98;
  background: #f0eaf5;
}

.metric-card__icon--red {
  color: #ad5049;
  background: #f8e7e5;
}

.metric-card > span {
  color: #75828b;
  font-size: 10px;
}

.metric-card--primary > span,
.metric-card--primary > small {
  color: rgba(255, 255, 255, 0.7);
}

.metric-card > strong {
  display: block;
  margin: 5px 0 7px;
  color: #17293e;
  font-family: Georgia, serif;
  font-size: 31px;
  line-height: 1;
}

.metric-card--primary > strong {
  color: #fff;
}

.metric-card > small {
  color: #929ba2;
  font-size: 9px;
}

.main-grid,
.business-grid,
.secondary-grid {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}

.main-grid {
  grid-template-columns: minmax(0, 1.55fr) minmax(330px, 0.75fr);
}

.business-grid {
  grid-template-columns: minmax(360px, 1.25fr) minmax(250px, 0.7fr) minmax(250px, 0.8fr);
}

.secondary-grid {
  grid-template-columns: minmax(300px, 0.9fr) minmax(360px, 1.1fr);
}

.trend-card,
.task-card,
.pipeline-card,
.revenue-card,
.sources-card,
.statuses-card,
.activity-card,
.team-card {
  padding: 20px;
}

.trend-card,
.task-card {
  min-height: 365px;
}

.card-heading {
  display: flex;
  min-height: 48px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.card-heading h2 {
  margin: 0;
  color: #263746;
  font-family: Georgia, serif;
  font-size: 19px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  color: #7d8991;
  font-size: 9px;
}

.chart-legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.chart-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.legend-client {
  background: #26736a;
}

.legend-deal {
  background: #d87942;
}

.legend-activity {
  background: #8870a5;
}

.trend-chart {
  display: flex;
  height: 265px;
  align-items: flex-end;
  gap: clamp(5px, 1vw, 13px);
  padding: 22px 6px 0;
  border-bottom: 1px solid #e5e9e5;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent,
      transparent 54px,
      rgba(226, 230, 225, 0.72) 55px
    );
}

.trend-column {
  display: flex;
  height: 100%;
  min-width: 0;
  flex: 1;
  align-items: center;
  flex-direction: column;
  justify-content: flex-end;
}

.trend-bars {
  display: flex;
  width: min(48px, 88%);
  height: 215px;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
}

.trend-bar {
  width: 30%;
  min-height: 3px;
  border-radius: 5px 5px 1px 1px;
  transition: height 0.3s ease;
}

.trend-bar--client {
  background: #26736a;
}

.trend-bar--deal {
  background: #d87942;
}

.trend-bar--activity {
  background: #8870a5;
}

.trend-column > span {
  min-height: 27px;
  padding-top: 8px;
  color: #8c969d;
  font-size: 8px;
  white-space: nowrap;
}

.task-overview {
  display: grid;
  min-height: 205px;
  align-items: center;
  grid-template-columns: 142px 1fr;
  gap: 24px;
}

.task-donut {
  display: grid;
  width: 142px;
  height: 142px;
  padding: 20px;
  border-radius: 50%;
  place-items: center;
}

.task-donut__center {
  display: grid;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff;
  place-content: center;
  text-align: center;
}

.task-donut__center strong,
.task-donut__center span {
  display: block;
}

.task-donut__center strong {
  color: #203444;
  font-family: Georgia, serif;
  font-size: 24px;
}

.task-donut__center span {
  color: #929ba2;
  font-size: 9px;
}

.task-stats > div {
  display: grid;
  align-items: center;
  padding: 7px 0;
  color: #68757e;
  grid-template-columns: 8px 1fr auto;
  gap: 8px;
  font-size: 10px;
}

.task-stats strong {
  color: #354753;
}

.task-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.task-dot--open {
  background: #d87942;
}

.task-dot--done {
  background: #26736a;
}

.task-dot--cancelled {
  background: #a7afb4;
}

.task-dot--danger {
  background: #ba514a;
}

.task-stat--danger strong {
  color: #af4d47;
}

.completion-note {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  border-radius: 11px;
  color: #477068;
  background: #edf5f2;
  font-size: 9px;
}

.pipeline-card,
.revenue-card,
.sources-card,
.statuses-card,
.activity-card {
  min-height: 330px;
}

.pipeline-list,
.bar-list,
.activity-list {
  margin-top: 14px;
}

.pipeline-row {
  display: grid;
  margin-bottom: 13px;
  grid-template-columns: minmax(160px, 0.7fr) minmax(80px, 1fr) minmax(120px, auto);
  align-items: center;
  gap: 12px;
}

.pipeline-row__copy,
.pipeline-row__copy > div {
  display: flex;
  align-items: center;
}

.pipeline-row__copy {
  justify-content: space-between;
  gap: 8px;
  color: #596770;
  font-size: 10px;
}

.pipeline-row__copy > div {
  min-width: 0;
  gap: 7px;
}

.pipeline-row__copy i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.pipeline-row__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pipeline-row__copy strong {
  color: #344651;
}

.pipeline-track,
.horizontal-track {
  height: 6px;
  overflow: hidden;
  border-radius: 6px;
  background: #edf0ec;
}

.pipeline-bar,
.horizontal-bar {
  height: 100%;
  min-width: 3px;
  border-radius: inherit;
}

.pipeline-row small {
  color: #8e989f;
  font-size: 8px;
  text-align: right;
}

.revenue-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.revenue-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px;
  border: 1px solid #e5e9e4;
  border-radius: 12px;
  background: #fbfcfa;
}

.revenue-item__icon {
  display: grid;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  color: #26736a;
  background: #e6f1ed;
  font-family: Georgia, serif;
  font-size: 18px;
  place-items: center;
}

.revenue-item span,
.revenue-item strong {
  display: block;
}

.revenue-item span {
  color: #8a949a;
  font-size: 8px;
}

.revenue-item strong {
  margin-top: 2px;
  color: #263a47;
  font-size: 12px;
}

.revenue-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 13px;
  border-top: 1px solid #e7eae6;
  color: #7b878e;
  font-size: 10px;
}

.revenue-foot strong {
  color: #26736a;
}

.bar-row {
  margin-bottom: 15px;
}

.bar-row > div:first-child,
.activity-row__body > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  color: #5c6972;
  font-size: 10px;
}

.bar-row strong,
.activity-row strong {
  color: #354753;
}

.horizontal-bar {
  background: #d87942;
}

.horizontal-bar--activity {
  background: #8870a5;
}

.status-chips {
  display: grid;
  margin-top: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.status-chip {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e5e9e4;
  border-radius: 12px;
  color: #68757e;
  background: #fbfcfa;
  font-size: 9px;
  text-decoration: none;
}

.status-chip:hover {
  color: #26736a;
  border-color: #bcd5cc;
  background: #f3f8f6;
}

.status-chip strong {
  color: #263a47;
  font-family: Georgia, serif;
  font-size: 17px;
}

.activity-total {
  color: #26736a;
  font-family: Georgia, serif;
  font-size: 24px;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 12px;
}

.activity-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 10px;
  color: #776192;
  background: #f0ebf4;
  place-items: center;
}

.activity-row__body {
  min-width: 0;
  flex: 1;
}

.team-card {
  min-height: 220px;
  margin-top: 14px;
}

.team-table {
  margin-top: 12px;
}

.team-row {
  display: grid;
  min-height: 54px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #e8ebe7;
  color: #56646e;
  grid-template-columns: minmax(180px, 1.5fr) repeat(5, minmax(80px, 0.65fr));
  gap: 10px;
  font-size: 10px;
  text-align: center;
}

.team-row--head {
  min-height: 36px;
  color: #929ca2;
  background: #f7f8f5;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.team-row > :first-child {
  text-align: left;
}

.manager-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.manager-cell strong {
  overflow: hidden;
  color: #344651;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manager-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 11px;
  color: #26736a;
  background: #e6f1ed;
  font-size: 9px;
  font-weight: 800;
  place-items: center;
}

.danger-value {
  color: #b14e48;
  font-weight: 800;
}

.empty-state,
.loading-state {
  display: grid;
  min-height: 140px;
  color: #929ca2;
  font-size: 10px;
  place-content: center;
  justify-items: center;
  gap: 9px;
  text-align: center;
}

.loading-state {
  min-height: 420px;
}

.error-state {
  display: grid;
  min-height: 360px;
  align-content: center;
  justify-items: center;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .business-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sources-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 960px) {
  .main-grid,
  .secondary-grid {
    grid-template-columns: 1fr;
  }

  .team-row {
    grid-template-columns: minmax(150px, 1.4fr) repeat(5, minmax(70px, 0.6fr));
    overflow-x: auto;
  }
}

@media (max-width: 700px) {
  .analytics-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .period-toggle {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, 1fr);
  }

  .metric-card {
    min-height: 150px;
    padding: 15px;
  }

  .business-grid {
    grid-template-columns: 1fr;
  }

  .sources-card {
    grid-column: auto;
  }

  .pipeline-row {
    grid-template-columns: minmax(130px, 1fr) minmax(70px, 1fr);
  }

  .pipeline-row small {
    grid-column: 1 / -1;
    text-align: left;
  }

  .status-chips {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .team-row--head {
    display: none;
  }

  .team-row {
    display: grid;
    margin-bottom: 10px;
    padding: 13px;
    border: 1px solid #e5e9e4;
    border-radius: 12px;
    grid-template-columns: repeat(2, 1fr);
    gap: 11px;
    text-align: right;
  }

  .team-row > span::before {
    display: block;
    color: #98a1a7;
    content: attr(data-label);
    font-size: 8px;
  }

  .manager-cell {
    grid-column: 1 / -1;
  }
}

@media (max-width: 480px) {
  .metric-grid {
    gap: 9px;
  }

  .metric-card > strong {
    font-size: 27px;
  }

  .chart-legend {
    display: none;
  }

  .trend-card,
  .task-card,
  .pipeline-card,
  .revenue-card,
  .sources-card,
  .statuses-card,
  .activity-card,
  .team-card {
    padding: 16px;
  }

  .trend-column > span {
    font-size: 7px;
    transform: rotate(-25deg);
    transform-origin: center top;
  }

  .task-overview {
    grid-template-columns: 116px 1fr;
    gap: 14px;
  }

  .task-donut {
    width: 116px;
    height: 116px;
    padding: 16px;
  }
}
</style>
