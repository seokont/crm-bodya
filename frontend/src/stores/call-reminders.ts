import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { callRemindersApi } from '@/services/call-reminders.api';
import type { CallReminder } from '@/types/call-reminder';

const POLL_INTERVAL = 30_000;

export const useCallRemindersStore = defineStore('call-reminders', () => {
  const items = ref<CallReminder[]>([]);
  const loading = ref(false);
  const unreadCount = computed(() => items.value.length);

  let timer: ReturnType<typeof setInterval> | null = null;
  let activeUserId: number | null = null;

  async function refresh() {
    if (!activeUserId || loading.value) return;
    loading.value = true;
    try {
      const response = await callRemindersApi.getDue();
      items.value = response.items;
    } catch {
      // Наступне опитування повторить спробу.
    } finally {
      loading.value = false;
    }
  }

  function start(userId: number) {
    if (activeUserId === userId && timer) return;
    stop();
    activeUserId = userId;
    void refresh();
    timer = setInterval(() => void refresh(), POLL_INTERVAL);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function stop() {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    timer = null;
    activeUserId = null;
    items.value = [];
    loading.value = false;
  }

  function handleVisibilityChange() {
    if (!document.hidden) void refresh();
  }

  async function markRead(taskId: number) {
    await callRemindersApi.markRead(taskId);
    items.value = items.value.filter((item) => item.id !== taskId);
  }

  async function markAllRead() {
    await callRemindersApi.markAllRead();
    items.value = [];
  }

  return {
    items,
    loading,
    unreadCount,
    refresh,
    start,
    stop,
    markRead,
    markAllRead,
  };
});
