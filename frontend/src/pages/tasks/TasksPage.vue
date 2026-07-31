<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import { tasksApi, type TaskDueFilter } from '@/services/tasks.api';
import { useAuthStore } from '@/stores/auth';
import { useClientsStore } from '@/stores/clients';
import {
  CLIENT_TASK_PRIORITIES,
  CLIENT_TASK_STATUSES,
  clientDisplayName,
  type ClientTaskPayload,
  type ClientTaskPriority,
  type ClientTaskStatus,
  type GlobalClientTask,
  type TaskClientOption,
  type TasksResponse,
} from '@/types/client';

const router = useRouter();
const auth = useAuthStore();
const clientsStore = useClientsStore();
const loading = ref(true);
const saving = ref(false);
const response = ref<TasksResponse | null>(null);
const clientOptions = ref<TaskClientOption[]>([]);
const page = ref(1);
const limit = ref(25);
const search = ref('');
const statuses = ref<ClientTaskStatus[]>([]);
const priorities = ref<ClientTaskPriority[]>([]);
const assigneeId = ref<number | null>(null);
const clientId = ref<number | null>(null);
const due = ref<TaskDueFilter>('ALL');
const taskDialog = ref(false);
const deleteDialog = ref(false);
const editingTask = ref<GlobalClientTask | null>(null);
const taskToDelete = ref<GlobalClientTask | null>(null);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const form = reactive<{
  clientId: number | null;
  title: string;
  description: string;
  status: ClientTaskStatus;
  priority: ClientTaskPriority;
  dueAt: string;
  assigneeId: number | null;
}>({
  clientId: null,
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  dueAt: '',
  assigneeId: null,
});

const dueOptions: { title: string; value: TaskDueFilter }[] = [
  { title: 'Усі дедлайни', value: 'ALL' },
  { title: 'Прострочені', value: 'OVERDUE' },
  { title: 'На сьогодні', value: 'TODAY' },
  { title: 'Майбутні', value: 'UPCOMING' },
  { title: 'Без дедлайну', value: 'NO_DUE_DATE' },
];

const statusMeta: Record<
  ClientTaskStatus,
  { title: string; color: string; background: string; icon: string }
> = {
  TODO: {
    title: 'Заплановано',
    color: '#506f88',
    background: '#eaf1f6',
    icon: 'mdi-circle-outline',
  },
  IN_PROGRESS: {
    title: 'У роботі',
    color: '#9a642f',
    background: '#faf0e4',
    icon: 'mdi-progress-clock',
  },
  DONE: {
    title: 'Виконано',
    color: '#26736a',
    background: '#e5f1ed',
    icon: 'mdi-check-circle-outline',
  },
  CANCELLED: {
    title: 'Скасовано',
    color: '#7f898f',
    background: '#edf0f2',
    icon: 'mdi-cancel',
  },
};

const priorityMeta: Record<
  ClientTaskPriority,
  { title: string; color: string; background: string }
> = {
  LOW: { title: 'Низький', color: '#617887', background: '#edf2f5' },
  MEDIUM: { title: 'Середній', color: '#79652d', background: '#f6f1df' },
  HIGH: { title: 'Високий', color: '#a26332', background: '#faeee3' },
  URGENT: { title: 'Терміновий', color: '#a14f55', background: '#f9e9ea' },
};

const clientSelectItems = computed(() =>
  clientOptions.value.map((client) => ({
    value: client.id,
    title: clientDisplayName(client),
    subtitle: client.manager?.name || 'Без відповідального',
  })),
);

const hasFilters = computed(
  () =>
    Boolean(search.value.trim()) ||
    statuses.value.length > 0 ||
    priorities.value.length > 0 ||
    Boolean(assigneeId.value) ||
    Boolean(clientId.value) ||
    due.value !== 'ALL',
);

function notify(message: string, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return 'Без дедлайну';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isOverdue(task: GlobalClientTask) {
  return Boolean(
    task.dueAt &&
      ['TODO', 'IN_PROGRESS'].includes(task.status) &&
      new Date(task.dueAt).getTime() < Date.now(),
  );
}

function canManage(task: GlobalClientTask) {
  return (
    auth.isAdmin ||
    task.creatorId === auth.user?.id ||
    task.assigneeId === auth.user?.id ||
    task.client.managerId === auth.user?.id
  );
}

async function fetchTasks() {
  loading.value = true;
  try {
    response.value = await tasksApi.getAll({
      page: page.value,
      limit: limit.value,
      search: search.value,
      status: statuses.value,
      priority: priorities.value,
      assigneeId: assigneeId.value,
      clientId: clientId.value,
      due: due.value,
    });
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  try {
    const [clients] = await Promise.all([
      tasksApi.getClientOptions(),
      clientsStore.fetchManagers(),
    ]);
    clientOptions.value = clients;
  } catch (error) {
    notify(getApiError(error), 'error');
  }
}

async function applyFilters() {
  page.value = 1;
  await fetchTasks();
}

async function resetFilters() {
  search.value = '';
  statuses.value = [];
  priorities.value = [];
  assigneeId.value = null;
  clientId.value = null;
  due.value = 'ALL';
  page.value = 1;
  await fetchTasks();
}

function resetForm() {
  form.clientId = null;
  form.title = '';
  form.description = '';
  form.status = 'TODO';
  form.priority = 'MEDIUM';
  form.dueAt = '';
  form.assigneeId =
    auth.user?.role === 'MANAGER' ? auth.user.id : null;
}

async function openNewTask() {
  editingTask.value = null;
  resetForm();
  if (!clientOptions.value.length) await loadOptions();
  if (!clientOptions.value.length) {
    notify('Немає доступних клієнтів для створення завдання', 'warning');
    return;
  }
  taskDialog.value = true;
}

function selectClient(value: number | null) {
  if (editingTask.value || !value) return;
  const selected = clientOptions.value.find((client) => client.id === value);
  form.assigneeId =
    selected?.managerId ??
    (auth.user?.role === 'MANAGER' ? auth.user.id : null);
}

function openEditor(task: GlobalClientTask) {
  editingTask.value = task;
  form.clientId = task.clientId;
  form.title = task.title;
  form.description = task.description || '';
  form.status = task.status;
  form.priority = task.priority;
  form.dueAt = toLocalDateTime(task.dueAt);
  form.assigneeId = task.assigneeId;
  taskDialog.value = true;
}

async function saveTask() {
  if (!form.clientId || form.title.trim().length < 2) {
    notify('Оберіть клієнта та вкажіть назву завдання', 'warning');
    return;
  }
  const payload: ClientTaskPayload = {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    assigneeId: form.assigneeId,
  };

  saving.value = true;
  try {
    if (editingTask.value) {
      await clientsApi.updateTask(
        editingTask.value.clientId,
        editingTask.value.id,
        payload,
      );
      notify('Завдання оновлено');
    } else {
      await clientsApi.createTask(form.clientId, payload);
      notify('Завдання створено');
    }
    taskDialog.value = false;
    editingTask.value = null;
    await fetchTasks();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleDone(task: GlobalClientTask) {
  if (!canManage(task)) return;
  saving.value = true;
  try {
    await clientsApi.updateTask(task.clientId, task.id, {
      status: task.status === 'DONE' ? 'TODO' : 'DONE',
    });
    notify(task.status === 'DONE' ? 'Завдання відновлено' : 'Завдання виконано');
    await fetchTasks();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function requestDelete(task: GlobalClientTask) {
  taskToDelete.value = task;
  deleteDialog.value = true;
}

async function deleteTask() {
  if (!taskToDelete.value) return;
  saving.value = true;
  try {
    await clientsApi.removeTask(
      taskToDelete.value.clientId,
      taskToDelete.value.id,
    );
    deleteDialog.value = false;
    taskToDelete.value = null;
    notify('Завдання видалено');
    await fetchTasks();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function changePage(value: number) {
  page.value = value;
  await fetchTasks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
  await Promise.all([fetchTasks(), loadOptions()]);
});
</script>

<template>
  <div class="page-shell global-tasks-page">
    <header class="tasks-header">
      <div>
        <div class="eyebrow"><span /> Робочий план</div>
        <h1 class="page-title">Завдання</h1>
        <p class="page-subtitle">
          Контролюйте дедлайни, пріоритети та навантаження команди.
        </p>
      </div>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-plus"
        @click="openNewTask"
      >
        Нове завдання
      </v-btn>
    </header>

    <div class="tasks-metrics">
      <v-card class="section-card task-metric primary">
        <v-icon icon="mdi-format-list-checks" />
        <div><small>Усього</small><strong>{{ response?.summary.total ?? '—' }}</strong></div>
      </v-card>
      <v-card class="section-card task-metric">
        <v-icon icon="mdi-progress-clock" />
        <div><small>Активні</small><strong>{{ response?.summary.open ?? '—' }}</strong></div>
      </v-card>
      <v-card class="section-card task-metric today">
        <v-icon icon="mdi-calendar-today-outline" />
        <div><small>На сьогодні</small><strong>{{ response?.summary.today ?? '—' }}</strong></div>
      </v-card>
      <v-card class="section-card task-metric overdue">
        <v-icon icon="mdi-alert-circle-outline" />
        <div><small>Прострочені</small><strong>{{ response?.summary.overdue ?? '—' }}</strong></div>
      </v-card>
      <v-card class="section-card task-metric done">
        <v-icon icon="mdi-check-all" />
        <div><small>Виконані</small><strong>{{ response?.summary.done ?? '—' }}</strong></div>
      </v-card>
    </div>

    <v-card class="section-card task-filters-card">
      <div class="filter-grid">
        <v-text-field
          v-model="search"
          label="Пошук"
          placeholder="Завдання або клієнт"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          @keydown.enter="applyFilters"
        />
        <v-select
          v-model="statuses"
          :items="CLIENT_TASK_STATUSES"
          label="Статус"
          variant="outlined"
          density="compact"
          multiple
          chips
          closable-chips
          hide-details
        />
        <v-select
          v-model="priorities"
          :items="CLIENT_TASK_PRIORITIES"
          label="Пріоритет"
          variant="outlined"
          density="compact"
          multiple
          chips
          closable-chips
          hide-details
        />
        <v-select
          v-model="due"
          :items="dueOptions"
          label="Дедлайн"
          variant="outlined"
          density="compact"
          hide-details
        />
        <v-select
          v-model="clientId"
          :items="clientSelectItems"
          label="Клієнт"
          variant="outlined"
          density="compact"
          clearable
          hide-details
        />
        <v-select
          v-model="assigneeId"
          :items="clientsStore.managers"
          item-title="name"
          item-value="id"
          label="Виконавець"
          variant="outlined"
          density="compact"
          clearable
          hide-details
        />
      </div>
      <div class="filter-actions">
        <v-btn v-if="hasFilters" variant="text" @click="resetFilters">
          Очистити
        </v-btn>
        <v-btn color="primary" variant="tonal" @click="applyFilters">
          Застосувати
        </v-btn>
      </div>
    </v-card>

    <v-card class="section-card tasks-list-card">
      <div class="list-heading">
        <div>
          <h2>Список завдань</h2>
          <p>{{ response?.meta.total ?? 0 }} записів за вибраними умовами</p>
        </div>
      </div>

      <div v-if="loading" class="list-loading">
        <v-skeleton-loader
          v-for="index in 5"
          :key="index"
          type="list-item-avatar-three-line"
        />
      </div>

      <div v-else-if="response?.items.length" class="global-task-list">
        <article
          v-for="task in response.items"
          :key="task.id"
          class="global-task-row"
          :class="{ overdue: isOverdue(task), completed: task.status === 'DONE' }"
        >
          <button
            type="button"
            class="task-check"
            :class="{ checked: task.status === 'DONE' }"
            :disabled="!canManage(task) || saving"
            @click="toggleDone(task)"
          >
            <v-icon :icon="task.status === 'DONE' ? 'mdi-check' : 'mdi-circle-outline'" />
          </button>

          <div class="task-main">
            <button type="button" @click="router.push(`/clients/${task.clientId}`)">
              {{ clientDisplayName(task.client) }}
            </button>
            <strong>{{ task.title }}</strong>
            <span v-if="task.description">{{ task.description }}</span>
          </div>

          <div class="task-labels">
            <span
              :style="{
                color: statusMeta[task.status].color,
                background: statusMeta[task.status].background,
              }"
            >
              {{ statusMeta[task.status].title }}
            </span>
            <span
              :style="{
                color: priorityMeta[task.priority].color,
                background: priorityMeta[task.priority].background,
              }"
            >
              {{ priorityMeta[task.priority].title }}
            </span>
          </div>

          <div class="task-date" :class="{ danger: isOverdue(task) }">
            <small>{{ isOverdue(task) ? 'Прострочено' : 'Дедлайн' }}</small>
            <strong>{{ formatDate(task.dueAt) }}</strong>
          </div>

          <div class="task-owner">
            <small>Виконавець</small>
            <strong>{{ task.assigneeName || 'Не призначено' }}</strong>
          </div>

          <div v-if="canManage(task)" class="row-actions">
            <v-btn
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              @click="openEditor(task)"
            />
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="small"
              color="error"
              @click="requestDelete(task)"
            />
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <span><v-icon icon="mdi-clipboard-check-outline" size="31" /></span>
        <h2>{{ hasFilters ? 'Нічого не знайдено' : 'Завдань ще немає' }}</h2>
        <p>
          {{
            hasFilters
              ? 'Змініть параметри пошуку або очистьте фільтри.'
              : 'Створіть перше завдання для клієнта.'
          }}
        </p>
        <v-btn
          v-if="!hasFilters"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          @click="openNewTask"
        >
          Створити завдання
        </v-btn>
        <v-btn v-else color="primary" variant="text" @click="resetFilters">
          Очистити фільтри
        </v-btn>
      </div>

      <div v-if="response && response.meta.totalPages > 1" class="pagination">
        <v-pagination
          :model-value="page"
          :length="response.meta.totalPages"
          :total-visible="6"
          @update:model-value="changePage"
        />
      </div>
    </v-card>

    <v-dialog v-model="taskDialog" max-width="660" persistent>
      <v-card class="task-dialog">
        <v-card-title>
          <div>
            <strong>{{ editingTask ? 'Редагувати завдання' : 'Нове завдання' }}</strong>
            <span>Загальний робочий план</span>
          </div>
          <v-btn icon="mdi-close" variant="text" :disabled="saving" @click="taskDialog = false" />
        </v-card-title>
        <v-card-text class="modal-input-stack">
          <v-select
            v-model="form.clientId"
            :items="clientSelectItems"
            label="Клієнт"
            variant="outlined"
            :disabled="Boolean(editingTask)"
            @update:model-value="selectClient"
          />
          <v-text-field
            v-model="form.title"
            label="Назва завдання"
            variant="outlined"
            maxlength="191"
            counter
          />
          <v-textarea
            v-model="form.description"
            label="Опис"
            variant="outlined"
            rows="3"
            maxlength="3000"
            counter
          />
          <div class="form-grid">
            <v-select v-model="form.status" :items="CLIENT_TASK_STATUSES" label="Статус" variant="outlined" />
            <v-select v-model="form.priority" :items="CLIENT_TASK_PRIORITIES" label="Пріоритет" variant="outlined" />
            <v-text-field v-model="form.dueAt" type="datetime-local" label="Дедлайн" variant="outlined" />
            <v-select
              v-model="form.assigneeId"
              :items="clientsStore.managers"
              item-title="name"
              item-value="id"
              label="Виконавець"
              variant="outlined"
              clearable
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="taskDialog = false">Скасувати</v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!form.clientId || form.title.trim().length < 2"
            @click="saveTask"
          >
            {{ editingTask ? 'Зберегти' : 'Створити' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card class="task-dialog">
        <v-card-title><strong>Видалити завдання?</strong></v-card-title>
        <v-card-text>«{{ taskToDelete?.title }}» буде видалено без можливості відновлення.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="deleteDialog = false">Скасувати</v-btn>
          <v-btn color="error" :loading="saving" @click="deleteTask">Видалити</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" location="bottom right">
      {{ snackbarMessage }}
      <template #actions><v-btn icon="mdi-close" variant="text" @click="snackbar = false" /></template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.global-tasks-page { animation: page-in 0.35s ease-out; }
.tasks-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 25px; }
.eyebrow { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; color: #d87942; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.eyebrow span { width: 23px; height: 1px; background: #d87942; }
.tasks-metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 18px; }
.task-metric { display: flex; align-items: center; gap: 12px; padding: 17px; color: #506f88; }
.task-metric.today { color: #8a6b2f; }
.task-metric.overdue { color: #a14f55; }
.task-metric.done { color: #26736a; }
.task-metric small, .task-metric strong { display: block; }
.task-metric small { color: #8d979e; font-size: 9px; text-transform: uppercase; }
.task-metric strong { margin-top: 3px; color: #263947; font-size: 21px; }
.task-filters-card { margin-bottom: 18px; padding: 18px; }
.filter-grid { display: grid; grid-template-columns: 1.4fr repeat(5, 1fr); gap: 10px; }
.filter-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 13px; }
.tasks-list-card { overflow: hidden; }
.list-heading { padding: 20px 22px; border-bottom: 1px solid #e9ece7; }
.list-heading h2 { margin: 0; color: #263747; font-family: Georgia, serif; font-size: 20px; }
.list-heading p { margin: 4px 0 0; color: #929ba2; font-size: 11px; }
.list-loading { padding: 10px 18px; }
.global-task-row { display: grid; grid-template-columns: 38px minmax(220px, 1.5fr) 170px 155px 145px 75px; gap: 13px; align-items: center; min-height: 86px; padding: 13px 20px; border-bottom: 1px solid #edf0ed; }
.global-task-row.overdue { background: linear-gradient(90deg, #fff8f8, #fff 32%); }
.global-task-row.completed { opacity: .7; }
.task-check { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #dbe3df; border-radius: 11px; color: #80908a; background: #fff; cursor: pointer; }
.task-check.checked { border-color: #a9cec1; color: #26736a; background: #e8f2ee; }
.task-main { min-width: 0; }
.task-main button { padding: 0; border: 0; color: #26736a; background: transparent; font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; }
.task-main strong, .task-main span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-main strong { margin-top: 4px; color: #31434f; font-size: 13px; }
.task-main span { margin-top: 3px; color: #9099a0; font-size: 10px; }
.task-labels { display: flex; flex-wrap: wrap; gap: 5px; }
.task-labels span { padding: 5px 8px; border-radius: 9px; font-size: 9px; font-weight: 800; }
.task-date small, .task-date strong, .task-owner small, .task-owner strong { display: block; }
.task-date small, .task-owner small { color: #9aa2a8; font-size: 9px; }
.task-date strong, .task-owner strong { margin-top: 4px; color: #53616a; font-size: 10px; }
.task-date.danger strong { color: #a14f55; }
.row-actions { display: flex; justify-content: flex-end; }
.empty-state { display: flex; align-items: center; flex-direction: column; padding: 65px 24px; text-align: center; }
.empty-state > span { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 18px; color: #26736a; background: #e9f2ef; }
.empty-state h2 { margin: 14px 0 0; color: #344653; font-family: Georgia, serif; font-size: 20px; }
.empty-state p { margin: 8px 0 18px; color: #87929a; font-size: 12px; }
.pagination { display: flex; justify-content: center; padding: 18px; border-top: 1px solid #edf0ed; }
.task-dialog { padding: 8px; }
.task-dialog :deep(.v-card-title) { display: flex; align-items: center; justify-content: space-between; color: #2e404b; font-family: Georgia, serif; }
.task-dialog :deep(.v-card-title span) { display: block; margin-top: 3px; color: #8d979e; font-family: sans-serif; font-size: 10px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@keyframes page-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 1250px) {
  .tasks-metrics { grid-template-columns: repeat(3, 1fr); }
  .filter-grid { grid-template-columns: repeat(3, 1fr); }
  .global-task-row { grid-template-columns: 38px minmax(200px, 1fr) 160px 140px 70px; }
  .task-owner { display: none; }
}
@media (max-width: 800px) {
  .tasks-header { align-items: flex-start; flex-direction: column; }
  .tasks-header .v-btn { width: 100%; }
  .tasks-metrics, .filter-grid { grid-template-columns: 1fr 1fr; }
  .global-task-row { grid-template-columns: 38px minmax(0, 1fr) auto; }
  .task-labels, .task-date { grid-column: 2; }
  .row-actions { grid-column: 3; grid-row: 1; }
}
@media (max-width: 520px) {
  .tasks-metrics, .filter-grid, .form-grid { grid-template-columns: 1fr; }
}
</style>
