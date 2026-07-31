<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import {
  CLIENT_TASK_PRIORITIES,
  CLIENT_TASK_STATUSES,
  type ClientTask,
  type ClientTaskPayload,
  type ClientTaskPriority,
  type ClientTaskStatus,
  type Manager,
} from '@/types/client';

const props = defineProps<{
  clientId: number;
  clientManagerId: number | null;
  managers: Manager[];
}>();

const emit = defineEmits<{
  changed: [];
}>();

const auth = useAuthStore();
const tasks = ref<ClientTask[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialog = ref(false);
const deleteDialog = ref(false);
const editingTask = ref<ClientTask | null>(null);
const taskToDelete = ref<ClientTask | null>(null);
const filter = ref<'OPEN' | 'ALL' | ClientTaskStatus>('OPEN');
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('primary');

const form = reactive<{
  title: string;
  description: string;
  status: ClientTaskStatus;
  priority: ClientTaskPriority;
  dueAt: string;
  assigneeId: number | null;
}>({
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  dueAt: '',
  assigneeId: null,
});

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

const openTasks = computed(() =>
  tasks.value.filter((task) => !['DONE', 'CANCELLED'].includes(task.status)),
);

const completedTasks = computed(() =>
  tasks.value.filter((task) => task.status === 'DONE'),
);

const overdueTasks = computed(() =>
  openTasks.value.filter((task) => isOverdue(task)),
);

const dueTodayTasks = computed(() =>
  openTasks.value.filter((task) => isDueToday(task)),
);

const filteredTasks = computed(() => {
  if (filter.value === 'ALL') return tasks.value;
  if (filter.value === 'OPEN') return openTasks.value;
  return tasks.value.filter((task) => task.status === filter.value);
});

const filterOptions: {
  title: string;
  value: 'OPEN' | 'ALL' | ClientTaskStatus;
}[] = [
  { title: 'Активні', value: 'OPEN' },
  { title: 'Усі', value: 'ALL' },
  ...CLIENT_TASK_STATUSES,
];

function notify(message: string, color = 'primary') {
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

function isOverdue(task: ClientTask) {
  return Boolean(
    task.dueAt &&
      !['DONE', 'CANCELLED'].includes(task.status) &&
      new Date(task.dueAt).getTime() < Date.now(),
  );
}

function isDueToday(task: ClientTask) {
  if (!task.dueAt || isOverdue(task)) return false;
  const due = new Date(task.dueAt);
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function canManage(task: ClientTask) {
  return (
    auth.isAdmin ||
    task.creatorId === auth.user?.id ||
    task.assigneeId === auth.user?.id ||
    props.clientManagerId === auth.user?.id
  );
}

function resetForm() {
  form.title = '';
  form.description = '';
  form.status = 'TODO';
  form.priority = 'MEDIUM';
  form.dueAt = '';
  form.assigneeId =
    props.clientManagerId ??
    (auth.user?.role === 'MANAGER' ? auth.user.id : null);
}

function openNewTask() {
  editingTask.value = null;
  resetForm();
  dialog.value = true;
}

function openEditor(task: ClientTask) {
  editingTask.value = task;
  form.title = task.title;
  form.description = task.description || '';
  form.status = task.status;
  form.priority = task.priority;
  form.dueAt = toLocalDateTime(task.dueAt);
  form.assigneeId = task.assigneeId;
  dialog.value = true;
}

async function fetchTasks() {
  loading.value = true;
  try {
    tasks.value = await clientsApi.getTasks(props.clientId);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

async function saveTask() {
  if (form.title.trim().length < 2) {
    notify('Вкажіть назву завдання', 'warning');
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
      const updated = await clientsApi.updateTask(
        props.clientId,
        editingTask.value.id,
        payload,
      );
      tasks.value = tasks.value.map((task) =>
        task.id === updated.id ? updated : task,
      );
      notify('Завдання оновлено');
    } else {
      const created = await clientsApi.createTask(props.clientId, payload);
      tasks.value = [created, ...tasks.value];
      filter.value = 'OPEN';
      notify('Завдання створено');
    }
    dialog.value = false;
    editingTask.value = null;
    emit('changed');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleDone(task: ClientTask) {
  if (!canManage(task)) return;
  saving.value = true;
  try {
    const updated = await clientsApi.updateTask(props.clientId, task.id, {
      status: task.status === 'DONE' ? 'TODO' : 'DONE',
    });
    tasks.value = tasks.value.map((item) =>
      item.id === updated.id ? updated : item,
    );
    emit('changed');
    notify(updated.status === 'DONE' ? 'Завдання виконано' : 'Завдання відновлено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function requestDelete(task: ClientTask) {
  taskToDelete.value = task;
  deleteDialog.value = true;
}

async function deleteTask() {
  if (!taskToDelete.value) return;
  saving.value = true;
  try {
    await clientsApi.removeTask(props.clientId, taskToDelete.value.id);
    tasks.value = tasks.value.filter(
      (task) => task.id !== taskToDelete.value?.id,
    );
    deleteDialog.value = false;
    taskToDelete.value = null;
    emit('changed');
    notify('Завдання видалено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(fetchTasks);
</script>

<template>
  <div class="tasks-panel">
    <div class="tasks-toolbar">
      <div>
        <h3>Завдання клієнта</h3>
        <p>{{ openTasks.length }} активних із {{ tasks.length }}</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNewTask">
        Нове завдання
      </v-btn>
    </div>

    <div class="task-summary-grid">
      <div class="task-summary">
        <v-icon icon="mdi-format-list-checks" />
        <div><small>Активні</small><strong>{{ openTasks.length }}</strong></div>
      </div>
      <div class="task-summary due">
        <v-icon icon="mdi-calendar-today-outline" />
        <div><small>На сьогодні</small><strong>{{ dueTodayTasks.length }}</strong></div>
      </div>
      <div class="task-summary overdue">
        <v-icon icon="mdi-alert-circle-outline" />
        <div><small>Прострочені</small><strong>{{ overdueTasks.length }}</strong></div>
      </div>
      <div class="task-summary done">
        <v-icon icon="mdi-check-all" />
        <div><small>Виконані</small><strong>{{ completedTasks.length }}</strong></div>
      </div>
    </div>

    <div class="task-filters">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        type="button"
        :class="{ active: filter === option.value }"
        @click="filter = option.value"
      >
        {{ option.title }}
      </button>
    </div>

    <div v-if="loading" class="tasks-loading">
      <v-skeleton-loader
        v-for="index in 3"
        :key="index"
        type="list-item-avatar-three-line"
      />
    </div>

    <div v-else-if="filteredTasks.length" class="task-list">
      <article
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
        :class="{
          completed: task.status === 'DONE',
          overdue: isOverdue(task),
        }"
      >
        <button
          type="button"
          class="task-check"
          :class="{ checked: task.status === 'DONE' }"
          :disabled="!canManage(task) || saving"
          :aria-label="task.status === 'DONE' ? 'Відновити завдання' : 'Виконати завдання'"
          @click="toggleDone(task)"
        >
          <v-icon
            :icon="task.status === 'DONE' ? 'mdi-check' : 'mdi-circle-outline'"
            size="19"
          />
        </button>

        <div class="task-copy">
          <div class="task-heading">
            <div class="task-badges">
              <span
                class="task-status"
                :style="{
                  color: statusMeta[task.status].color,
                  background: statusMeta[task.status].background,
                }"
              >
                <v-icon :icon="statusMeta[task.status].icon" size="13" />
                {{ statusMeta[task.status].title }}
              </span>
              <span
                class="task-priority"
                :style="{
                  color: priorityMeta[task.priority].color,
                  background: priorityMeta[task.priority].background,
                }"
              >
                {{ priorityMeta[task.priority].title }}
              </span>
            </div>
            <div v-if="canManage(task)" class="task-actions">
              <v-btn
                icon="mdi-pencil-outline"
                variant="text"
                size="x-small"
                aria-label="Редагувати завдання"
                @click="openEditor(task)"
              />
              <v-btn
                icon="mdi-delete-outline"
                variant="text"
                size="x-small"
                color="error"
                aria-label="Видалити завдання"
                @click="requestDelete(task)"
              />
            </div>
          </div>

          <h4>{{ task.title }}</h4>
          <p v-if="task.description">{{ task.description }}</p>

          <div class="task-meta">
            <span :class="{ danger: isOverdue(task) }">
              <v-icon
                :icon="isOverdue(task) ? 'mdi-calendar-alert' : 'mdi-calendar-clock-outline'"
                size="15"
              />
              {{ isOverdue(task) ? `Прострочено: ${formatDate(task.dueAt)}` : formatDate(task.dueAt) }}
            </span>
            <span>
              <v-icon icon="mdi-account-outline" size="15" />
              {{ task.assigneeName || 'Виконавця не призначено' }}
            </span>
            <span>
              <v-icon icon="mdi-account-plus-outline" size="15" />
              Створив: {{ task.creatorName }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="tasks-empty">
      <div class="empty-icon">
        <v-icon icon="mdi-clipboard-check-outline" size="30" />
      </div>
      <h3>{{ tasks.length ? 'У цьому фільтрі завдань немає' : 'Завдань ще немає' }}</h3>
      <p v-if="!tasks.length">
        Створіть завдання, призначте виконавця та встановіть дедлайн.
      </p>
      <v-btn
        v-if="!tasks.length"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-plus"
        @click="openNewTask"
      >
        Створити перше завдання
      </v-btn>
      <v-btn v-else variant="text" color="primary" @click="filter = 'ALL'">
        Показати всі
      </v-btn>
    </div>

    <v-dialog v-model="dialog" max-width="650" persistent>
      <v-card class="task-dialog">
        <v-card-title>
          <div>
            <strong>{{ editingTask ? 'Редагувати завдання' : 'Нове завдання' }}</strong>
            <span>Планування роботи з клієнтом</span>
          </div>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :disabled="saving"
            @click="dialog = false"
          />
        </v-card-title>
        <v-card-text class="modal-input-stack">
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
          <div class="task-form-grid">
            <v-select
              v-model="form.status"
              :items="CLIENT_TASK_STATUSES"
              label="Статус"
              variant="outlined"
            />
            <v-select
              v-model="form.priority"
              :items="CLIENT_TASK_PRIORITIES"
              label="Пріоритет"
              variant="outlined"
            />
            <v-text-field
              v-model="form.dueAt"
              type="datetime-local"
              label="Дедлайн"
              variant="outlined"
            />
            <v-select
              v-model="form.assigneeId"
              :items="managers"
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
          <v-btn variant="text" :disabled="saving" @click="dialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-save-outline"
            :loading="saving"
            :disabled="form.title.trim().length < 2"
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
        <v-card-text>
          Завдання «{{ taskToDelete?.title }}» буде видалено без можливості
          відновлення.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="deleteDialog = false">
            Скасувати
          </v-btn>
          <v-btn color="error" :loading="saving" @click="deleteTask">
            Видалити
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
.tasks-panel {
  padding: 24px;
}

.tasks-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.tasks-toolbar h3 {
  margin: 0;
  color: #314450;
  font-family: Georgia, serif;
  font-size: 18px;
}

.tasks-toolbar p {
  margin: 4px 0 0;
  color: #929ca3;
  font-size: 11px;
}

.task-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  margin-top: 20px;
}

.task-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e6ebe8;
  border-radius: 12px;
  color: #506f88;
  background: #fbfcfb;
}

.task-summary.due { color: #8a6b2f; }
.task-summary.overdue { color: #a14f55; }
.task-summary.done { color: #26736a; }

.task-summary small,
.task-summary strong {
  display: block;
}

.task-summary small {
  color: #929ba1;
  font-size: 9px;
}

.task-summary strong {
  margin-top: 2px;
  color: #344650;
  font-size: 16px;
}

.task-filters {
  display: flex;
  gap: 5px;
  margin: 20px 0 12px;
  overflow-x: auto;
}

.task-filters button {
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

.task-filters button.active {
  color: #26736a;
  background: #e8f2ef;
}

.task-list {
  display: grid;
  gap: 10px;
}

.task-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 11px;
  padding: 16px;
  border: 1px solid #e5eae7;
  border-radius: 14px;
  background: #fff;
}

.task-card.overdue {
  border-color: #eccdce;
  background: linear-gradient(90deg, #fff8f8, #fff 42%);
}

.task-card.completed {
  opacity: 0.72;
}

.task-check {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid #dbe3df;
  border-radius: 11px;
  color: #80908a;
  background: #fff;
  cursor: pointer;
}

.task-check.checked {
  border-color: #a9cec1;
  color: #26736a;
  background: #e8f2ee;
}

.task-copy {
  min-width: 0;
}

.task-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.task-badges,
.task-actions {
  display: flex;
  gap: 5px;
}

.task-status,
.task-priority {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 9px;
  font-size: 9px;
  font-weight: 800;
}

.task-copy h4 {
  margin: 10px 0 0;
  color: #2f424e;
  font-size: 14px;
}

.task-card.completed h4 {
  text-decoration: line-through;
}

.task-copy > p {
  margin: 6px 0 0;
  color: #6f7b83;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 15px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #edf0ee;
}

.task-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #8d979e;
  font-size: 9px;
}

.task-meta span.danger {
  color: #a14f55;
  font-weight: 700;
}

.tasks-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 260px;
  padding: 45px 24px 25px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 14px;
  border-radius: 18px;
  color: #26736a;
  background: #e9f2ef;
}

.tasks-empty h3 {
  margin: 0;
  color: #344653;
  font-family: Georgia, serif;
  font-size: 18px;
}

.tasks-empty p {
  margin: 8px 0 18px;
  color: #87929a;
  font-size: 12px;
}

.task-dialog {
  padding: 8px;
}

.task-dialog :deep(.v-card-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #2e404b;
  font-family: Georgia, serif;
}

.task-dialog :deep(.v-card-title span) {
  display: block;
  margin-top: 3px;
  color: #8d979e;
  font-family: sans-serif;
  font-size: 10px;
}

.task-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 700px) {
  .tasks-panel {
    padding: 18px 15px;
  }

  .tasks-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .tasks-toolbar .v-btn {
    width: 100%;
  }

  .task-summary-grid,
  .task-form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 480px) {
  .task-summary-grid {
    grid-template-columns: 1fr;
  }

  .task-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
