import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi } from '@/services/auth.api';
import {
  clearAuthSession,
  getToken,
  readStoredUser,
  storeAuthSession,
  storeAuthUser,
} from '@/services/auth-session';
import { getApiError } from '@/services/http';
import type { AuthUser } from '@/types/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(readStoredUser());
  const initialized = ref(false);
  const loading = ref(false);
  const error = ref('');

  const isAuthenticated = computed(() => Boolean(user.value && getToken()));
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  async function initialize() {
    if (initialized.value) return;
    const token = getToken();
    if (!token) {
      clearSession();
      initialized.value = true;
      return;
    }

    try {
      user.value = await authApi.profile();
      storeAuthUser(user.value);
    } catch {
      clearSession();
    } finally {
      initialized.value = true;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    error.value = '';
    try {
      const response = await authApi.login(email, password);
      storeAuthSession(response.accessToken, response.user);
      user.value = response.user;
      initialized.value = true;
      return response.user;
    } catch (requestError) {
      error.value = getApiError(requestError);
      throw requestError;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    clearSession();
    window.location.assign('/login');
  }

  function clearSession() {
    clearAuthSession();
    user.value = null;
  }

  return {
    user,
    initialized,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    initialize,
    login,
    logout,
  };
});
