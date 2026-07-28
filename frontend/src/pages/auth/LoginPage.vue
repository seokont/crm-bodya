<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

interface FormRef {
  validate: () => Promise<{ valid: boolean }>;
}

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const formRef = ref<FormRef | null>(null);
const email = ref('');
const password = ref('');
const showPassword = ref(false);

const required = (value: string) =>
  Boolean(value?.trim()) || "Обов'язкове поле";
const emailRule = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Вкажіть коректний email';

async function submit() {
  const result = await formRef.value?.validate();
  if (!result?.valid) return;

  try {
    await auth.login(email.value, password.value);
    const redirect =
      typeof route.query.redirect === 'string' &&
      route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/overview';
    await router.replace(redirect);
  } catch {
    // Store error is rendered in the form.
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-decoration login-decoration--top" />
    <div class="login-decoration login-decoration--bottom" />

    <section class="login-brand-panel">
      <div class="login-brand">
        <div class="login-brand__mark">B</div>
        <div>
          <div class="login-brand__name">Bodya</div>
          <div class="login-brand__caption">CRM-простір</div>
        </div>
      </div>

      <div class="brand-message">
        <div class="brand-message__eyebrow">Ваш робочий день</div>
        <h1>Клієнти ближче.<br />Робота простіша.</h1>
        <p>
          Єдиний простір для контактів, статусів і щоденної роботи команди.
        </p>
      </div>

      <div class="brand-footer">
        <v-icon icon="mdi-shield-check-outline" size="18" />
        Захищений доступ для вашої команди
      </div>
    </section>

    <section class="login-form-panel">
      <v-card class="login-card">
        <div class="mobile-brand">
          <div class="login-brand__mark">B</div>
          <div class="login-brand__name">Bodya</div>
        </div>

        <div class="form-heading">
          <div class="form-heading__icon">
            <v-icon icon="mdi-login-variant" size="22" />
          </div>
          <h2>Вхід до CRM</h2>
          <p>Використайте облікові дані, надані адміністратором.</p>
        </div>

        <v-alert
          v-if="auth.error"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-5"
        >
          {{ auth.error }}
        </v-alert>

        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            autocomplete="username"
            prepend-inner-icon="mdi-email-outline"
            :rules="[required, emailRule]"
            class="mb-3"
          />
          <v-text-field
            v-model="password"
            label="Пароль"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :rules="[required]"
            @click:append-inner="showPassword = !showPassword"
          />

          <v-btn
            type="submit"
            color="primary"
            size="large"
            block
            :loading="auth.loading"
            class="login-button"
          >
            Увійти
            <v-icon icon="mdi-arrow-right" end />
          </v-btn>
        </v-form>

        <div class="access-note">
          <v-icon icon="mdi-information-outline" size="17" />
          Облікові записи менеджерів створює адміністратор CRM.
        </div>
      </v-card>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  overflow: hidden;
  grid-template-columns: minmax(390px, 0.9fr) 1.1fr;
  background: #f4f5f2;
}

.login-decoration {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.login-decoration--top {
  top: -160px;
  right: -110px;
  width: 390px;
  height: 390px;
  border: 1px solid rgba(38, 115, 106, 0.12);
}

.login-decoration--bottom {
  right: 20%;
  bottom: -220px;
  width: 420px;
  height: 420px;
  background: rgba(241, 183, 108, 0.08);
}

.login-brand-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  padding: 42px 54px;
  color: #fff;
  background:
    radial-gradient(circle at 15% 88%, rgba(241, 183, 108, 0.2), transparent 26rem),
    #17293e;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 13px;
}

.login-brand__mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  color: #17293e;
  background: #f1b76c;
  font-family: Georgia, serif;
  font-size: 25px;
  font-weight: 800;
  transform: rotate(-4deg);
}

.login-brand__name {
  font-family: Georgia, serif;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.login-brand__caption {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.46);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.brand-message__eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 17px;
  color: #f1b76c;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.brand-message__eyebrow::before {
  width: 25px;
  height: 1px;
  content: "";
  background: #f1b76c;
}

.brand-message h1 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: clamp(40px, 4.3vw, 64px);
  line-height: 1.08;
  letter-spacing: -0.045em;
}

.brand-message p {
  max-width: 440px;
  margin: 22px 0 0;
  color: rgba(255, 255, 255, 0.58);
  font-size: 14px;
  line-height: 1.7;
}

.brand-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
}

.login-form-panel {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 40px;
}

.login-card {
  width: 100%;
  max-width: 440px;
  padding: 38px;
  border: 1px solid #e1e5df;
  box-shadow: 0 24px 70px rgba(27, 42, 55, 0.09) !important;
}

.mobile-brand {
  display: none;
}

.form-heading {
  margin-bottom: 29px;
}

.form-heading__icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin-bottom: 17px;
  border-radius: 14px;
  color: #26736a;
  background: #e8f2ee;
}

.form-heading h2 {
  margin: 0;
  color: #17293e;
  font-family: Georgia, serif;
  font-size: 30px;
  letter-spacing: -0.03em;
}

.form-heading p {
  margin: 9px 0 0;
  color: #7f8a93;
  font-size: 13px;
  line-height: 1.55;
}

.login-button {
  height: 49px !important;
  margin-top: 17px;
}

.access-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #edf0eb;
  color: #89939a;
  font-size: 11px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .login-page {
    display: block;
  }

  .login-brand-panel {
    display: none;
  }

  .login-form-panel {
    min-height: 100vh;
    padding: 24px;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 35px;
    color: #17293e;
  }
}

@media (max-width: 500px) {
  .login-form-panel {
    padding: 14px;
  }

  .login-card {
    padding: 27px 22px;
  }
}
</style>
