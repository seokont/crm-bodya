import type {
  CreateManagerPayload,
  ManagedUser,
  UpdateManagerPayload,
} from '@/types/auth';
import { http } from './http';

export const managersApi = {
  async getAll(): Promise<ManagedUser[]> {
    const { data } = await http.get<ManagedUser[]>('/managers/admin');
    return data;
  },

  async create(payload: CreateManagerPayload): Promise<ManagedUser> {
    const { data } = await http.post<ManagedUser>('/managers', payload);
    return data;
  },

  async update(
    id: number,
    payload: UpdateManagerPayload,
  ): Promise<ManagedUser> {
    const { data } = await http.patch<ManagedUser>(
      `/managers/${id}`,
      payload,
    );
    return data;
  },

  async resetPassword(id: number, password: string): Promise<void> {
    await http.patch(`/managers/${id}/password`, { password });
  },

  async remove(
    id: number,
  ): Promise<{ success: true; unassignedClients: number }> {
    const { data } = await http.delete<{
      success: true;
      unassignedClients: number;
    }>(`/managers/${id}`);
    return data;
  },
};
