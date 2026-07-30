import type {
  TeamChatConversationsResponse,
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
    partnerId?: number;
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

  async getConversations(): Promise<TeamChatConversationsResponse> {
    const { data } = await http.get<TeamChatConversationsResponse>(
      '/team-chat/conversations',
    );
    return data;
  },

  async createMessage(
    content: string,
    recipientId?: number,
  ): Promise<TeamChatMessage> {
    const { data } = await http.post<TeamChatMessage>('/team-chat/messages', {
      content,
      recipientId,
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
