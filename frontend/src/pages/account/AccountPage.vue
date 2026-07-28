<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { authApi } from '@/services/auth.api';
import { getApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';

interface FormRef {
  validate: () => Promise<{ valid: boolean }>;
  resetValidation: () => void;
}

const auth = useAuthStore();
const formRef = ref<FormRef | null>(null);
const saving = ref(false);
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmation: '',
});

const initials = computed(() =>
  (auth.user?.name || 'CRM')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
);

const roleLabel = computed(() =>
  auth.user?.role === 'ADMIN' ? 'Адміністратор' : 'Менеджер',
);

const passwordScore = computed(() => {
  const password = form.newPassword;
  if (!password) return 0;
  return [
    password.length >= 8,
    password.length >= 12,
    /[a-zа-яіїєґ]/i.test(password) && /\d/.test(password),
    /[^a-zа-яіїєґ\d]/i.test(password),
  ].filter(Boolean).length;
});

const passwordStrength = computed(() => {
  const levels = ['Введіть новий пароль', 'Слабкий', 'Прийнятний', 'Надійний', 'Дуже надійний'];
  return levels[passwordScore.value];
});

const required = (value: string) =>
  Boolean(value) || "Обов'язкове поле";
const passwordRule = (value: string) =>
  value.length >= 8 || 'Щонайменше 8 символів';
const confirmationRule = (value: string) =>
  value === form.newPassword || 'Паролі не збігаються';

function notify(message: string, color = 'success') {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
}

async function changePassword() {
  const result = await formRef.value?.validate();
  if (!result?.valid) return;

  saving.value = true;
  try {
    await authApi.changePassword(form.currentPassword, form.newPassword);
    Object.assign(form, {
      currentPassword: '',
      newPassword: '',
      confirmation: '',
    });
    formRef.value?.resetValidation();
    showCurrentPassword.value = false;
    showNewPassword.value = false;
    notify('Пароль успішно змінено');
  } catch (error) {
    notify(getApiError(error), 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page-shell account-page">
    <header class="account-header">
      <div>
        <div class="eyebrow">
          <span class="eyebrow__line" />
          Особисті налаштування
        </div>
        <h1 class="page-title">Мій акаунт</h1>
        <p class="page-subtitle">
          Переглядайте дані профілю та керуйте безпекою входу.
        </p>
      </div>
    </header>

    <div class="account-grid">
      <v-card class="section-card profile-card">
        <div class="profile-cover">
          <div class="profile-cover__pattern" />
        </div>
        <div class="profile-content">
          <v-avatar size="86" color="#d87942" class="account-avatar">
            {{ initials }}
          </v-avatar>
          <h2>{{ auth.user?.name }}</h2>
          <v-chip
            color="#e7f1ed"
            variant="flat"
            size="small"
            class="role-chip"
          >
            <v-icon
              :icon="auth.isAdmin ? 'mdi-shield-crown-outline' : 'mdi-account-tie-outline'"
              start
              size="15"
            />
            {{ roleLabel }}
          </v-chip>

          <div class="profile-details">
            <div class="profile-detail">
              <div class="profile-detail__icon">
                <v-icon icon="mdi-email-outline" size="19" />
              </div>
              <div>
                <span>Email</span>
                <strong>{{ auth.user?.email }}</strong>
              </div>
            </div>
            <div class="profile-detail">
              <div class="profile-detail__icon">
                <v-icon icon="mdi-check-decagram-outline" size="19" />
              </div>
              <div>
                <span>Статус акаунта</span>
                <strong>Активний</strong>
              </div>
            </div>
          </div>
        </div>
      </v-card>

      <v-card class="section-card security-card">
        <div class="security-heading">
          <div class="security-icon">
            <v-icon icon="mdi-shield-key-outline" size="25" />
          </div>
          <div>
            <span>Безпека</span>
            <h2>Змінити пароль</h2>
            <p>
              Спочатку введіть поточний пароль, потім створіть новий.
            </p>
          </div>
        </div>

        <v-divider />

        <v-form
          ref="formRef"
          class="password-form"
          @submit.prevent="changePassword"
        >
          <v-text-field
            v-model="form.currentPassword"
            label="Поточний пароль"
            :type="showCurrentPassword ? 'text' : 'password'"
            autocomplete="current-password"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showCurrentPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :rules="[required, passwordRule]"
            :disabled="saving"
            @click:append-inner="showCurrentPassword = !showCurrentPassword"
          />

          <v-text-field
            v-model="form.newPassword"
            label="Новий пароль"
            :type="showNewPassword ? 'text' : 'password'"
            autocomplete="new-password"
            prepend-inner-icon="mdi-lock-plus-outline"
            :append-inner-icon="showNewPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :rules="[required, passwordRule]"
            :disabled="saving"
            hint="Використовуйте щонайменше 8 символів"
            persistent-hint
            @click:append-inner="showNewPassword = !showNewPassword"
          />

          <div class="strength">
            <div class="strength-bars">
              <span
                v-for="index in 4"
                :key="index"
                :class="{ 'strength-bar--active': index <= passwordScore }"
              />
            </div>
            <small>{{ passwordStrength }}</small>
          </div>

          <v-text-field
            v-model="form.confirmation"
            label="Повторіть новий пароль"
            :type="showNewPassword ? 'text' : 'password'"
            autocomplete="new-password"
            prepend-inner-icon="mdi-lock-check-outline"
            :rules="[required, confirmationRule]"
            :disabled="saving"
          />

          <div class="password-advice">
            <v-icon icon="mdi-information-outline" size="18" />
            <span>
              Не використовуйте пароль від пошти або інших сервісів.
            </span>
          </div>

          <div class="form-actions">
            <v-btn
              type="submit"
              color="primary"
              size="large"
              prepend-icon="mdi-content-save-check-outline"
              :loading="saving"
            >
              Зберегти новий пароль
            </v-btn>
          </div>
        </v-form>
      </v-card>
    </div>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      location="bottom right"
      timeout="4200"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="snackbar = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.account-page {
  max-width: 1180px;
  animation: page-in 0.35s ease-out;
}

.account-header {
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

.account-grid {
  display: grid;
  align-items: start;
  grid-template-columns: minmax(280px, 0.72fr) minmax(440px, 1.28fr);
  gap: 18px;
}

.profile-card {
  overflow: hidden;
}

.profile-cover {
  position: relative;
  height: 112px;
  overflow: hidden;
  background:
    radial-gradient(circle at 80% 15%, rgba(241, 183, 108, 0.32), transparent 36%),
    linear-gradient(135deg, #1d5f59, #172f42);
}

.profile-cover__pattern {
  position: absolute;
  width: 170px;
  height: 170px;
  top: -85px;
  right: -35px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  box-shadow:
    0 0 0 25px rgba(255, 255, 255, 0.035),
    0 0 0 52px rgba(255, 255, 255, 0.025);
}

.profile-content {
  padding: 0 26px 28px;
  text-align: center;
}

.account-avatar {
  margin-top: -43px;
  border: 5px solid #fff;
  color: #fff;
  font-family: Georgia, serif;
  font-size: 25px;
  font-weight: 700;
}

.profile-content h2 {
  margin: 13px 0 8px;
  color: #203342;
  font-family: Georgia, serif;
  font-size: 23px;
}

.role-chip {
  color: #26736a !important;
  font-size: 10px;
  font-weight: 700;
}

.profile-details {
  display: grid;
  gap: 13px;
  margin-top: 27px;
  padding-top: 20px;
  border-top: 1px solid #e8ebe7;
  text-align: left;
}

.profile-detail {
  display: flex;
  align-items: center;
  gap: 11px;
}

.profile-detail__icon {
  display: grid;
  width: 39px;
  height: 39px;
  flex: 0 0 auto;
  border-radius: 12px;
  color: #26736a;
  background: #e9f2ef;
  place-items: center;
}

.profile-detail span,
.profile-detail strong {
  display: block;
}

.profile-detail span {
  color: #939ca2;
  font-size: 9px;
}

.profile-detail strong {
  margin-top: 3px;
  color: #43515c;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.security-card {
  overflow: hidden;
}

.security-heading {
  display: flex;
  gap: 15px;
  padding: 24px 26px 22px;
}

.security-heading > div:last-child {
  min-width: 0;
}

.security-heading > div > span {
  color: #d87942;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.security-heading h2 {
  margin: 3px 0 0;
  color: #203342;
  font-family: Georgia, serif;
  font-size: 22px;
}

.security-heading p {
  margin: 6px 0 0;
  color: #87929a;
  font-size: 11px;
}

.security-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  border-radius: 15px;
  color: #26736a;
  background: #e8f2ee;
  place-items: center;
}

.password-form {
  display: grid;
  gap: 15px;
  padding: 25px 26px 28px;
}

.strength {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: -6px;
}

.strength-bars {
  display: grid;
  max-width: 230px;
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.strength-bars span {
  height: 4px;
  border-radius: 4px;
  background: #e4e7e3;
}

.strength-bars .strength-bar--active {
  background: #3c8b73;
}

.strength small {
  min-width: 105px;
  color: #87929a;
  font-size: 9px;
}

.password-advice {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 14px;
  border-radius: 12px;
  color: #6d775c;
  background: #f5f6ed;
  font-size: 10px;
  line-height: 1.5;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 3px;
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

@media (max-width: 850px) {
  .account-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .profile-content,
  .security-heading,
  .password-form {
    padding-right: 18px;
    padding-left: 18px;
  }

  .form-actions .v-btn {
    width: 100%;
  }

  .strength {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
