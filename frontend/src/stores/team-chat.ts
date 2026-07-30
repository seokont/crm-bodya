import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { teamChatApi } from '@/services/team-chat.api';
import {
  createTeamChatSocket,
  type TeamChatDeletedMessage,
  type TeamChatSocket,
  type TeamChatSocketResult,
} from '@/services/team-chat.socket';
import type { TeamChatMessage } from '@/types/team-chat';

const LAST_READ_PREFIX = 'bodya_team_chat_last_read_';
const GENERAL_KEY = 'general';

type ReadMap = Record<string, number>;
type UnreadMap = Record<string, boolean>;

export const useTeamChatStore = defineStore('team-chat', () => {
  const connected = ref(false);
  const connecting = ref(false);
  const connectionSequence = ref(0);
  const socketError = ref('');
  const unreadByConversation = ref<UnreadMap>({});
  const latestByConversation = ref<ReadMap>({});
  const activeConversationKey = ref<string | null>(null);
  const lastCreated = shallowRef<TeamChatMessage | null>(null);
  const lastUpdated = shallowRef<TeamChatMessage | null>(null);
  const lastDeleted = shallowRef<TeamChatDeletedMessage | null>(null);

  let socket: TeamChatSocket | null = null;
  let activeUserId: number | null = null;
  let readByConversation: ReadMap = {};

  const unreadCount = computed(
    () =>
      Object.values(unreadByConversation.value).filter(Boolean).length,
  );

  const firstUnreadTarget = computed(() => {
    const key = Object.keys(unreadByConversation.value).find(
      (item) => unreadByConversation.value[item],
    );
    if (!key) return null;
    return {
      partnerId: key === GENERAL_KEY ? null : Number(key.replace('private:', '')),
    };
  });

  function conversationKey(partnerId: number | null) {
    return partnerId === null ? GENERAL_KEY : `private:${partnerId}`;
  }

  function partnerIdForMessage(message: {
    authorId: number | null;
    recipientId: number | null;
  }) {
    if (message.recipientId === null) return null;
    return message.authorId === activeUserId
      ? message.recipientId
      : message.authorId;
  }

  function messageConversationKey(message: {
    authorId: number | null;
    recipientId: number | null;
  }) {
    return conversationKey(partnerIdForMessage(message));
  }

  function storageKey(userId: number) {
    return `${LAST_READ_PREFIX}${userId}`;
  }

  function persistReadMap() {
    if (!activeUserId) return;
    localStorage.setItem(
      storageKey(activeUserId),
      JSON.stringify(readByConversation),
    );
  }

  function readStoredMap(userId: number) {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { exists: false, value: {} as ReadMap };

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return { exists: true, value: parsed as ReadMap };
      }
    } catch {
      const legacyGeneralId = Number(raw);
      if (Number.isInteger(legacyGeneralId) && legacyGeneralId > 0) {
        return {
          exists: true,
          value: { [GENERAL_KEY]: legacyGeneralId },
        };
      }
    }

    return { exists: true, value: {} as ReadMap };
  }

  function isConversationVisible(key: string) {
    return (
      activeConversationKey.value === key &&
      window.location.pathname === '/chat' &&
      !document.hidden &&
      document.hasFocus()
    );
  }

  function markConversationRead(
    partnerId: number | null,
    messageId = latestByConversation.value[conversationKey(partnerId)] || 0,
  ) {
    const key = conversationKey(partnerId);
    readByConversation[key] = Math.max(
      readByConversation[key] || 0,
      messageId,
    );
    unreadByConversation.value = {
      ...unreadByConversation.value,
      [key]: false,
    };
    persistReadMap();
  }

  function setActiveConversation(partnerId: number | null) {
    activeConversationKey.value = conversationKey(partnerId);
    markConversationRead(partnerId);
  }

  function clearActiveConversation() {
    activeConversationKey.value = null;
  }

  function isConversationUnread(partnerId: number | null) {
    return Boolean(
      unreadByConversation.value[conversationKey(partnerId)],
    );
  }

  function handleCreated(message: TeamChatMessage) {
    const partnerId = partnerIdForMessage(message);
    const key = conversationKey(partnerId);
    latestByConversation.value = {
      ...latestByConversation.value,
      [key]: Math.max(latestByConversation.value[key] || 0, message.id),
    };
    lastCreated.value = message;

    if (message.authorId === activeUserId || isConversationVisible(key)) {
      markConversationRead(partnerId, message.id);
      return;
    }

    if (message.id > (readByConversation[key] || 0)) {
      unreadByConversation.value = {
        ...unreadByConversation.value,
        [key]: true,
      };
    }
  }

  async function primeUnread() {
    if (!activeUserId) return;

    const stored = readStoredMap(activeUserId);
    readByConversation = stored.value;

    try {
      const conversations = await teamChatApi.getConversations();
      const newest = [
        { partnerId: null, message: conversations.general },
        ...conversations.private.map((conversation) => ({
          partnerId: conversation.partner.id,
          message: conversation.latestMessage,
        })),
      ];
      const latest: ReadMap = {};
      const unread: UnreadMap = {};

      for (const conversation of newest) {
        const key = conversationKey(conversation.partnerId);
        const message = conversation.message;
        latest[key] = message?.id || 0;

        if (!stored.exists) {
          readByConversation[key] = message?.id || 0;
          unread[key] = false;
        } else {
          unread[key] = Boolean(
            message &&
              message.authorId !== activeUserId &&
              message.id > (readByConversation[key] || 0),
          );
        }
      }

      latestByConversation.value = latest;
      unreadByConversation.value = unread;
      if (!stored.exists) persistReadMap();
    } catch {
      // Події Socket.IO продовжать працювати, навіть якщо початковий запит не вдався.
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
      connected.value = false;
      connecting.value = true;
      socketError.value = '';
    });
    socket.on('team-chat:ready', () => {
      connected.value = true;
      connecting.value = false;
      socketError.value = '';
      const isReconnect = connectionSequence.value > 0;
      connectionSequence.value += 1;
      if (isReconnect) void primeUnread();
    });
    socket.on('disconnect', () => {
      connected.value = false;
    });
    socket.on('connect_error', () => {
      connected.value = false;
      connecting.value = false;
      socketError.value =
        'Не вдалося підключитися до командного чату';
    });
    socket.on('team-chat:error', ({ message }) => {
      socketError.value = message;
    });
    socket.on('team-chat:message-created', handleCreated);
    socket.on('team-chat:message-updated', (message) => {
      lastUpdated.value = message;
    });
    socket.on('team-chat:message-deleted', (payload) => {
      lastDeleted.value = payload;
      void primeUnread();
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
    connectionSequence.value = 0;
    socketError.value = '';
    unreadByConversation.value = {};
    latestByConversation.value = {};
    activeConversationKey.value = null;
    lastCreated.value = null;
    lastUpdated.value = null;
    lastDeleted.value = null;
    readByConversation = {};
  }

  async function sendMessage(content: string, recipientId?: number) {
    const result = await requireSocket()
      .timeout(10_000)
      .emitWithAck('team-chat:send', { content, recipientId });
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
    return unwrapResult<TeamChatDeletedMessage>(
      result as TeamChatSocketResult<TeamChatDeletedMessage>,
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
    connectionSequence,
    socketError,
    unreadCount,
    unreadByConversation,
    firstUnreadTarget,
    lastCreated,
    lastUpdated,
    lastDeleted,
    connect,
    disconnect,
    setActiveConversation,
    clearActiveConversation,
    markConversationRead,
    isConversationUnread,
    messageConversationKey,
    sendMessage,
    updateMessage,
    deleteMessage,
  };
});
