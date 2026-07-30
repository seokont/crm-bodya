import type {
  TeamChatMember,
  TeamChatMessage,
  TeamChatMessagesResponse,
} from '@/types/team-chat';
import { http } from './http';

export const teamChatApi = {
  async getMessages(params?: {
    afterId?: number;
    beforeId?: number;
    limit?: number;
  }): Promise<TeamChatMessagesResponse> {
    const { data } = await http.get<TeamChatMessagesResponse>(
      '/team-chat/messages',
      { params },
    );
    return data;
  },

  async getMembers(): Promise<TeamChatMember[]> {
    const { data } = await http.get<TeamChatMember[]>('/team-chat/members');
    return data;
  },

  async createMessage(content: string): Promise<TeamChatMessage> {
    const { data } = await http.post<TeamChatMessage>('/team-chat/messages', {
      content,
    });
    return data;
  },

  async updateMessage(
    id: number,
    content: string,
  ): Promise<TeamChatMessage> {
    const { data } = await http.patch<TeamChatMessage>(
      `/team-chat/messages/${id}`,
      { content },
    );
    return data;
  },

  async removeMessage(id: number): Promise<void> {
    await http.delete(`/team-chat/messages/${id}`);
  },
};
