<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { teamChatApi } from '@/services/team-chat.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import { useTeamChatStore } from '@/stores/team-chat';
import type {
  TeamChatMember,
  TeamChatMessage,
} from '@/types/team-chat';

const auth = useAuthStore();
const chat = useTeamChatStore();
const messages = ref<TeamChatMessage[]>([]);
const members = ref<TeamChatMember[]>([]);
const content = ref('');
const loading = ref(true);
const loadingOlder = ref(false);
const sending = ref(false);
const hasMore = ref(false);
const error = ref('');
const messageList = ref<HTMLElement | null>(null);
const editDialog = ref(false);
const deleteDialog = ref(false);
const editingMessage = ref<TeamChatMessage | null>(null);
const deletingMessage = ref<TeamChatMessage | null>(null);
const editContent = ref('');
const actionLoading = ref(false);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('primary');

const currentUserId = computed(() => auth.user?.id);
const managerCount = computed(
  () => members.value.filter((member) => member.role === 'MANAGER').length,
);

function notify(message: string, color = 'primary') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function actionError(error: unknown) {
  return error instanceof Error ? error.message : getApiError(error);
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function isMine(message: TeamChatMessage) {
  return message.authorId === currentUserId.value;
}

function canManage(message: TeamChatMessage) {
  return auth.isAdmin || isMine(message);
}

function wasEdited(message: TeamChatMessage) {
  return (
    new Date(message.updatedAt).getTime() -
      new Date(message.createdAt).getTime() >
    1000
  );
}

function dayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function showDayDivider(index: number) {
  if (!index) return true;
  const current = messages.value[index];
  const previous = messages.value[index - 1];
  if (!current || !previous) return true;
  return dayKey(current.createdAt) !== dayKey(previous.createdAt);
}

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(value) === dayKey(today.toISOString())) return 'Сьогодні';
  if (dayKey(value) === dayKey(yesterday.toISOString())) return 'Учора';
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatLastLogin(value: string | null) {
  if (!value) return 'Ще не входив';
  const date = new Date(value);
  if (dayKey(value) === dayKey(new Date().toISOString())) {
    return `Сьогодні о ${formatTime(value)}`;
  }
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}

function isNearBottom() {
  const element = messageList.value;
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

async function scrollToBottom(smooth = false) {
  await nextTick();
  const element = messageList.value;
  if (!element) return;
  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

async function fetchInitial() {
  loading.value = true;
  error.value = '';
  try {
    const [messageResponse, memberResponse] = await Promise.all([
      teamChatApi.getMessages({ limit: 80 }),
      teamChatApi.getMembers(),
    ]);
    messages.value = messageResponse.items;
    hasMore.value = messageResponse.hasMore;
    members.value = memberResponse;
    chat.markRead(messages.value[messages.value.length - 1]?.id);
    await scrollToBottom();
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

async function loadOlder() {
  const firstId = messages.value[0]?.id;
  if (!firstId || loadingOlder.value || !hasMore.value) return;

  const element = messageList.value;
  const previousHeight = element?.scrollHeight || 0;
  loadingOlder.value = true;
  try {
    const response = await teamChatApi.getMessages({
      beforeId: firstId,
      limit: 80,
    });
    messages.value = [...response.items, ...messages.value];
    hasMore.value = response.hasMore;
    await nextTick();
    if (element) element.scrollTop = element.scrollHeight - previousHeight;
  } catch (requestError) {
    notify(getApiError(requestError), 'error');
  } finally {
    loadingOlder.value = false;
  }
}

async function sendMessage() {
  const value = content.value.trim();
  if (!value || sending.value) return;

  sending.value = true;
  try {
    const message = await chat.sendMessage(value);
    if (!messages.value.some((item) => item.id === message.id)) {
      messages.value.push(message);
    }
    content.value = '';
    chat.markRead(message.id);
    await scrollToBottom(true);
  } catch (requestError) {
    notify(actionError(requestError), 'error');
  } finally {
    sending.value = false;
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  void sendMessage();
}

function openEditor(message: TeamChatMessage) {
  editingMessage.value = message;
  editContent.value = message.content;
  editDialog.value = true;
}

async function updateMessage() {
  const value = editContent.value.trim();
  if (!editingMessage.value || !value) return;

  actionLoading.value = true;
  try {
    const updated = await chat.updateMessage(editingMessage.value.id, value);
    messages.value = messages.value.map((message) =>
      message.id === updated.id ? updated : message,
    );
    editDialog.value = false;
    editingMessage.value = null;
    notify('Повідомлення оновлено');
  } catch (requestError) {
    notify(actionError(requestError), 'error');
  } finally {
    actionLoading.value = false;
  }
}

function requestDelete(message: TeamChatMessage) {
  deletingMessage.value = message;
  deleteDialog.value = true;
}

async function deleteMessage() {
  if (!deletingMessage.value) return;

  actionLoading.value = true;
  try {
    await chat.deleteMessage(deletingMessage.value.id);
    messages.value = messages.value.filter(
      (message) => message.id !== deletingMessage.value?.id,
    );
    deleteDialog.value = false;
    deletingMessage.value = null;
    notify('Повідомлення видалено');
  } catch (requestError) {
    notify(actionError(requestError), 'error');
  } finally {
    actionLoading.value = false;
  }
}

function handleVisibilityChange() {
  if (!document.hidden) {
    chat.markRead(messages.value[messages.value.length - 1]?.id);
  }
}

onMounted(async () => {
  if (auth.user) await chat.connect(auth.user.id);
  await fetchInitial();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

watch(
  () => chat.lastCreated,
  async (message) => {
    if (!message || messages.value.some((item) => item.id === message.id)) {
      return;
    }
    const stayAtBottom = isNearBottom();
    messages.value.push(message);
    chat.markRead(message.id);
    if (stayAtBottom || isMine(message)) await scrollToBottom(true);
  },
);

watch(
  () => chat.lastUpdated,
  (message) => {
    if (!message) return;
    messages.value = messages.value.map((item) =>
      item.id === message.id ? message : item,
    );
  },
);

watch(
  () => chat.lastDeletedId,
  (id) => {
    if (!id) return;
    messages.value = messages.value.filter((message) => message.id !== id);
  },
);
</script>

<template>
  <div class="page-shell chat-page">
    <header class="chat-page__header">
      <div>
        <div class="page-kicker">Внутрішній простір</div>
        <h1 class="page-title">Командний чат</h1>
        <p class="page-subtitle">
          Спільне обговорення для адміністратора та всіх менеджерів.
        </p>
      </div>
      <div
        class="sync-status"
        :class="{ 'sync-status--offline': !chat.connected }"
      >
        <span class="sync-dot" />
        {{
          chat.connected
            ? 'Онлайн · повідомлення миттєво'
            : 'Відновлюємо з’єднання…'
        }}
      </div>
    </header>

    <v-alert
      v-if="error && !loading"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" @click="fetchInitial">
          Повторити
        </v-btn>
      </template>
    </v-alert>

    <div class="chat-layout">
      <v-card class="section-card members-card">
        <div class="members-heading">
          <div>
            <span>Команда</span>
            <strong>{{ members.length }}</strong>
          </div>
          <v-icon icon="mdi-account-group-outline" size="20" />
        </div>
        <div class="member-summary">
          {{ managerCount }} менеджерів · 1 спільна кімната
        </div>

        <div v-if="loading" class="members-loading">
          <v-skeleton-loader
            v-for="index in 4"
            :key="index"
            type="list-item-avatar-two-line"
          />
        </div>
        <div v-else class="member-list">
          <div
            v-for="member in members"
            :key="member.id"
            class="member-row"
            :class="{ 'member-row--current': member.id === currentUserId }"
          >
            <div class="member-avatar">
              {{ initials(member.name) }}
              <i />
            </div>
            <div class="member-copy">
              <strong>
                {{ member.name }}
                <small v-if="member.id === currentUserId">Ви</small>
              </strong>
              <span>
                {{ member.role === 'ADMIN' ? 'Адміністратор' : 'Менеджер' }}
                · {{ formatLastLogin(member.lastLoginAt) }}
              </span>
            </div>
          </div>
        </div>
      </v-card>

      <v-card class="section-card conversation-card">
        <div class="conversation-header">
          <div class="room-mark">
            <v-icon icon="mdi-pound" size="20" />
          </div>
          <div>
            <strong>Загальний чат</strong>
            <span>Повідомлення бачить уся активна команда</span>
          </div>
          <div class="conversation-meta">
            <v-icon icon="mdi-shield-lock-outline" size="15" />
            Лише співробітники
          </div>
        </div>

        <div ref="messageList" class="message-list">
          <div v-if="loading" class="messages-loading">
            <v-progress-circular indeterminate color="primary" size="30" />
            <span>Завантажуємо розмову…</span>
          </div>

          <template v-else>
            <div v-if="hasMore" class="older-row">
              <v-btn
                variant="tonal"
                size="small"
                prepend-icon="mdi-history"
                :loading="loadingOlder"
                @click="loadOlder"
              >
                Показати старіші повідомлення
              </v-btn>
            </div>

            <div v-if="!messages.length" class="chat-empty">
              <div class="chat-empty__icon">
                <v-icon icon="mdi-forum-outline" size="30" />
              </div>
              <h2>Почніть командну розмову</h2>
              <p>
                Напишіть перше повідомлення — воно одразу стане доступним усій
                команді.
              </p>
            </div>

            <template
              v-for="(message, index) in messages"
              :key="message.id"
            >
              <div v-if="showDayDivider(index)" class="day-divider">
                <span>{{ formatDay(message.createdAt) }}</span>
              </div>

              <article
                class="message-row"
                :class="{ 'message-row--mine': isMine(message) }"
              >
                <div class="message-avatar">
                  {{ initials(message.authorName) }}
                </div>
                <div class="message-content">
                  <div class="message-heading">
                    <strong>{{ message.authorName }}</strong>
                    <span
                      v-if="message.author?.role === 'ADMIN'"
                      class="admin-badge"
                    >
                      Адміністратор
                    </span>
                    <time :datetime="message.createdAt">
                      {{ formatTime(message.createdAt) }}
                    </time>
                    <small v-if="wasEdited(message)">ред.</small>
                  </div>
                  <div class="message-bubble">
                    <p>{{ message.content }}</p>
                    <v-menu v-if="canManage(message)" location="bottom end">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon="mdi-dots-horizontal"
                          variant="text"
                          size="x-small"
                          class="message-menu"
                          aria-label="Дії з повідомленням"
                        />
                      </template>
                      <v-list density="compact">
                        <v-list-item
                          prepend-icon="mdi-pencil-outline"
                          title="Редагувати"
                          @click="openEditor(message)"
                        />
                        <v-list-item
                          prepend-icon="mdi-delete-outline"
                          title="Видалити"
                          base-color="error"
                          @click="requestDelete(message)"
                        />
                      </v-list>
                    </v-menu>
                  </div>
                </div>
              </article>
            </template>
          </template>
        </div>

        <div class="composer">
          <div class="composer-avatar">
            {{ initials(auth.user?.name || 'CRM') }}
          </div>
          <div class="composer-body">
            <v-textarea
              v-model="content"
              placeholder="Напишіть повідомлення команді…"
              variant="outlined"
              rows="2"
              auto-grow
              maxlength="5000"
              hide-details
              class="composer-field"
              @keydown="handleComposerKeydown"
            />
            <div class="composer-footer">
              <span>Enter — надіслати · Shift + Enter — новий рядок</span>
              <v-btn
                color="primary"
                icon="mdi-send"
                size="small"
                :loading="sending"
                :disabled="!content.trim() || !chat.connected"
                aria-label="Надіслати повідомлення"
                @click="sendMessage"
              />
            </div>
          </div>
        </div>
      </v-card>
    </div>

    <v-dialog v-model="editDialog" max-width="560" persistent>
      <v-card class="action-dialog">
        <v-card-title>Редагувати повідомлення</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="editContent"
            label="Повідомлення"
            variant="outlined"
            rows="5"
            auto-grow
            maxlength="5000"
            counter
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="actionLoading"
            @click="editDialog = false"
          >
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            :loading="actionLoading"
            :disabled="!editContent.trim()"
            @click="updateMessage"
          >
            Зберегти
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="430">
      <v-card class="action-dialog">
        <v-card-title>Видалити повідомлення?</v-card-title>
        <v-card-text>
          Повідомлення буде остаточно видалено з командного чату.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="actionLoading"
            @click="deleteDialog = false"
          >
            Скасувати
          </v-btn>
          <v-btn color="error" :loading="actionLoading" @click="deleteMessage">
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
.chat-page {
  display: flex;
  min-height: calc(100vh - 36px);
  flex-direction: column;
  animation: page-in 0.35s ease-out;
}

.chat-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.page-kicker {
  margin-bottom: 6px;
  color: #b07047;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid #dce8e3;
  border-radius: 10px;
  color: #53776f;
  background: #f4f9f7;
  font-size: 9px;
  font-weight: 700;
}

.sync-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #42a27e;
  box-shadow: 0 0 0 3px rgba(66, 162, 126, 0.14);
}

.sync-status--offline {
  color: #a46a43;
  border-color: #eadbce;
  background: #fff8f1;
}

.sync-status--offline .sync-dot {
  background: #d87942;
  box-shadow: 0 0 0 3px rgba(216, 121, 66, 0.14);
}

.chat-layout {
  display: grid;
  min-height: 640px;
  flex: 1;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
}

.members-card,
.conversation-card {
  overflow: hidden;
}

.members-card {
  padding: 18px 14px;
}

.members-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5px;
  color: #26736a;
}

.members-heading > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.members-heading span {
  color: #344650;
  font-family: Georgia, serif;
  font-size: 17px;
  font-weight: 700;
}

.members-heading strong {
  color: #9aa3a8;
  font-size: 10px;
}

.member-summary {
  margin: 5px 5px 15px;
  color: #919ca2;
  font-size: 9px;
}

.members-loading {
  margin: 0 -8px;
}

.member-list {
  display: grid;
  gap: 4px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
}

.member-row--current {
  background: #f0f6f3;
}

.member-avatar,
.composer-avatar,
.message-avatar {
  display: grid;
  flex: 0 0 auto;
  border-radius: 12px;
  color: #26736a;
  background: #e7f1ed;
  font-size: 10px;
  font-weight: 800;
  place-items: center;
}

.member-avatar {
  position: relative;
  width: 38px;
  height: 38px;
}

.member-avatar i {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #42a27e;
}

.member-copy {
  min-width: 0;
}

.member-copy strong,
.member-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-copy strong {
  color: #3a4b56;
  font-size: 10px;
}

.member-copy strong small {
  margin-left: 5px;
  padding: 2px 5px;
  border-radius: 5px;
  color: #26736a;
  background: #dcece6;
  font-size: 7px;
  text-transform: uppercase;
}

.member-copy span {
  margin-top: 3px;
  color: #929ca2;
  font-size: 8px;
}

.conversation-card {
  display: grid;
  min-width: 0;
  grid-template-rows: auto minmax(360px, 1fr) auto;
}

.conversation-header {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 11px;
  padding: 13px 19px;
  border-bottom: 1px solid #e7ebe7;
}

.room-mark {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 12px;
  color: #fff;
  background: #26736a;
  place-items: center;
}

.conversation-header strong,
.conversation-header span {
  display: block;
}

.conversation-header strong {
  color: #31434f;
  font-family: Georgia, serif;
  font-size: 16px;
}

.conversation-header span {
  margin-top: 3px;
  color: #929ca2;
  font-size: 9px;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  color: #73818a;
  font-size: 8px;
}

.message-list {
  height: min(62vh, 670px);
  min-height: 420px;
  overflow-y: auto;
  padding: 14px 22px 22px;
  background:
    radial-gradient(circle at 10% 10%, rgba(38, 115, 106, 0.035), transparent 28%),
    #fafbf9;
  scroll-behavior: smooth;
}

.message-list::-webkit-scrollbar {
  width: 7px;
}

.message-list::-webkit-scrollbar-thumb {
  border-radius: 7px;
  background: #d5ddd9;
}

.messages-loading,
.chat-empty {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #8a969d;
  gap: 10px;
  text-align: center;
}

.messages-loading span {
  font-size: 10px;
}

.older-row {
  display: flex;
  justify-content: center;
  padding-bottom: 8px;
}

.chat-empty__icon {
  display: grid;
  width: 62px;
  height: 62px;
  border-radius: 20px;
  color: #26736a;
  background: #e5f0ec;
  place-items: center;
}

.chat-empty h2 {
  margin: 5px 0 0;
  color: #344650;
  font-family: Georgia, serif;
  font-size: 20px;
}

.chat-empty p {
  max-width: 390px;
  margin: 0;
  color: #89949b;
  font-size: 11px;
  line-height: 1.55;
}

.day-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: #97a0a5;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}

.day-divider::before,
.day-divider::after {
  height: 1px;
  flex: 1;
  background: #e2e7e3;
  content: '';
}

.message-row {
  display: flex;
  max-width: min(780px, 86%);
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.message-row--mine {
  margin-left: auto;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  margin-top: 19px;
}

.message-row--mine .message-avatar {
  color: #a35f35;
  background: #f6e6d9;
}

.message-content {
  min-width: 0;
}

.message-heading {
  display: flex;
  min-height: 19px;
  align-items: center;
  gap: 7px;
  padding: 0 4px;
}

.message-row--mine .message-heading {
  justify-content: flex-end;
}

.message-heading strong {
  color: #42545e;
  font-size: 10px;
}

.message-heading time,
.message-heading small {
  color: #9aa3a8;
  font-size: 8px;
}

.admin-badge {
  padding: 2px 5px;
  border-radius: 5px;
  color: #9b633e;
  background: #f4e5d7;
  font-size: 7px;
  font-weight: 700;
}

.message-bubble {
  position: relative;
  min-width: 90px;
  padding: 11px 37px 11px 13px;
  border: 1px solid #e1e7e3;
  border-radius: 5px 15px 15px;
  color: #52616a;
  background: #fff;
  box-shadow: 0 5px 14px rgba(47, 67, 61, 0.04);
}

.message-row--mine .message-bubble {
  border-color: #bdd8ce;
  border-radius: 15px 5px 15px 15px;
  background: #e9f3ef;
}

.message-bubble p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.message-menu {
  position: absolute;
  top: 4px;
  right: 5px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.message-bubble:hover .message-menu,
.message-menu:focus-visible {
  opacity: 1;
}

.composer {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 16px 19px;
  border-top: 1px solid #e4e9e5;
  background: #fff;
}

.composer-avatar {
  width: 38px;
  height: 38px;
  margin-top: 2px;
}

.composer-body {
  min-width: 0;
  flex: 1;
}

.composer-field :deep(.v-field) {
  border-radius: 13px;
  background: #fafbf9;
}

.composer-field :deep(textarea) {
  font-size: 11px;
  line-height: 1.55;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}

.composer-footer span {
  color: #9aa3a8;
  font-size: 8px;
}

.action-dialog {
  padding: 8px;
}

.action-dialog :deep(.v-card-title) {
  color: #31434f;
  font-family: Georgia, serif;
}

.action-dialog :deep(.v-card-text) {
  color: #68767e;
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

@media (max-width: 900px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }

  .members-card {
    padding: 14px;
  }

  .member-list {
    display: flex;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .member-row {
    min-width: 210px;
  }

  .message-list {
    height: 56vh;
  }
}

@media (max-width: 600px) {
  .chat-page__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .conversation-meta {
    display: none;
  }

  .message-list {
    min-height: 390px;
    padding: 12px 11px 18px;
  }

  .message-row {
    max-width: 95%;
  }

  .message-avatar {
    width: 31px;
    height: 31px;
    font-size: 8px;
  }

  .composer {
    padding: 12px;
  }

  .composer-avatar {
    display: none;
  }

  .composer-footer span {
    display: none;
  }

  .composer-footer {
    justify-content: flex-end;
  }

  .message-menu {
    opacity: 1;
  }
}
</style>
