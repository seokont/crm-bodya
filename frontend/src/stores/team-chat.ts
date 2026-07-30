import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { teamChatApi } from '@/services/team-chat.api';
import {
  createTeamChatSocket,
  type TeamChatSocket,
  type TeamChatSocketResult,
} from '@/services/team-chat.socket';
import type { TeamChatMessage } from '@/types/team-chat';

const LAST_READ_PREFIX = 'bodya_team_chat_last_read_';

export const useTeamChatStore = defineStore('team-chat', () => {
  const connected = ref(false);
  const connecting = ref(false);
  const unreadCount = ref(0);
  const socketError = ref('');
  const latestMessageId = ref(0);
  const lastCreated = shallowRef<TeamChatMessage | null>(null);
  const lastUpdated = shallowRef<TeamChatMessage | null>(null);
  const lastDeletedId = ref<number | null>(null);

  let socket: TeamChatSocket | null = null;
  let activeUserId: number | null = null;
  let lastReadId = 0;

  function storageKey(userId: number) {
    return `${LAST_READ_PREFIX}${userId}`;
  }

  function persistLastRead() {
    if (!activeUserId) return;
    localStorage.setItem(storageKey(activeUserId), String(lastReadId));
  }

  function isChatVisible() {
    return (
      window.location.pathname === '/chat' &&
      !document.hidden &&
      document.hasFocus()
    );
  }

  function handleCreated(message: TeamChatMessage) {
    latestMessageId.value = Math.max(latestMessageId.value, message.id);
    lastCreated.value = message;

    if (message.authorId === activeUserId || isChatVisible()) {
      markRead(message.id);
      return;
    }

    if (message.id > lastReadId) unreadCount.value += 1;
  }

  async function primeUnread() {
    if (!activeUserId) return;

    const stored = Number(localStorage.getItem(storageKey(activeUserId)));
    lastReadId = Number.isInteger(stored) && stored > 0 ? stored : 0;

    try {
      if (!lastReadId) {
        const response = await teamChatApi.getMessages({ limit: 1 });
        const latest = response.items[response.items.length - 1];
        latestMessageId.value = latest?.id || 0;
        lastReadId = latestMessageId.value;
        unreadCount.value = 0;
        persistLastRead();
        return;
      }

      const response = await teamChatApi.getMessages({
        afterId: lastReadId,
        limit: 100,
      });
      latestMessageId.value = Math.max(
        lastReadId,
        ...response.items.map((message) => message.id),
      );
      unreadCount.value = response.items.filter(
        (message) => message.authorId !== activeUserId,
      ).length;
    } catch {
      // Socket events continue working even if unread priming fails.
    }
  }

  async function connect(userId: number) {
    if (socket && activeUserId === userId) {
      if (!socket.connected) socket.connect();
      return;
    }

    disconnect();
    activeUserId = userId;
    connecting.value = true;
    socketError.value = '';
    await primeUnread();

    socket = createTeamChatSocket();
    socket.on('connect', () => {
      connected.value = true;
      connecting.value = false;
      socketError.value = '';
    });
    socket.on('disconnect', () => {
      connected.value = false;
    });
    socket.on('connect_error', () => {
      connected.value = false;
      connecting.value = false;
      socketError.value = 'Не вдалося підключитися до командного чату';
    });
    socket.on('team-chat:error', ({ message }) => {
      socketError.value = message;
    });
    socket.on('team-chat:message-created', handleCreated);
    socket.on('team-chat:message-updated', (message) => {
      lastUpdated.value = message;
    });
    socket.on('team-chat:message-deleted', ({ id }) => {
      lastDeletedId.value = id;
    });
    socket.connect();
  }

  function disconnect() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    activeUserId = null;
    connected.value = false;
    connecting.value = false;
    unreadCount.value = 0;
    socketError.value = '';
    latestMessageId.value = 0;
    lastCreated.value = null;
    lastUpdated.value = null;
    lastDeletedId.value = null;
    lastReadId = 0;
  }

  function markRead(messageId = latestMessageId.value) {
    lastReadId = Math.max(lastReadId, messageId);
    unreadCount.value = 0;
    persistLastRead();
  }

  async function sendMessage(content: string) {
    const result = await requireSocket()
      .timeout(10_000)
      .emitWithAck('team-chat:send', { content });
    return unwrapResult<TeamChatMessage>(
      result as TeamChatSocketResult<TeamChatMessage>,
    );
  }

  async function updateMessage(id: number, content: string) {
    const result = await requireSocket()
      .timeout(10_000)
      .emitWithAck('team-chat:update', { id, content });
    return unwrapResult<TeamChatMessage>(
      result as TeamChatSocketResult<TeamChatMessage>,
    );
  }

  async function deleteMessage(id: number) {
    const result = await requireSocket()
      .timeout(10_000)
      .emitWithAck('team-chat:delete', { id });
    return unwrapResult<{ id: number }>(
      result as TeamChatSocketResult<{ id: number }>,
    );
  }

  function requireSocket() {
    if (!socket?.connected) {
      throw new Error(
        'Немає з’єднання з чатом. Зачекайте на повторне підключення.',
      );
    }
    return socket;
  }

  function unwrapResult<T>(result: TeamChatSocketResult<T>) {
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }

  return {
    connected,
    connecting,
    unreadCount,
    socketError,
    latestMessageId,
    lastCreated,
    lastUpdated,
    lastDeletedId,
    connect,
    disconnect,
    markRead,
    sendMessage,
    updateMessage,
    deleteMessage,
  };
});
