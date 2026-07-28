import type { AuthUser } from '@/types/auth';

const TOKEN_KEY = 'bodya_crm_access_token';
const USER_KEY = 'bodya_crm_user';

export const getToken = () =>
  typeof window === 'undefined'
    ? null
    : sessionStorage.getItem(TOKEN_KEY);

export function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(USER_KEY);
    return value ? (JSON.parse(value) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeAuthSession(token: string, user: AuthUser) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function storeAuthUser(user: AuthUser) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
