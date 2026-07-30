import type { UserRole } from './auth';

export interface TeamChatAuthor {
  id: number;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface TeamChatMessage {
  id: number;
  content: string;
  authorId: number | null;
  recipientId: number | null;
  authorName: string;
  author: TeamChatAuthor | null;
  recipient: TeamChatAuthor | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamChatMessagesResponse {
  items: TeamChatMessage[];
  hasMore: boolean;
}

export interface TeamChatMember {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  lastLoginAt: string | null;
}

export interface TeamChatPrivateConversation {
  partner: TeamChatMember;
  latestMessage: TeamChatMessage | null;
}

export interface TeamChatConversationsResponse {
  general: TeamChatMessage | null;
  private: TeamChatPrivateConversation[];
}
