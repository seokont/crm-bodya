<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTeamChatStore } from '@/stores/team-chat';

const router = useRouter();
const teamChat = useTeamChatStore();

const ariaLabel = computed(() =>
  teamChat.unreadCount
    ? `Нові повідомлення в чаті: ${teamChat.unreadCount}`
    : 'Відкрити командний чат',
);

function openTeamChat() {
  const target = teamChat.firstUnreadTarget;
  void router.push(
    target?.partnerId
      ? { path: '/chat', query: { partner: String(target.partnerId) } }
      : '/chat',
  );
}
</script>

<template>
  <v-btn
    class="chat-notification-button"
    :class="{ 'has-unread': teamChat.unreadCount > 0 }"
    icon
    variant="text"
    :aria-label="ariaLabel"
    @click="openTeamChat"
  >
    <v-icon icon="mdi-bell-outline" />
    <span v-if="teamChat.unreadCount" class="chat-notification-dot" />
  </v-btn>
</template>
