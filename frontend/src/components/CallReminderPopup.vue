<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import { useCallRemindersStore } from '@/stores/call-reminders';

const REPEAT_AFTER = 5 * 60_000;
const AUTO_HIDE_AFTER = 15_000;
const CHECK_INTERVAL = 10_000;

const router = useRouter();
const reminders = useCallRemindersStore();
const visible = ref(false);
const nextShowAt = ref(0);
const currentReminder = computed(() => reminders.items[0] ?? null);
const additionalCount = computed(() =>
  Math.max(0, reminders.items.length - 1),
);

let checkTimer: ReturnType<typeof setInterval> | null = null;
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

const clientName = computed(() => {
  const reminder = currentReminder.value;
  if (!reminder) return '';
  return (
    reminder.client.companyName ||
    reminder.client.contactName ||
    `Клієнт #${reminder.clientId}`
  );
});

const isOverdue = computed(() =>
  Boolean(
    currentReminder.value &&
      new Date(currentReminder.value.dueAt).getTime() < Date.now(),
  ),
);

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function clearAutoHide() {
  if (autoHideTimer) clearTimeout(autoHideTimer);
  autoHideTimer = null;
}

function showIfDue() {
  if (
    !currentReminder.value ||
    visible.value ||
    Date.now() < nextShowAt.value
  ) {
    return;
  }
  visible.value = true;
  clearAutoHide();
  autoHideTimer = setTimeout(() => {
    postpone();
  }, AUTO_HIDE_AFTER);
}

function postpone() {
  clearAutoHide();
  visible.value = false;
  nextShowAt.value = Date.now() + REPEAT_AFTER;
}

async function stopReminder() {
  const reminder = currentReminder.value;
  if (!reminder) return;
  clearAutoHide();
  visible.value = false;
  await reminders.markRead(reminder.id);
  nextShowAt.value = 0;
}

async function openClient() {
  const reminder = currentReminder.value;
  if (!reminder) return;
  clearAutoHide();
  visible.value = false;
  try {
    await reminders.markRead(reminder.id);
  } finally {
    await router.push(`/clients/${reminder.clientId}`);
  }
}

watch(
  () => reminders.items.map((item) => item.id).join(','),
  (value, previous) => {
    if (!value) {
      clearAutoHide();
      visible.value = false;
      return;
    }
    if (value !== previous) {
      nextShowAt.value = Date.now();
      showIfDue();
    }
  },
  { immediate: true },
);

onMounted(() => {
  checkTimer = setInterval(showIfDue, CHECK_INTERVAL);
  showIfDue();
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  clearAutoHide();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="call-reminder">
      <v-card
        v-if="visible && currentReminder"
        class="call-reminder-popup"
        :class="{ overdue: isOverdue }"
        role="alert"
        aria-live="assertive"
      >
        <button
          type="button"
          class="call-reminder-popup__close"
          aria-label="Нагадати через 5 хвилин"
          @click="postpone"
        >
          <v-icon icon="mdi-close" size="18" />
        </button>

        <div class="call-reminder-popup__icon">
          <v-icon
            :icon="isOverdue ? 'mdi-phone-alert' : 'mdi-phone-ring'"
            size="28"
          />
        </div>

        <div class="call-reminder-popup__content">
          <span class="call-reminder-popup__label">
            {{
              isOverdue
                ? 'Прострочений запланований дзвінок'
                : 'Нагадування про дзвінок'
            }}
          </span>
          <h3>{{ clientName }}</h3>
          <strong>{{ formatDateTime(currentReminder.dueAt) }}</strong>
          <p v-if="currentReminder.description">
            {{ currentReminder.description }}
          </p>
          <small v-if="additionalCount">
            Ще {{ additionalCount }} нагадувань очікують
          </small>
        </div>

        <div class="call-reminder-popup__actions">
          <v-btn
            v-if="currentReminder.client.phone"
            :href="`tel:${currentReminder.client.phone}`"
            variant="text"
            prepend-icon="mdi-phone"
          >
            Зателефонувати
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-account-arrow-right-outline"
            @click="openClient"
          >
            Відкрити клієнта
          </v-btn>
          <v-btn variant="tonal" @click="postpone">
            Нагадати через 5 хв
          </v-btn>
          <v-btn variant="text" color="grey-darken-1" @click="stopReminder">
            Більше не нагадувати
          </v-btn>
        </div>
      </v-card>
    </Transition>
  </Teleport>
</template>

<style scoped>
.call-reminder-popup {
  position: fixed;
  z-index: 3200;
  top: 20px;
  right: 20px;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  width: min(440px, calc(100vw - 28px));
  padding: 20px;
  overflow: hidden;
  border: 1px solid #f0c8a8;
  border-radius: 18px !important;
  background: #fffaf5 !important;
  box-shadow: 0 20px 55px rgba(46, 36, 25, 0.24) !important;
}

.call-reminder-popup::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  background: #d87942;
  content: '';
}

.call-reminder-popup.overdue {
  border-color: #efb8bc;
  background: #fff8f8 !important;
}

.call-reminder-popup.overdue::before {
  background: #c7555d;
}

.call-reminder-popup__close {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #7b858b;
  cursor: pointer;
}

.call-reminder-popup__close:hover {
  background: rgba(23, 41, 62, 0.07);
}

.call-reminder-popup__icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 15px;
  background: #f7e0cf;
  color: #b8602d;
}

.call-reminder-popup.overdue .call-reminder-popup__icon {
  background: #f6d9dc;
  color: #ac4650;
}

.call-reminder-popup__content {
  min-width: 0;
  padding-right: 18px;
}

.call-reminder-popup__label {
  color: #a45d31;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.call-reminder-popup.overdue .call-reminder-popup__label {
  color: #a7444c;
}

.call-reminder-popup__content h3 {
  margin: 4px 0 2px;
  color: #17293e;
  font-size: 19px;
  line-height: 1.25;
}

.call-reminder-popup__content strong {
  color: #44545f;
  font-size: 13px;
}

.call-reminder-popup__content p {
  margin: 7px 0 0;
  color: #68767f;
  font-size: 12px;
  line-height: 1.45;
}

.call-reminder-popup__content small {
  display: block;
  margin-top: 7px;
  color: #a45d31;
  font-weight: 700;
}

.call-reminder-popup__actions {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.call-reminder-enter-active,
.call-reminder-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.call-reminder-enter-from,
.call-reminder-leave-to {
  opacity: 0;
  transform: translateX(32px) translateY(-8px);
}

@media (max-width: 600px) {
  .call-reminder-popup {
    top: 10px;
    right: 14px;
    left: 14px;
    width: auto;
    padding: 17px;
  }

  .call-reminder-popup__actions .v-btn {
    flex: 1 1 auto;
  }
}
</style>
