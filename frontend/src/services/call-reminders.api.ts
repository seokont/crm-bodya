import { http } from './http';
import type { CallRemindersResponse } from '@/types/call-reminder';

export const callRemindersApi = {
  async getDue(): Promise<CallRemindersResponse> {
    const { data } = await http.get<CallRemindersResponse>('/call-reminders');
    return data;
  },

  async markRead(taskId: number): Promise<void> {
    await http.patch(`/call-reminders/${taskId}/read`);
  },

  async markAllRead(): Promise<void> {
    await http.patch('/call-reminders/read-all');
  },
};
