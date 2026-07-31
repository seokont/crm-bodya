<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useDisplay } from "vuetify";
import CallReminderPopup from "@/components/CallReminderPopup.vue";
import NotificationBell from "@/components/NotificationBell.vue";
import { backupsApi } from "@/services/backups.api";
import { getApiError } from "@/services/http";
import { useAuthStore } from "@/stores/auth";
import { useCallRemindersStore } from "@/stores/call-reminders";
import { useTeamChatStore } from "@/stores/team-chat";

const { mdAndUp } = useDisplay();
const route = useRoute();
const auth = useAuthStore();
const callReminders = useCallRemindersStore();
const teamChat = useTeamChatStore();
const mobileMenu = ref(false);
const largeText = ref(localStorage.getItem("bodya-large-text") === "true");
const backupLoading = ref(false);
const snackbar = ref(false);
const snackbarMessage = ref("");
const snackbarColor = ref("success");

const navigation = computed(() => [
  { title: "Огляд", icon: "mdi-view-dashboard-outline", to: "/overview" },
  { title: "Клієнти", icon: "mdi-account-group-outline", to: "/clients" },
  { title: "Угоди", icon: "mdi-handshake-outline", to: "/deals" },
  {
    title: "Завдання",
    icon: "mdi-checkbox-marked-circle-outline",
    to: "/tasks",
  },
  { title: "Аналітика", icon: "mdi-chart-box-outline", to: "/analytics" },
  { title: "Командний чат", icon: "mdi-forum-outline", to: "/chat" },
  ...(auth.isAdmin
    ? [{ title: "Менеджери", icon: "mdi-account-tie-outline", to: "/team" }]
    : []),
  { title: "Мій акаунт", icon: "mdi-account-circle-outline", to: "/account" },
]);

const initials = computed(() =>
  (auth.user?.name || "CRM")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);

const roleLabel = computed(() =>
  auth.user?.role === "ADMIN" ? "Адміністратор" : "Менеджер",
);

const fontButtonLabel = computed(() =>
  largeText.value ? "Звичайний шрифт" : "Збільшити шрифт",
);
function toggleLargeText() {
  largeText.value = !largeText.value;
}

async function downloadBackup() {
  backupLoading.value = true;
  try {
    await backupsApi.downloadDatabase();
    snackbarMessage.value = "Резервну копію бази даних завантажено";
    snackbarColor.value = "success";
  } catch (error) {
    snackbarMessage.value = getApiError(error);
    snackbarColor.value = "error";
  } finally {
    backupLoading.value = false;
    snackbar.value = true;
  }
}

watch(
  largeText,
  (enabled) => {
    document.documentElement.classList.toggle("large-text", enabled);
    localStorage.setItem("bodya-large-text", String(enabled));
  },
  { immediate: true },
);

watch(
  () => auth.user?.id,
  (userId) => {
    if (userId) {
      void teamChat.connect(userId);
      callReminders.start(userId);
    } else {
      teamChat.disconnect();
      callReminders.stop();
    }
  },
  { immediate: true },
);

</script>

<template>
  <v-app>
    <CallReminderPopup v-if="!route.meta.public" />
    <v-btn
      v-if="route.meta.public"
      class="login-font-button"
      icon="mdi-format-size"
      variant="tonal"
      :aria-label="fontButtonLabel"
      :aria-pressed="largeText"
      @click="toggleLargeText"
    />
    <router-view v-if="route.meta.public" />
    <template v-else>
      <v-navigation-drawer
        v-if="mdAndUp"
        permanent
        width="248"
        color="#17293e"
        class="app-sidebar"
      >
        <div class="brand">
          <div class="brand__mark">B</div>
          <div>
            <div class="brand__name">Bodya</div>
            <div class="brand__caption">CRM-простір</div>
          </div>
          <div class="ml-auto">
            <NotificationBell />
          </div>
        </div>

        <div class="sidebar-label">Робочий простір</div>
        <v-list nav class="px-3">
          <v-list-item
            v-for="item in navigation"
            :key="item.title"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            rounded="lg"
            color="white"
            class="mb-1 sidebar-item"
          />
        </v-list>

        <template #append>
          <div class="sidebar-tools">
            <v-btn
              block
              variant="text"
              prepend-icon="mdi-format-size"
              :aria-pressed="largeText"
              @click="toggleLargeText"
            >
              {{ fontButtonLabel }}
            </v-btn>
            <v-btn
              v-if="auth.isAdmin"
              block
              variant="tonal"
              prepend-icon="mdi-database-arrow-down-outline"
              :loading="backupLoading"
              @click="downloadBackup"
            >
              Резервна копія
            </v-btn>
          </div>
          <div class="profile">
            <v-avatar size="38" color="#d87942">{{ initials }}</v-avatar>
            <div class="profile__copy">
              <div class="text-body-2 font-weight-bold">
                {{ auth.user?.name }}
              </div>
              <div class="text-caption">{{ roleLabel }}</div>
            </div>
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon="mdi-dots-horizontal"
                  variant="text"
                  size="small"
                  aria-label="Меню користувача"
                />
              </template>
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-account-circle-outline"
                  title="Мій акаунт"
                  to="/account"
                />
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-logout"
                  title="Вийти"
                  @click="auth.logout"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-navigation-drawer>

      <v-app-bar
        v-if="!mdAndUp"
        flat
        height="64"
        color="#17293e"
        class="mobile-bar"
      >
        <v-app-bar-nav-icon
          aria-label="Відкрити навігацію"
          @click="mobileMenu = true"
        />
        <div class="brand brand--mobile">
          <div class="brand__mark">B</div>
          <div class="brand__name">Bodya</div>
        </div>
        <v-spacer />
        <NotificationBell />
        <v-btn
          icon="mdi-format-size"
          variant="text"
          :aria-label="fontButtonLabel"
          :aria-pressed="largeText"
          @click="toggleLargeText"
        />
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-avatar v-bind="menuProps" size="34" color="#d87942">
              {{ initials }}
            </v-avatar>
          </template>
          <v-list density="compact">
            <v-list-item :title="auth.user?.name" :subtitle="roleLabel" />
            <v-divider />
            <v-list-item
              prepend-icon="mdi-account-circle-outline"
              title="Мій акаунт"
              to="/account"
            />
            <v-list-item
              prepend-icon="mdi-logout"
              title="Вийти"
              @click="auth.logout"
            />
          </v-list>
        </v-menu>
      </v-app-bar>

      <v-navigation-drawer
        v-model="mobileMenu"
        temporary
        color="#17293e"
        width="280"
      >
        <div class="brand">
          <div class="brand__mark">B</div>
          <div>
            <div class="brand__name">Bodya</div>
            <div class="brand__caption">CRM-простір</div>
          </div>
        </div>
        <v-list nav class="px-3">
          <v-list-item
            v-for="item in navigation"
            :key="item.title"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            rounded="lg"
            color="white"
            @click="mobileMenu = false"
          />
        </v-list>
        <div class="sidebar-tools sidebar-tools--mobile">
          <v-btn
            block
            variant="text"
            prepend-icon="mdi-format-size"
            :aria-pressed="largeText"
            @click="toggleLargeText"
          >
            {{ fontButtonLabel }}
          </v-btn>
          <v-btn
            v-if="auth.isAdmin"
            block
            variant="tonal"
            prepend-icon="mdi-database-arrow-down-outline"
            :loading="backupLoading"
            @click="downloadBackup"
          >
            Завантажити базу
          </v-btn>
        </div>
      </v-navigation-drawer>

      <v-main>
        <router-view />
      </v-main>
    </template>
    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      location="bottom right"
      timeout="4200"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="snackbar = false" />
      </template>
    </v-snackbar>
  </v-app>
</template>
