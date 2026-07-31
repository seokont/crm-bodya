<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import { useCallRemindersStore } from '@/stores/call-reminders';
import type {
  ClientTask,
  ClientTaskPayload,
  Manager,
} from '@/types/client';

const props = defineProps<{
  clientId: number;
  clientManagerId: number | null;
  managers: Manager[];
}>();
const emit = defineEmits<{
  changed: [];
  notify: [message: string, color?: string];
}>();

const auth = useAuthStore();
const reminders = useCallRemindersStore();
const calls = ref<ClientTask[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialog = ref(false);
const editingCall = ref<ClientTask | null>(null);

const form = reactive({
  scheduledAt: '',
  remindBeforeMinutes: 30,
  assigneeId: null as number | null,
  note: '',
});

const reminderOptions = [
  { title: 'За 5 хвилин', value: 5 },
  { title: 'За 15 хвилин', value: 15 },
  { title: 'За 30 хвилин', value: 30 },
  { title: 'За 1 годину', value: 60 },
  { title: 'За 2 години', value: 120 },
  { title: 'За 1 день', value: 1440 },
];

const assigneeOptions = computed(() => {
  const options = [...props.managers];
  if (
    auth.user &&
    !options.some((manager) => manager.id === auth.user?.id)
  ) {
    options.unshift({
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
    });
  }
  return options;
});

const scheduledCalls = computed(() =>
  calls.value
    .filter(
      (task) =>
        task.kind === 'CALL' &&
        !['DONE', 'CANCELLED'].includes(task.status) &&
        task.dueAt,
    )
    .sort(
      (left, right) =>
        new Date(left.dueAt!).getTime() - new Date(right.dueAt!).getTime(),
    ),
);

function toLocalDateTime(value: Date | string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultCallTime() {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return toLocalDateTime(value);
}

function formatDateTime(value: string | null) {
  if (!value) return 'Дата не визначена';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isOverdue(call: ClientTask) {
  return Boolean(call.dueAt && new Date(call.dueAt).getTime() < Date.now());
}

function canManage(call: ClientTask) {
  return (
    auth.isAdmin ||
    call.creatorId === auth.user?.id ||
    call.assigneeId === auth.user?.id ||
    props.clientManagerId === auth.user?.id
  );
}

function resetForm() {
  editingCall.value = null;
  form.scheduledAt = defaultCallTime();
  form.remindBeforeMinutes = 30;
  form.assigneeId =
    props.clientManagerId ??
    auth.user?.id ??
    assigneeOptions.value[0]?.id ??
    null;
  form.note = '';
}

function openNewCall() {
  resetForm();
  dialog.value = true;
}

function openEditor(call: ClientTask) {
  if (!call.dueAt) return;
  editingCall.value = call;
  form.scheduledAt = toLocalDateTime(call.dueAt);
  form.remindBeforeMinutes = call.remindAt
    ? Math.max(
        0,
        Math.round(
          (new Date(call.dueAt).getTime() -
            new Date(call.remindAt).getTime()) /
            60_000,
        ),
      )
    : 30;
  form.assigneeId = call.assigneeId;
  form.note = call.description || '';
  dialog.value = true;
}

async function fetchCalls() {
  loading.value = true;
  try {
    calls.value = await clientsApi.getTasks(props.clientId);
  } catch (error) {
    emit('notify', getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

async function saveCall() {
  if (!form.scheduledAt) {
    emit('notify', 'Оберіть дату та час дзвінка', 'warning');
    return;
  }
  if (!form.assigneeId) {
    emit('notify', 'Оберіть відповідального менеджера', 'warning');
    return;
  }

  const dueAt = new Date(form.scheduledAt);
  if (dueAt.getTime() <= Date.now()) {
    emit('notify', 'Дата дзвінка має бути в майбутньому', 'warning');
    return;
  }
  const remindAt = new Date(
    dueAt.getTime() - form.remindBeforeMinutes * 60_000,
  );
  const payload: ClientTaskPayload = {
    title: 'Запланований дзвінок',
    description: form.note.trim(),
    kind: 'CALL',
    status: editingCall.value?.status || 'TODO',
    priority: 'HIGH',
    dueAt: dueAt.toISOString(),
    remindAt: remindAt.toISOString(),
    assigneeId: form.assigneeId,
  };

  saving.value = true;
  try {
    if (editingCall.value) {
      const updated = await clientsApi.updateTask(
        props.clientId,
        editingCall.value.id,
        payload,
      );
      calls.value = calls.value.map((call) =>
        call.id === updated.id ? updated : call,
      );
      emit('notify', 'Запланований дзвінок оновлено', 'success');
    } else {
      const created = await clientsApi.createTask(props.clientId, payload);
      calls.value = [...calls.value, created];
      emit('notify', 'Дзвінок заплановано', 'success');
    }
    dialog.value = false;
    editingCall.value = null;
    await reminders.refresh();
    emit('changed');
  } catch (error) {
    emit('notify', getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function updateCallStatus(call: ClientTask, status: 'DONE' | 'CANCELLED') {
  saving.value = true;
  try {
    const updated = await clientsApi.updateTask(props.clientId, call.id, {
      status,
    });
    calls.value = calls.value.map((item) =>
      item.id === updated.id ? updated : item,
    );
    await reminders.refresh();
    emit(
      'notify',
      status === 'DONE' ? 'Дзвінок позначено виконаним' : 'Дзвінок скасовано',
      'success',
    );
    emit('changed');
  } catch (error) {
    emit('notify', getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(fetchCalls);
watch(() => props.clientId, fetchCalls);
</script>

<template>
  <div class="call-scheduler">
    <div class="call-scheduler__heading">
      <div>
        <span class="call-scheduler__eyebrow">Календар дзвінків</span>
        <strong>Майбутні контакти</strong>
      </div>
      <v-btn
        icon="mdi-calendar-plus"
        color="primary"
        variant="tonal"
        size="small"
        aria-label="Запланувати дзвінок"
        @click="openNewCall"
      />
    </div>

    <div v-if="loading" class="call-scheduler__loading">
      <v-skeleton-loader type="list-item-two-line" />
    </div>

    <div v-else-if="scheduledCalls.length" class="call-scheduler__list">
      <article
        v-for="call in scheduledCalls"
        :key="call.id"
        class="scheduled-call"
        :class="{ overdue: isOverdue(call) }"
      >
        <div class="scheduled-call__icon">
          <v-icon
            :icon="isOverdue(call) ? 'mdi-phone-alert' : 'mdi-phone-clock'"
            size="19"
          />
        </div>
        <div class="scheduled-call__copy">
          <strong>
            {{
              isOverdue(call)
                ? `Прострочено: ${formatDateTime(call.dueAt)}`
                : formatDateTime(call.dueAt)
            }}
          </strong>
          <span>{{ call.assigneeName || 'Без відповідального' }}</span>
          <p v-if="call.description">{{ call.description }}</p>
        </div>
        <v-menu v-if="canManage(call)" location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              icon="mdi-dots-vertical"
              variant="text"
              size="x-small"
              aria-label="Дії із дзвінком"
            />
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-pencil-outline"
              title="Перенести або змінити"
              @click="openEditor(call)"
            />
            <v-list-item
              prepend-icon="mdi-check-circle-outline"
              title="Позначити виконаним"
              @click="updateCallStatus(call, 'DONE')"
            />
            <v-list-item
              prepend-icon="mdi-calendar-remove-outline"
              title="Скасувати"
              base-color="error"
              @click="updateCallStatus(call, 'CANCELLED')"
            />
          </v-list>
        </v-menu>
      </article>
    </div>

    <div v-else class="call-scheduler__empty">
      <v-icon icon="mdi-calendar-clock-outline" size="28" />
      <span>Дзвінків ще не заплановано</span>
    </div>

    <v-btn
      block
      color="primary"
      variant="tonal"
      prepend-icon="mdi-phone-plus-outline"
      class="mt-3"
      @click="openNewCall"
    >
      Запланувати дзвінок
    </v-btn>
  </div>

  <v-dialog v-model="dialog" max-width="620">
    <v-card class="call-dialog">
      <v-card-title>
        <span>
          {{
            editingCall
              ? 'Змінити запланований дзвінок'
              : 'Запланувати дзвінок'
          }}
        </span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Закрити"
          @click="dialog = false"
        />
      </v-card-title>
      <v-card-text>
        <div class="call-form-grid">
          <v-text-field
            v-model="form.scheduledAt"
            type="datetime-local"
            label="Дата та час дзвінка"
            prepend-inner-icon="mdi-calendar-clock-outline"
            variant="outlined"
            :min="toLocalDateTime(new Date())"
            hide-details="auto"
          />
          <v-select
            v-model="form.remindBeforeMinutes"
            :items="reminderOptions"
            label="Нагадати заздалегідь"
            prepend-inner-icon="mdi-bell-ring-outline"
            variant="outlined"
            hide-details="auto"
          />
        </div>
        <v-select
          v-model="form.assigneeId"
          :items="assigneeOptions"
          item-title="name"
          item-value="id"
          label="Відповідальний за дзвінок"
          prepend-inner-icon="mdi-account-headset-outline"
          variant="outlined"
          hide-details="auto"
          class="mt-4"
        />
        <v-textarea
          v-model="form.note"
          label="Нотатка до дзвінка"
          placeholder="Що потрібно обговорити або уточнити"
          prepend-inner-icon="mdi-note-text-outline"
          variant="outlined"
          rows="3"
          maxlength="3000"
          counter
          hide-details="auto"
          class="mt-4"
        />
        <div class="call-dialog__hint">
          <v-icon icon="mdi-information-outline" size="17" />
          Нагадування періодично з’являтиметься окремою спливною плашкою.
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">Скасувати</v-btn>
        <v-btn color="primary" :loading="saving" @click="saveCall">
          {{ editingCall ? 'Зберегти' : 'Запланувати' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.call-scheduler {
  padding: 18px;
}

.call-scheduler__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.call-scheduler__heading > div {
  display: grid;
  gap: 3px;
}

.call-scheduler__eyebrow {
  color: #87939a;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.call-scheduler__heading strong {
  color: #17293e;
  font-size: 15px;
}

.call-scheduler__loading {
  margin-top: 10px;
}

.call-scheduler__list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.scheduled-call {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: start;
  gap: 9px;
  padding: 11px;
  border: 1px solid #dce9e5;
  border-radius: 12px;
  background: #f4faf8;
}

.scheduled-call.overdue {
  border-color: #f0ced0;
  background: #fff7f7;
}

.scheduled-call__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: #dcefe9;
  color: #26736a;
}

.scheduled-call.overdue .scheduled-call__icon {
  background: #f6dddd;
  color: #a14f55;
}

.scheduled-call__copy {
  min-width: 0;
}

.scheduled-call__copy strong,
.scheduled-call__copy span {
  display: block;
}

.scheduled-call__copy strong {
  color: #253947;
  font-size: 12px;
}

.scheduled-call__copy span,
.scheduled-call__copy p {
  color: #74818a;
  font-size: 11px;
}

.scheduled-call__copy p {
  display: -webkit-box;
  margin: 4px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.call-scheduler__empty {
  display: grid;
  justify-items: center;
  gap: 7px;
  margin-top: 14px;
  padding: 20px 12px;
  border: 1px dashed #d9e1e4;
  border-radius: 12px;
  color: #89959c;
  font-size: 12px;
}

.call-dialog {
  border-radius: 18px !important;
}

.call-dialog :deep(.v-card-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 10px;
}

.call-form-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 14px;
}

.call-dialog__hint {
  display: flex;
  gap: 7px;
  margin-top: 14px;
  color: #74818a;
  font-size: 12px;
}

@media (max-width: 600px) {
  .call-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
