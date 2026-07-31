<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';
import {
  CLIENT_DOCUMENT_CATEGORIES,
  type ClientDocument,
  type ClientDocumentCategory,
  type ClientDocumentPayload,
} from '@/types/client';

const props = defineProps<{
  clientId: number;
  clientManagerId: number | null;
}>();

const emit = defineEmits<{
  changed: [];
}>();

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const auth = useAuthStore();
const documents = ref<ClientDocument[]>([]);
const loading = ref(false);
const saving = ref(false);
const downloadId = ref<number | null>(null);
const uploadDialog = ref(false);
const editDialog = ref(false);
const deleteDialog = ref(false);
const editingDocument = ref<ClientDocument | null>(null);
const documentToDelete = ref<ClientDocument | null>(null);
const selectedFiles = ref<File | File[] | null>(null);
const uploadProgress = ref(0);
const search = ref('');
const categoryFilter = ref<'ALL' | ClientDocumentCategory>('ALL');
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('primary');

const form = reactive<ClientDocumentPayload>({
  title: '',
  category: 'OTHER',
  description: '',
});

const selectedFile = computed(() => {
  if (Array.isArray(selectedFiles.value)) return selectedFiles.value[0] ?? null;
  return selectedFiles.value;
});

const categoryOptions: {
  title: string;
  value: 'ALL' | ClientDocumentCategory;
}[] = [{ title: 'Усі категорії', value: 'ALL' }, ...CLIENT_DOCUMENT_CATEGORIES];

const categoryLabels = Object.fromEntries(
  CLIENT_DOCUMENT_CATEGORIES.map((category) => [
    category.value,
    category.title,
  ]),
) as Record<ClientDocumentCategory, string>;

const filteredDocuments = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('uk-UA');
  return documents.value.filter((document) => {
    if (
      categoryFilter.value !== 'ALL' &&
      document.category !== categoryFilter.value
    ) {
      return false;
    }
    if (!query) return true;
    return [
      document.title,
      document.originalName,
      document.description,
      document.uploaderName,
    ].some((value) => value?.toLocaleLowerCase('uk-UA').includes(query));
  });
});

const totalSize = computed(() =>
  documents.value.reduce((sum, document) => sum + document.size, 0),
);

watch(selectedFile, (file) => {
  if (!file || form.title.trim()) return;
  form.title = file.name.replace(/\.[^.]+$/, '').slice(0, 160);
});

function notify(message: string, color = 'primary') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

function resetForm() {
  form.title = '';
  form.category = 'OTHER';
  form.description = '';
  selectedFiles.value = null;
  uploadProgress.value = 0;
}

function openUploadDialog() {
  resetForm();
  uploadDialog.value = true;
}

function openEditor(document: ClientDocument) {
  editingDocument.value = document;
  form.title = document.title;
  form.category = document.category;
  form.description = document.description || '';
  editDialog.value = true;
}

function requestDelete(document: ClientDocument) {
  documentToDelete.value = document;
  deleteDialog.value = true;
}

function canManage(document: ClientDocument) {
  return (
    auth.isAdmin ||
    document.uploaderId === auth.user?.id ||
    props.clientManagerId === auth.user?.id
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(value)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function filePresentation(document: ClientDocument) {
  if (document.mimeType.includes('pdf')) {
    return { icon: 'mdi-file-pdf-box', color: '#a64d55', background: '#f9e9ea' };
  }
  if (
    document.mimeType.includes('word') ||
    /\.docx?$/i.test(document.originalName)
  ) {
    return { icon: 'mdi-file-word-box', color: '#356a96', background: '#e9f2f9' };
  }
  if (
    document.mimeType.includes('sheet') ||
    document.mimeType.includes('excel') ||
    /\.xlsx?$/i.test(document.originalName)
  ) {
    return {
      icon: 'mdi-file-excel-box',
      color: '#26736a',
      background: '#e5f1ed',
    };
  }
  if (document.mimeType.startsWith('image/')) {
    return { icon: 'mdi-file-image-outline', color: '#755b91', background: '#f1ecf7' };
  }
  if (/\.zip$/i.test(document.originalName)) {
    return { icon: 'mdi-folder-zip-outline', color: '#9a642f', background: '#faf0e4' };
  }
  return { icon: 'mdi-file-outline', color: '#65717a', background: '#edf0f2' };
}

async function fetchDocuments() {
  loading.value = true;
  try {
    documents.value = await clientsApi.getDocuments(props.clientId);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

async function uploadDocument() {
  const file = selectedFile.value;
  if (!file) {
    notify('Оберіть файл для завантаження', 'warning');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    notify('Розмір файла не повинен перевищувати 20 МБ', 'warning');
    return;
  }
  if (!form.title.trim()) {
    notify('Вкажіть назву документа', 'warning');
    return;
  }

  saving.value = true;
  uploadProgress.value = 0;
  try {
    const document = await clientsApi.uploadDocument(
      props.clientId,
      {
        file,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
      },
      (progress) => {
        uploadProgress.value = progress;
      },
    );
    documents.value = [document, ...documents.value];
    uploadDialog.value = false;
    resetForm();
    emit('changed');
    notify('Документ завантажено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function updateDocument() {
  if (!editingDocument.value || !form.title.trim()) {
    notify('Вкажіть назву документа', 'warning');
    return;
  }

  saving.value = true;
  try {
    const updated = await clientsApi.updateDocument(
      props.clientId,
      editingDocument.value.id,
      {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
      },
    );
    documents.value = documents.value.map((document) =>
      document.id === updated.id ? updated : document,
    );
    editDialog.value = false;
    editingDocument.value = null;
    emit('changed');
    notify('Документ оновлено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function downloadDocument(document: ClientDocument) {
  downloadId.value = document.id;
  try {
    await clientsApi.downloadDocument(props.clientId, document);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    downloadId.value = null;
  }
}

async function deleteDocument() {
  if (!documentToDelete.value) return;

  saving.value = true;
  try {
    await clientsApi.removeDocument(
      props.clientId,
      documentToDelete.value.id,
    );
    documents.value = documents.value.filter(
      (document) => document.id !== documentToDelete.value?.id,
    );
    deleteDialog.value = false;
    documentToDelete.value = null;
    emit('changed');
    notify('Документ видалено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(fetchDocuments);
</script>

<template>
  <div class="documents-panel">
    <div class="documents-toolbar">
      <div>
        <h3>Документи клієнта</h3>
        <p>
          {{ documents.length }} документів · {{ formatBytes(totalSize) }}
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-cloud-upload-outline"
        @click="openUploadDialog"
      >
        Завантажити
      </v-btn>
    </div>

    <div v-if="documents.length || search || categoryFilter !== 'ALL'" class="document-filters">
      <v-text-field
        v-model="search"
        label="Пошук документа"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        clearable
        hide-details
      />
      <v-select
        v-model="categoryFilter"
        :items="categoryOptions"
        label="Категорія"
        density="compact"
        variant="outlined"
        hide-details
      />
    </div>

    <div v-if="loading" class="document-loading">
      <v-skeleton-loader
        v-for="index in 3"
        :key="index"
        type="list-item-avatar-three-line"
      />
    </div>

    <div v-else-if="filteredDocuments.length" class="document-list">
      <article
        v-for="document in filteredDocuments"
        :key="document.id"
        class="document-card"
      >
        <div
          class="document-icon"
          :style="{
            color: filePresentation(document).color,
            background: filePresentation(document).background,
          }"
        >
          <v-icon :icon="filePresentation(document).icon" size="27" />
        </div>

        <div class="document-copy">
          <div class="document-title-row">
            <div>
              <h4>{{ document.title }}</h4>
              <span class="original-name">{{ document.originalName }}</span>
            </div>
            <v-chip size="x-small" variant="tonal" color="primary">
              {{ categoryLabels[document.category] }}
            </v-chip>
          </div>

          <p v-if="document.description" class="document-description">
            {{ document.description }}
          </p>

          <div class="document-meta">
            <span>
              <v-icon icon="mdi-database-outline" size="14" />
              {{ formatBytes(document.size) }}
            </span>
            <span>
              <v-icon icon="mdi-account-outline" size="14" />
              {{ document.uploaderName }}
            </span>
            <span>
              <v-icon icon="mdi-clock-outline" size="14" />
              {{ formatDate(document.createdAt) }}
            </span>
          </div>
        </div>

        <div class="document-actions">
          <v-btn
            icon="mdi-download-outline"
            size="small"
            variant="tonal"
            color="primary"
            :loading="downloadId === document.id"
            aria-label="Завантажити документ"
            @click="downloadDocument(document)"
          />
          <template v-if="canManage(document)">
            <v-btn
              icon="mdi-pencil-outline"
              size="small"
              variant="text"
              aria-label="Редагувати документ"
              @click="openEditor(document)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="small"
              variant="text"
              color="error"
              aria-label="Видалити документ"
              @click="requestDelete(document)"
            />
          </template>
        </div>
      </article>
    </div>

    <div v-else-if="documents.length" class="documents-empty">
      <div class="empty-icon">
        <v-icon icon="mdi-file-search-outline" size="30" />
      </div>
      <h3>Нічого не знайдено</h3>
      <p>Змініть пошуковий запит або категорію документа.</p>
      <v-btn
        variant="text"
        color="primary"
        @click="search = ''; categoryFilter = 'ALL'"
      >
        Скинути фільтри
      </v-btn>
    </div>

    <div v-else class="documents-empty">
      <div class="empty-icon">
        <v-icon icon="mdi-file-document-plus-outline" size="30" />
      </div>
      <h3>Документів ще немає</h3>
      <p>
        Додайте договори, рахунки, акти та інші файли, пов’язані з клієнтом.
      </p>
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-cloud-upload-outline"
        @click="openUploadDialog"
      >
        Завантажити перший документ
      </v-btn>
    </div>

    <v-dialog v-model="uploadDialog" max-width="620">
      <v-card class="document-dialog">
        <v-card-title>
          <span>Новий документ</span>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :disabled="saving"
            @click="uploadDialog = false"
          />
        </v-card-title>
        <v-card-text class="modal-input-stack">
          <v-file-input
            v-model="selectedFiles"
            label="Файл"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.jpg,.jpeg,.png,.webp,.zip"
            variant="outlined"
            prepend-icon=""
            prepend-inner-icon="mdi-paperclip"
            show-size
            persistent-hint
            hint="PDF, Word, Excel, TXT, RTF, зображення або ZIP · до 20 МБ"
          />
          <v-text-field
            v-model="form.title"
            label="Назва документа"
            variant="outlined"
            maxlength="160"
            counter
          />
          <v-select
            v-model="form.category"
            :items="CLIENT_DOCUMENT_CATEGORIES"
            label="Категорія"
            variant="outlined"
          />
          <v-textarea
            v-model="form.description"
            label="Опис"
            variant="outlined"
            rows="3"
            maxlength="1000"
            counter
          />
          <v-progress-linear
            v-if="saving"
            :model-value="uploadProgress"
            color="primary"
            rounded
            height="7"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="uploadDialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-cloud-upload-outline"
            :loading="saving"
            @click="uploadDocument"
          >
            Завантажити
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editDialog" max-width="560">
      <v-card class="document-dialog">
        <v-card-title>
          <span>Редагувати документ</span>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :disabled="saving"
            @click="editDialog = false"
          />
        </v-card-title>
        <v-card-text class="modal-input-stack">
          <v-text-field
            v-model="form.title"
            label="Назва документа"
            variant="outlined"
            maxlength="160"
            counter
          />
          <v-select
            v-model="form.category"
            :items="CLIENT_DOCUMENT_CATEGORIES"
            label="Категорія"
            variant="outlined"
          />
          <v-textarea
            v-model="form.description"
            label="Опис"
            variant="outlined"
            rows="3"
            maxlength="1000"
            counter
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="editDialog = false">
            Скасувати
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="updateDocument">
            Зберегти
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card class="document-dialog">
        <v-card-title>Видалити документ?</v-card-title>
        <v-card-text>
          Файл «{{ documentToDelete?.title }}» буде остаточно видалено зі
          сховища. Відновити його буде неможливо.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="deleteDialog = false">
            Скасувати
          </v-btn>
          <v-btn color="error" :loading="saving" @click="deleteDocument">
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
.documents-panel {
  padding: 24px;
}

.documents-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.documents-toolbar h3 {
  margin: 0;
  color: #314450;
  font-family: Georgia, serif;
  font-size: 18px;
}

.documents-toolbar p {
  margin: 4px 0 0;
  color: #929ca3;
  font-size: 11px;
}

.document-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(180px, 0.7fr);
  gap: 10px;
  margin-top: 20px;
}

.document-loading {
  margin-top: 16px;
}

.document-list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.document-card {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px;
  border: 1px solid #e5eae7;
  border-radius: 15px;
  background: #fff;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.document-card:hover {
  border-color: #ccdcd6;
  box-shadow: 0 10px 25px rgba(37, 66, 59, 0.07);
  transform: translateY(-1px);
}

.document-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 15px;
}

.document-copy {
  min-width: 0;
}

.document-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.document-title-row h4 {
  margin: 0;
  color: #31434f;
  font-size: 13px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.original-name {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #9099a0;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-description {
  display: -webkit-box;
  margin: 9px 0 0;
  overflow: hidden;
  color: #6d7981;
  font-size: 11px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.document-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 14px;
  margin-top: 10px;
}

.document-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #929ba1;
  font-size: 9px;
}

.document-actions {
  display: flex;
  gap: 3px;
}

.documents-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 280px;
  padding: 48px 24px 30px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin-bottom: 15px;
  border-radius: 18px;
  color: #26736a;
  background: #e9f2ef;
}

.documents-empty h3 {
  margin: 0;
  color: #344653;
  font-family: Georgia, serif;
  font-size: 18px;
}

.documents-empty p {
  max-width: 430px;
  margin: 8px 0 18px;
  color: #87929a;
  font-size: 12px;
  line-height: 1.55;
}

.document-dialog {
  padding: 8px;
}

.document-dialog :deep(.v-card-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #2e404b;
  font-family: Georgia, serif;
}

.document-dialog :deep(.v-card-text) {
  color: #6f7c84;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .documents-panel {
    padding: 18px 15px;
  }

  .documents-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .documents-toolbar .v-btn {
    width: 100%;
  }

  .document-filters {
    grid-template-columns: 1fr;
  }

  .document-card {
    grid-template-columns: 45px minmax(0, 1fr);
    align-items: start;
  }

  .document-icon {
    width: 45px;
    height: 45px;
  }

  .document-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid #edf0ee;
  }

  .document-title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
