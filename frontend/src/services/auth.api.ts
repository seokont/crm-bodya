import type { AuthUser, LoginResponse } from '@/types/auth';
import type {
  ClientTableColumnKey,
  ClientTablePreferences,
} from '@/types/client';
import { http } from './http';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    return data;
  },

  async profile(): Promise<AuthUser> {
    const { data } = await http.get<AuthUser>('/auth/me');
    return data;
  },

  async getClientTablePreferences(): Promise<ClientTablePreferences> {
    const { data } = await http.get<ClientTablePreferences>(
      '/auth/preferences/client-table',
    );
    return data;
  },

  async updateClientTablePreferences(
    columns: ClientTableColumnKey[],
  ): Promise<ClientTablePreferences> {
    const { data } = await http.patch<ClientTablePreferences>(
      '/auth/preferences/client-table',
      { columns },
    );
    return data;
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const { data } = await http.patch<{ success: true }>('/auth/password', {
      currentPassword,
      newPassword,
    });
    return data;
  },
};
