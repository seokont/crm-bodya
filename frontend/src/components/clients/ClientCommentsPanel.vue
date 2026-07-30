<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import type { ClientComment } from '@/types/client';

const props = defineProps<{
  clientId: number;
}>();

const auth = useAuthStore();
const comments = ref<ClientComment[]>([]);
const loading = ref(false);
const saving = ref(false);
const content = ref('');
const editContent = ref('');
const editingComment = ref<ClientComment | null>(null);
const commentToDelete = ref<ClientComment | null>(null);
const editDialog = ref(false);
const deleteDialog = ref(false);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('primary');

function notify(message: string, color = 'primary') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
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

function formatTimestamp(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  };
}

function wasEdited(comment: ClientComment) {
  return (
    new Date(comment.updatedAt).getTime() -
      new Date(comment.createdAt).getTime() >
    1000
  );
}

function canManage(comment: ClientComment) {
  return auth.isAdmin || comment.authorId === auth.user?.id;
}

async function fetchComments() {
  loading.value = true;
  try {
    comments.value = await clientsApi.getComments(props.clientId);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

async function addComment() {
  const value = content.value.trim();
  if (!value) {
    notify('Напишіть текст коментаря', 'warning');
    return;
  }

  saving.value = true;
  try {
    const comment = await clientsApi.createComment(props.clientId, value);
    comments.value = [comment, ...comments.value];
    content.value = '';
    notify('Коментар додано');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function openEditor(comment: ClientComment) {
  editingComment.value = comment;
  editContent.value = comment.content;
  editDialog.value = true;
}

async function updateComment() {
  const value = editContent.value.trim();
  if (!editingComment.value || !value) {
    notify('Коментар не може бути порожнім', 'warning');
    return;
  }

  saving.value = true;
  try {
    const updated = await clientsApi.updateComment(
      props.clientId,
      editingComment.value.id,
      value,
    );
    comments.value = comments.value.map((comment) =>
      comment.id === updated.id ? updated : comment,
    );
    editDialog.value = false;
    editingComment.value = null;
    notify('Коментар оновлено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function requestDelete(comment: ClientComment) {
  commentToDelete.value = comment;
  deleteDialog.value = true;
}

async function deleteComment() {
  if (!commentToDelete.value) return;

  saving.value = true;
  try {
    await clientsApi.removeComment(props.clientId, commentToDelete.value.id);
    comments.value = comments.value.filter(
      (comment) => comment.id !== commentToDelete.value?.id,
    );
    deleteDialog.value = false;
    commentToDelete.value = null;
    notify('Коментар видалено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(fetchComments);
</script>

<template>
  <div class="comments-panel">
    <div class="comments-heading">
      <div>
        <h3>Коментарі</h3>
        <p>
          {{ comments.length }}
          {{
            comments.length === 1
              ? 'коментар'
              : comments.length > 1 && comments.length < 5
                ? 'коментарі'
                : 'коментарів'
          }}
        </p>
      </div>
      <div class="access-note">
        <v-icon icon="mdi-account-group-outline" size="16" />
        Доступно всій команді
      </div>
    </div>

    <div class="comment-composer">
      <div class="composer-author">
        <v-avatar size="38" color="#e8f2ee">
          {{ initials(auth.user?.name || 'CRM') }}
        </v-avatar>
        <div>
          <strong>{{ auth.user?.name }}</strong>
          <span>Новий коментар</span>
        </div>
      </div>
      <v-textarea
        v-model="content"
        placeholder="Напишіть коментар для команди…"
        variant="outlined"
        rows="3"
        auto-grow
        maxlength="3000"
        counter
        hide-details="auto"
        class="comment-field"
        @keydown.ctrl.enter="addComment"
      />
      <div class="composer-footer">
        <span>Ctrl + Enter — надіслати</span>
        <v-btn
          color="primary"
          prepend-icon="mdi-send-outline"
          :loading="saving"
          :disabled="!content.trim()"
          @click="addComment"
        >
          Додати коментар
        </v-btn>
      </div>
    </div>

    <div v-if="loading" class="comments-loading">
      <v-skeleton-loader
        v-for="index in 3"
        :key="index"
        type="list-item-avatar-three-line"
      />
    </div>

    <div v-else-if="comments.length" class="comment-list">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="comment-card"
      >
        <v-avatar size="40" color="#edf3f0" class="comment-avatar">
          {{ initials(comment.authorName) }}
        </v-avatar>

        <div class="comment-body">
          <div class="comment-author">
            <strong>{{ comment.authorName }}</strong>
            <span v-if="wasEdited(comment)">відредаговано</span>
          </div>
          <p>{{ comment.content }}</p>
        </div>

        <div class="comment-side">
          <time :datetime="comment.createdAt">
            <strong>{{ formatTimestamp(comment.createdAt).time }}</strong>
            <span>{{ formatTimestamp(comment.createdAt).date }}</span>
          </time>
          <div v-if="canManage(comment)" class="comment-actions">
            <v-btn
              icon="mdi-pencil-outline"
              size="x-small"
              variant="text"
              aria-label="Редагувати коментар"
              @click="openEditor(comment)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="error"
              aria-label="Видалити коментар"
              @click="requestDelete(comment)"
            />
          </div>
        </div>
      </article>
    </div>

    <div v-else class="comments-empty">
      <div class="empty-icon">
        <v-icon icon="mdi-comment-text-outline" size="29" />
      </div>
      <h3>Коментарів ще немає</h3>
      <p>
        Залиште перший коментар — його побачать усі менеджери та адміністратор.
      </p>
    </div>

    <v-dialog v-model="editDialog" max-width="560" persistent>
      <v-card class="comment-dialog">
        <v-card-title>
          <span>Редагувати коментар</span>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :disabled="saving"
            @click="editDialog = false"
          />
        </v-card-title>
        <v-card-text>
          <v-textarea
            v-model="editContent"
            label="Коментар"
            variant="outlined"
            rows="5"
            auto-grow
            maxlength="3000"
            counter
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="editDialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!editContent.trim()"
            @click="updateComment"
          >
            Зберегти
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card class="comment-dialog">
        <v-card-title>Видалити коментар?</v-card-title>
        <v-card-text>
          Коментар буде видалено без можливості відновлення.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="deleteDialog = false">
            Скасувати
          </v-btn>
          <v-btn color="error" :loading="saving" @click="deleteComment">
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
.comments-panel {
  padding: 24px;
}

.comments-heading,
.composer-author,
.composer-footer,
.comment-author {
  display: flex;
  align-items: center;
}

.comments-heading {
  justify-content: space-between;
  gap: 16px;
}

.comments-heading h3 {
  margin: 0;
  color: #314450;
  font-family: Georgia, serif;
  font-size: 18px;
}

.comments-heading p {
  margin: 4px 0 0;
  color: #929ca3;
  font-size: 11px;
}

.access-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 10px;
  color: #4b756d;
  background: #eaf3f0;
  font-size: 10px;
  font-weight: 700;
}

.comment-composer {
  margin-top: 20px;
  padding: 18px;
  border: 1px solid #dfe7e3;
  border-radius: 16px;
  background: #fbfcfb;
  box-shadow: 0 12px 28px rgba(39, 66, 60, 0.05);
}

.composer-author {
  gap: 10px;
  margin-bottom: 13px;
}

.composer-author .v-avatar {
  color: #26736a;
  font-size: 11px;
  font-weight: 800;
}

.composer-author strong,
.composer-author span {
  display: block;
}

.composer-author strong {
  color: #344650;
  font-size: 12px;
}

.composer-author span {
  margin-top: 2px;
  color: #929ba1;
  font-size: 10px;
}

.comment-field :deep(.v-field) {
  background: #fff;
}

.composer-footer {
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.composer-footer > span {
  color: #9aa2a8;
  font-size: 9px;
}

.comments-loading,
.comment-list {
  margin-top: 18px;
}

.comment-list {
  display: grid;
  gap: 10px;
}

.comment-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 105px;
  gap: 13px;
  align-items: start;
  padding: 16px;
  border: 1px solid #e6ebe8;
  border-radius: 14px;
  background: #fff;
}

.comment-avatar {
  color: #48746c;
  font-size: 10px;
  font-weight: 800;
}

.comment-body {
  min-width: 0;
}

.comment-author {
  flex-wrap: wrap;
  gap: 7px;
}

.comment-author strong {
  color: #344650;
  font-size: 12px;
}

.comment-author span {
  color: #9aa2a8;
  font-size: 9px;
  font-style: italic;
}

.comment-body p {
  margin: 7px 0 0;
  color: #5f6d75;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-side {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  min-height: 58px;
}

.comment-side time {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  color: #929ba1;
  white-space: nowrap;
}

.comment-side time strong {
  color: #617079;
  font-size: 12px;
}

.comment-side time span {
  margin-top: 2px;
  font-size: 9px;
}

.comment-actions {
  display: flex;
  margin-top: auto;
}

.comments-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 230px;
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

.comments-empty h3 {
  margin: 0;
  color: #344653;
  font-family: Georgia, serif;
  font-size: 18px;
}

.comments-empty p {
  max-width: 430px;
  margin: 8px 0 0;
  color: #87929a;
  font-size: 12px;
  line-height: 1.55;
}

.comment-dialog {
  padding: 8px;
}

.comment-dialog :deep(.v-card-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #2e404b;
  font-family: Georgia, serif;
}

.comment-dialog :deep(.v-card-text) {
  color: #6f7c84;
  font-size: 12px;
}

@media (max-width: 650px) {
  .comments-panel {
    padding: 18px 15px;
  }

  .comments-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .composer-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .composer-footer > span {
    display: none;
  }

  .composer-footer .v-btn {
    width: 100%;
  }

  .comment-card {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .comment-avatar {
    width: 36px !important;
    height: 36px !important;
  }

  .comment-side {
    grid-column: 2;
    align-items: center;
    flex-direction: row;
    min-height: 0;
  }

  .comment-side time {
    align-items: center;
    flex-direction: row;
    gap: 6px;
  }

  .comment-side time span {
    margin: 0;
  }

  .comment-actions {
    margin: 0 0 0 auto;
  }
}
</style>
