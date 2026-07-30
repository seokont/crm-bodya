<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { managersApi } from '@/services/managers.api';
import { getApiError } from '@/services/http';
import type {
  CreateManagerPayload,
  ManagedUser,
  UpdateManagerPayload,
} from '@/types/auth';

interface FormRef {
  validate: () => Promise<{ valid: boolean }>;
  resetValidation: () => void;
}

const managers = ref<ManagedUser[]>([]);
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const createDialog = ref(false);
const editDialog = ref(false);
const statusDialog = ref(false);
const passwordDialog = ref(false);
const deleteDialog = ref(false);
const selectedManager = ref<ManagedUser | null>(null);
const newPassword = ref('');
const showPassword = ref(false);
const formRef = ref<FormRef | null>(null);
const editFormRef = ref<FormRef | null>(null);
const passwordFormRef = ref<FormRef | null>(null);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const createForm = reactive<CreateManagerPayload>({
  name: '',
  email: '',
  password: '',
});

const editForm = reactive<Required<Pick<UpdateManagerPayload, 'name' | 'email'>>>({
  name: '',
  email: '',
});

const headers = [
  { title: 'Менеджер', key: 'name', minWidth: 220 },
  { title: 'Email', key: 'email', minWidth: 220 },
  { title: 'Статус', key: 'isActive', width: 150 },
  { title: 'Останній вхід', key: 'lastLoginAt', minWidth: 170 },
  { title: 'Створено', key: 'createdAt', minWidth: 150 },
  { title: '', key: 'actions', sortable: false, width: 165 },
] as const;

const activeCount = computed(
  () => managers.value.filter((manager) => manager.isActive).length,
);

const editHasChanges = computed(() => {
  if (!selectedManager.value) return false;
  return (
    editForm.name.trim() !== selectedManager.value.name ||
    editForm.email.trim().toLowerCase() !==
      selectedManager.value.email.toLowerCase()
  );
});

const required = (value: string) =>
  Boolean(value?.trim()) || "Обов'язкове поле";
const emailRule = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Вкажіть коректний email';
const passwordRule = (value: string) =>
  value.length >= 8 || 'Щонайменше 8 символів';

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Ще не входив';

function notify(message: string, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

async function fetchManagers() {
  loading.value = true;
  try {
    managers.value = await managersApi.getAll();
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(createForm, { name: '', email: '', password: '' });
  showPassword.value = false;
  createDialog.value = true;
  formRef.value?.resetValidation();
}

async function createManager() {
  const result = await formRef.value?.validate();
  if (!result?.valid) return;

  saving.value = true;
  try {
    const manager = await managersApi.create({
      name: createForm.name.trim(),
      email: createForm.email.trim().toLowerCase(),
      password: createForm.password,
    });
    managers.value.push(manager);
    managers.value.sort((left, right) =>
      left.name.localeCompare(right.name, 'uk'),
    );
    createDialog.value = false;
    notify(`Менеджера ${manager.name} створено`);
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function openEdit(manager: ManagedUser) {
  selectedManager.value = manager;
  editForm.name = manager.name;
  editForm.email = manager.email;
  editDialog.value = true;
  editFormRef.value?.resetValidation();
}

async function updateManager() {
  const result = await editFormRef.value?.validate();
  if (!result?.valid || !selectedManager.value || !editHasChanges.value) return;

  saving.value = true;
  try {
    const updated = await managersApi.update(selectedManager.value.id, {
      name: editForm.name.trim(),
      email: editForm.email.trim().toLowerCase(),
    });
    const index = managers.value.findIndex((manager) => manager.id === updated.id);
    if (index >= 0) managers.value[index] = updated;
    managers.value.sort((left, right) =>
      left.name.localeCompare(right.name, 'uk'),
    );
    editDialog.value = false;
    selectedManager.value = null;
    notify('Дані менеджера оновлено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function requestStatusChange(manager: ManagedUser) {
  selectedManager.value = manager;
  statusDialog.value = true;
}

async function changeStatus() {
  if (!selectedManager.value) return;
  saving.value = true;
  try {
    const updated = await managersApi.update(selectedManager.value.id, {
      isActive: !selectedManager.value.isActive,
    });
    const index = managers.value.findIndex((item) => item.id === updated.id);
    if (index >= 0) managers.value[index] = updated;
    statusDialog.value = false;
    notify(
      updated.isActive
        ? 'Доступ менеджера відновлено'
        : 'Доступ менеджера призупинено',
    );
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function openPasswordReset(manager: ManagedUser) {
  selectedManager.value = manager;
  newPassword.value = '';
  showPassword.value = false;
  passwordDialog.value = true;
  passwordFormRef.value?.resetValidation();
}

async function resetPassword() {
  const result = await passwordFormRef.value?.validate();
  if (!result?.valid || !selectedManager.value) return;
  saving.value = true;
  try {
    await managersApi.resetPassword(
      selectedManager.value.id,
      newPassword.value,
    );
    passwordDialog.value = false;
    notify('Новий пароль збережено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function requestDelete(manager: ManagedUser) {
  selectedManager.value = manager;
  deleteDialog.value = true;
}

async function deleteManager() {
  if (!selectedManager.value) return;
  const manager = selectedManager.value;
  saving.value = true;
  try {
    const result = await managersApi.remove(manager.id);
    managers.value = managers.value.filter((item) => item.id !== manager.id);
    deleteDialog.value = false;
    selectedManager.value = null;
    notify(
      result.unassignedClients
        ? `Менеджера видалено. Клієнтів без відповідального: ${result.unassignedClients}`
        : 'Менеджера остаточно видалено',
    );
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await fetchManagers();
  if (route.query.create === '1') {
    openCreate();
    const query = { ...route.query };
    delete query.create;
    await router.replace({ query });
  }
});
</script>

<template>
  <div class="page-shell managers-page">
    <header class="page-header">
      <div>
        <div class="eyebrow">
          <span class="eyebrow__line" />
          Адміністрування
        </div>
        <h1 class="page-title">Менеджери</h1>
        <p class="page-subtitle">
          Створюйте облікові записи та керуйте доступом команди до CRM.
        </p>
      </div>
      <v-btn
        color="primary"
        size="large"
        prepend-icon="mdi-account-plus-outline"
        @click="openCreate"
      >
        Додати менеджера
      </v-btn>
    </header>

    <div class="summary-grid">
      <v-card class="section-card summary-card">
        <div class="summary-icon summary-icon--active">
          <v-icon icon="mdi-account-check-outline" />
        </div>
        <div>
          <div class="summary-value">{{ activeCount }}</div>
          <div class="summary-label">Активні менеджери</div>
        </div>
      </v-card>
      <v-card class="section-card summary-card">
        <div class="summary-icon">
          <v-icon icon="mdi-account-group-outline" />
        </div>
        <div>
          <div class="summary-value">{{ managers.length }}</div>
          <div class="summary-label">Усього облікових записів</div>
        </div>
      </v-card>
    </div>

    <v-card class="section-card table-card">
      <div class="table-heading">
        <div>
          <h2>Команда</h2>
          <p>Доступ до клієнтської бази та робочих інструментів</p>
        </div>
        <v-btn
          icon="mdi-refresh"
          variant="text"
          aria-label="Оновити список"
          :loading="loading"
          @click="fetchManagers"
        />
      </div>

      <v-data-table
        :headers="headers"
        :items="managers"
        :loading="loading"
        item-value="id"
        loading-text="Завантажуємо менеджерів..."
        no-data-text="Менеджерів ще немає"
        class="managers-table"
      >
        <template #item.name="{ item }">
          <div class="manager-person">
            <v-avatar size="38" color="#e8f2ee">
              {{ item.name.split(' ').map((part) => part[0]).join('').slice(0, 2) }}
            </v-avatar>
            <div>
              <strong>{{ item.name }}</strong>
              <small>Менеджер</small>
            </div>
          </div>
        </template>

        <template #item.isActive="{ item }">
          <v-chip
            :color="item.isActive ? '#e5f3ec' : '#f1f2f3'"
            size="small"
            variant="flat"
            class="status-chip"
          >
            <span
              class="status-dot"
              :class="{ 'status-dot--inactive': !item.isActive }"
            />
            {{ item.isActive ? 'Активний' : 'Призупинений' }}
          </v-chip>
        </template>

        <template #item.lastLoginAt="{ item }">
          <span class="date-cell">{{ formatDate(item.lastLoginAt) }}</span>
        </template>

        <template #item.createdAt="{ item }">
          <span class="date-cell">{{ formatDate(item.createdAt) }}</span>
        </template>

        <template #item.actions="{ item }">
          <div class="row-actions">
            <v-btn
              icon="mdi-account-edit-outline"
              variant="text"
              size="small"
              color="primary"
              aria-label="Редагувати менеджера"
              @click="openEdit(item)"
            />
            <v-btn
              icon="mdi-lock-reset"
              variant="text"
              size="small"
              aria-label="Змінити пароль"
              @click="openPasswordReset(item)"
            />
            <v-btn
              :icon="item.isActive ? 'mdi-account-cancel-outline' : 'mdi-account-check-outline'"
              variant="text"
              size="small"
              :color="item.isActive ? 'error' : 'success'"
              :aria-label="item.isActive ? 'Призупинити доступ' : 'Відновити доступ'"
              @click="requestStatusChange(item)"
            />
            <v-btn
              icon="mdi-trash-can-outline"
              variant="text"
              size="small"
              color="error"
              aria-label="Видалити менеджера"
              @click="requestDelete(item)"
            />
          </div>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="editDialog" max-width="570" persistent>
      <v-card>
        <v-card-title class="dialog-heading">
          <div class="dialog-icon">
            <v-icon icon="mdi-account-edit-outline" />
          </div>
          <div>
            <div class="dialog-title">Редагувати менеджера</div>
            <div class="dialog-subtitle">
              Змініть ім’я або адресу для входу
            </div>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            :disabled="saving"
            @click="editDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <v-form ref="editFormRef" @submit.prevent="updateManager">
            <v-text-field
              v-model="editForm.name"
              label="Ім'я та прізвище"
              prepend-inner-icon="mdi-account-outline"
              :rules="[required]"
              maxlength="191"
              class="mb-3"
            />
            <v-text-field
              v-model="editForm.email"
              label="Email для входу"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :rules="[required, emailRule]"
              maxlength="191"
              hint="Після збереження менеджер входитиме з новою email-адресою"
              persistent-hint
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn variant="text" :disabled="saving" @click="editDialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-save-outline"
            :loading="saving"
            :disabled="!editHasChanges"
            @click="updateManager"
          >
            Зберегти зміни
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="createDialog" max-width="570" persistent>
      <v-card>
        <v-card-title class="dialog-heading">
          <div class="dialog-icon">
            <v-icon icon="mdi-account-plus-outline" />
          </div>
          <div>
            <div class="dialog-title">Новий менеджер</div>
            <div class="dialog-subtitle">Створіть доступ до CRM</div>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            :disabled="saving"
            @click="createDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <v-form ref="formRef" @submit.prevent="createManager">
            <v-text-field
              v-model="createForm.name"
              label="Ім'я та прізвище"
              prepend-inner-icon="mdi-account-outline"
              :rules="[required]"
              class="mb-3"
            />
            <v-text-field
              v-model="createForm.email"
              label="Email"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :rules="[required, emailRule]"
              class="mb-3"
            />
            <v-text-field
              v-model="createForm.password"
              label="Тимчасовий пароль"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              :rules="[required, passwordRule]"
              hint="Щонайменше 8 символів"
              persistent-hint
              @click:append-inner="showPassword = !showPassword"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn variant="text" :disabled="saving" @click="createDialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-check"
            :loading="saving"
            @click="createManager"
          >
            Створити менеджера
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="470" persistent>
      <v-card class="pa-2">
        <v-card-text class="text-center pt-7">
          <div class="delete-manager-icon">
            <v-icon icon="mdi-account-remove-outline" size="29" />
          </div>
          <h3 class="delete-manager-title">Видалити менеджера остаточно?</h3>
          <p class="delete-manager-copy">
            Обліковий запис
            <strong>{{ selectedManager?.name }}</strong>
            буде видалено без можливості відновлення. Закріплені клієнти
            залишаться в CRM без відповідального менеджера.
          </p>
        </v-card-text>
        <v-card-actions class="justify-center pb-5">
          <v-btn
            variant="text"
            :disabled="saving"
            @click="deleteDialog = false"
          >
            Скасувати
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            prepend-icon="mdi-trash-can-outline"
            :loading="saving"
            @click="deleteManager"
          >
            Видалити остаточно
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="statusDialog" max-width="440">
      <v-card class="pa-2">
        <v-card-text class="text-center pt-7">
          <div class="confirm-icon">
            <v-icon
              :icon="selectedManager?.isActive ? 'mdi-account-cancel-outline' : 'mdi-account-check-outline'"
              size="28"
            />
          </div>
          <h3>
            {{
              selectedManager?.isActive
                ? 'Призупинити доступ?'
                : 'Відновити доступ?'
            }}
          </h3>
          <p>
            {{ selectedManager?.name }}
            {{
              selectedManager?.isActive
                ? 'не зможе входити до CRM.'
                : 'знову зможе працювати в CRM.'
            }}
          </p>
        </v-card-text>
        <v-card-actions class="justify-center pb-5">
          <v-btn variant="text" @click="statusDialog = false">Скасувати</v-btn>
          <v-btn
            :color="selectedManager?.isActive ? 'error' : 'success'"
            variant="tonal"
            :loading="saving"
            @click="changeStatus"
          >
            {{ selectedManager?.isActive ? 'Призупинити' : 'Відновити' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="passwordDialog" max-width="470" persistent>
      <v-card>
        <v-card-title class="dialog-heading">
          <div class="dialog-icon">
            <v-icon icon="mdi-lock-reset" />
          </div>
          <div>
            <div class="dialog-title">Новий пароль</div>
            <div class="dialog-subtitle">{{ selectedManager?.name }}</div>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            :disabled="saving"
            @click="passwordDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <v-form ref="passwordFormRef" @submit.prevent="resetPassword">
            <v-text-field
              v-model="newPassword"
              label="Новий пароль"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              :rules="[required, passwordRule]"
              hint="Щонайменше 8 символів"
              persistent-hint
              @click:append-inner="showPassword = !showPassword"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-btn variant="text" :disabled="saving" @click="passwordDialog = false">
            Скасувати
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            @click="resetPassword"
          >
            Зберегти пароль
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
.managers-page {
  animation: page-in 0.35s ease-out;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 25px;
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

.summary-grid {
  display: grid;
  max-width: 650px;
  margin-bottom: 20px;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.summary-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  color: #d87942;
  background: #fbeee6;
}

.summary-icon--active {
  color: #26736a;
  background: #e8f2ee;
}

.summary-value {
  color: #17293e;
  font-family: Georgia, serif;
  font-size: 23px;
  font-weight: 700;
}

.summary-label {
  margin-top: 2px;
  color: #7e8991;
  font-size: 11px;
}

.table-card {
  overflow: hidden;
}

.table-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76px;
  padding: 0 22px;
  border-bottom: 1px solid #e9ece7;
}

.table-heading h2 {
  margin: 0;
  color: #263747;
  font-family: Georgia, serif;
  font-size: 20px;
}

.table-heading p {
  margin: 4px 0 0;
  color: #929ba2;
  font-size: 11px;
}

.managers-table :deep(th) {
  color: #71808c !important;
  background: #fafbf9 !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase;
}

.managers-table :deep(td) {
  height: 70px !important;
  border-color: #eef0ed !important;
  color: #43515c;
  font-size: 13px;
}

.manager-person {
  display: flex;
  align-items: center;
  gap: 11px;
}

.manager-person .v-avatar {
  color: #26736a;
  font-size: 11px;
  font-weight: 800;
}

.manager-person strong,
.manager-person small {
  display: block;
}

.manager-person small {
  margin-top: 3px;
  color: #929ba2;
  font-size: 10px;
}

.status-chip {
  color: #3c4b54 !important;
  font-size: 11px;
  font-weight: 650;
}

.status-dot {
  width: 7px;
  height: 7px;
  margin-right: 7px;
  border-radius: 50%;
  background: #35805d;
}

.status-dot--inactive {
  background: #8a959d;
}

.date-cell {
  color: #6f7c87;
  font-size: 12px;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
}

.dialog-heading {
  display: flex;
  align-items: center;
  min-height: 80px;
  padding: 15px 20px;
}

.dialog-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-right: 11px;
  border-radius: 13px;
  color: #26736a;
  background: #e8f2ee;
}

.dialog-title {
  color: #17293e;
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: 700;
}

.dialog-subtitle {
  margin-top: 3px;
  color: #8b959d;
  font-size: 11px;
}

.dialog-actions {
  justify-content: flex-end;
  gap: 8px;
  min-height: 70px;
  padding: 13px 20px;
}

.confirm-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin: 0 auto 15px;
  border-radius: 17px;
  color: #d87942;
  background: #fbede4;
}

.confirm-icon + h3 {
  margin: 0;
  color: #263746;
  font-family: Georgia, serif;
  font-size: 21px;
}

.confirm-icon ~ p {
  margin: 9px auto 0;
  color: #7e8991;
  font-size: 12px;
  line-height: 1.55;
}

.delete-manager-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 15px;
  border-radius: 18px;
  color: #ba4a4a;
  background: #fae9e8;
}

.delete-manager-title {
  margin: 0;
  color: #263746;
  font-family: Georgia, serif;
  font-size: 21px;
}

.delete-manager-copy {
  max-width: 380px;
  margin: 9px auto 0;
  color: #7e8991;
  font-size: 12px;
  line-height: 1.55;
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

@media (max-width: 700px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-header .v-btn {
    width: 100%;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
