<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  type Client,
  type DuplicateClient,
  type ClientPayload,
  type ClientStatus,
  type ClientType,
  type Manager,
} from '@/types/client';

const props = defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit';
  client?: Client | null;
  managers: Manager[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: ClientPayload];
}>();

interface FormState {
  type: ClientType;
  companyName: string;
  contactName: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  edrpou: string;
  city: string;
  address: string;
  website: string;
  status: ClientStatus;
  source: string;
  managerId: number | null;
  comment: string;
}

interface FormRef {
  validate: () => Promise<{ valid: boolean }>;
}

const formRef = ref<FormRef | null>(null);
const form = reactive<FormState>(emptyForm());
const duplicates = ref<DuplicateClient[]>([]);
const duplicateLoading = ref(false);
const duplicateError = ref('');
const duplicateConfirm = ref(false);
const pendingPayload = ref<ClientPayload | null>(null);
let duplicateTimer: ReturnType<typeof setTimeout> | undefined;
let duplicateRequestId = 0;

const statusLabels = Object.fromEntries(
  CLIENT_STATUSES.map((item) => [item.value, item.title]),
) as Record<ClientStatus, string>;

const duplicateCompanyName = computed(() =>
  form.type === 'PERSON' ? '' : form.companyName,
);
const hasDuplicateInput = computed(
  () => Boolean(duplicateCompanyName.value.trim() || form.edrpou.trim()),
);

const required = (value: string | null) => Boolean(value?.trim()) || "Обов'язкове поле";
const emailRule = (value: string) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Перевірте email';

function emptyForm(): FormState {
  return {
    type: 'COMPANY',
    companyName: '',
    contactName: '',
    phone: '',
    secondaryPhone: '',
    email: '',
    edrpou: '',
    city: '',
    address: '',
    website: '',
    status: 'NEW',
    source: '',
    managerId: null,
    comment: '',
  };
}

function fillForm(client?: Client | null) {
  Object.assign(
    form,
    client
      ? {
          type: client.type,
          companyName: client.companyName ?? '',
          contactName: client.contactName ?? '',
          phone: client.phone ?? '',
          secondaryPhone: client.secondaryPhone ?? '',
          email: client.email ?? '',
          edrpou: client.edrpou ?? '',
          city: client.city ?? '',
          address: client.address ?? '',
          website: client.website ?? '',
          status: client.status,
          source: client.source ?? '',
          managerId: client.managerId,
          comment: client.comment ?? '',
        }
      : emptyForm(),
  );
}

function resetDuplicateState() {
  duplicateRequestId += 1;
  duplicates.value = [];
  duplicateError.value = '';
  duplicateLoading.value = false;
  duplicateConfirm.value = false;
  pendingPayload.value = null;
}

async function checkDuplicates() {
  if (
    props.mode !== 'create' ||
    !props.modelValue ||
    !hasDuplicateInput.value
  ) {
    resetDuplicateState();
    return true;
  }

  const requestId = ++duplicateRequestId;
  duplicateLoading.value = true;
  duplicateError.value = '';

  try {
    const response = await clientsApi.findDuplicates(
      duplicateCompanyName.value,
      form.edrpou,
    );
    if (requestId !== duplicateRequestId) return false;
    duplicates.value = response.duplicates;
    return true;
  } catch (error) {
    if (requestId !== duplicateRequestId) return false;
    duplicates.value = [];
    duplicateError.value = getApiError(error);
    return false;
  } finally {
    if (requestId === duplicateRequestId) {
      duplicateLoading.value = false;
    }
  }
}

function duplicateName(client: DuplicateClient) {
  return client.companyName || client.contactName || `Клієнт #${client.id}`;
}

function duplicateMatch(client: DuplicateClient) {
  if (client.matchedBy.length === 2) return 'назва та ЄДРПОУ';
  return client.matchedBy[0] === 'EDRPOU' ? 'ЄДРПОУ' : 'назва компанії';
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) fillForm(props.client);
    else resetDuplicateState();
  },
);

watch(
  () => props.client,
  (client) => {
    if (props.modelValue) fillForm(client);
  },
);

function buildPayload(): ClientPayload {
  const clean = (value: string) => value.trim() || undefined;
  return {
    type: form.type,
    companyName: clean(form.companyName),
    contactName: clean(form.contactName),
    phone: clean(form.phone),
    secondaryPhone: clean(form.secondaryPhone),
    email: clean(form.email),
    edrpou: clean(form.edrpou),
    city: clean(form.city),
    address: clean(form.address),
    website: clean(form.website),
    status: form.status,
    source: clean(form.source),
    managerId: form.managerId || undefined,
    comment: clean(form.comment),
  };
}

async function submit() {
  const result = await formRef.value?.validate();
  if (!result?.valid) return;

  const payload = buildPayload();
  if (props.mode === 'create') {
    const checked = await checkDuplicates();
    if (!checked) return;
    if (duplicates.value.length) {
      pendingPayload.value = payload;
      duplicateConfirm.value = true;
      return;
    }
  }

  emit('save', payload);
}

function confirmDuplicate() {
  if (!pendingPayload.value) return;
  duplicateConfirm.value = false;
  emit('save', pendingPayload.value);
  pendingPayload.value = null;
}

watch(
  [
    () => form.companyName,
    () => form.edrpou,
    () => form.type,
    () => props.mode,
    () => props.modelValue,
  ],
  () => {
    if (duplicateTimer) clearTimeout(duplicateTimer);
    duplicateConfirm.value = false;
    pendingPayload.value = null;
    duplicateError.value = '';

    if (
      props.mode !== 'create' ||
      !props.modelValue ||
      !hasDuplicateInput.value
    ) {
      resetDuplicateState();
      return;
    }

    duplicateTimer = setTimeout(() => {
      void checkDuplicates();
    }, 450);
  },
);

onBeforeUnmount(() => {
  if (duplicateTimer) clearTimeout(duplicateTimer);
});
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="820"
    persistent
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="client-dialog">
      <v-card-title class="dialog-header">
        <div class="dialog-header__icon">
          <v-icon
            :icon="mode === 'create' ? 'mdi-account-plus-outline' : 'mdi-account-edit-outline'"
            size="22"
          />
        </div>
        <div>
          <div class="dialog-title">
            {{ mode === 'create' ? 'Новий клієнт' : 'Редагування клієнта' }}
          </div>
          <div class="dialog-subtitle">
            {{
              mode === 'create'
                ? 'Додайте контакт і призначте відповідального'
                : 'Оновіть інформацію в картці'
            }}
          </div>
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрити"
          :disabled="loading"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-divider />

      <v-card-text class="dialog-body">
        <v-form ref="formRef" @submit.prevent="submit">
          <section class="form-section">
            <div class="section-heading">
              <span class="section-number">01</span>
              <div>
                <h3>Основна інформація</h3>
                <p>Хто ваш клієнт і як із ним зв'язатися</p>
              </div>
            </div>

            <v-btn-toggle
              v-model="form.type"
              mandatory
              color="primary"
              variant="outlined"
              divided
              class="type-toggle"
            >
              <v-btn
                v-for="type in CLIENT_TYPES"
                :key="type.value"
                :value="type.value"
              >
                {{ type.title }}
              </v-btn>
            </v-btn-toggle>

            <div
              v-if="mode === 'create' && (duplicateLoading || duplicateError || duplicates.length)"
              class="duplicate-notice"
              :class="{ 'duplicate-notice--error': duplicateError }"
              role="status"
            >
              <div class="duplicate-notice__icon">
                <v-progress-circular
                  v-if="duplicateLoading"
                  indeterminate
                  size="21"
                  width="2"
                  color="warning"
                />
                <v-icon
                  v-else
                  :icon="duplicateError ? 'mdi-alert-circle-outline' : 'mdi-alert-outline'"
                  size="22"
                />
              </div>
              <div v-if="duplicateLoading">
                <strong>Перевіряємо можливі дублікати…</strong>
                <span>Порівнюємо назву компанії та ЄДРПОУ.</span>
              </div>
              <div v-else-if="duplicateError">
                <strong>Не вдалося перевірити дублікати</strong>
                <span>{{ duplicateError }}</span>
              </div>
              <div v-else>
                <strong>
                  Знайдено можливих дублікатів: {{ duplicates.length }}
                </strong>
                <span>
                  Перевірте збіги перед створенням нового запису.
                </span>
                <div class="duplicate-list">
                  <div
                    v-for="client in duplicates.slice(0, 3)"
                    :key="client.id"
                    class="duplicate-list__item"
                  >
                    <div>
                      <b>{{ duplicateName(client) }}</b>
                      <small>
                        Збіг: {{ duplicateMatch(client) }}
                        <template v-if="client.manager">
                          · {{ client.manager.name }}
                        </template>
                      </small>
                    </div>
                    <v-chip size="x-small" variant="flat">
                      {{ client.isArchived ? 'В архіві' : statusLabels[client.status] }}
                    </v-chip>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-grid">
              <v-text-field
                v-if="form.type !== 'PERSON'"
                v-model="form.companyName"
                label="Назва компанії *"
                :rules="[required]"
                prepend-inner-icon="mdi-domain"
              />
              <v-text-field
                v-model="form.contactName"
                :label="form.type === 'PERSON' ? 'ПІБ *' : 'Контактна особа'"
                :rules="form.type === 'PERSON' ? [required] : []"
                prepend-inner-icon="mdi-account-outline"
              />
              <v-text-field
                v-model="form.phone"
                label="Телефон"
                prepend-inner-icon="mdi-phone-outline"
                placeholder="+380"
              />
              <v-text-field
                v-model="form.secondaryPhone"
                label="Додатковий телефон"
                prepend-inner-icon="mdi-phone-plus-outline"
              />
              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                :rules="[emailRule]"
                prepend-inner-icon="mdi-email-outline"
              />
            </div>
          </section>

          <v-divider class="section-divider" />

          <section class="form-section">
            <div class="section-heading">
              <span class="section-number">02</span>
              <div>
                <h3>Компанія</h3>
                <p>Реквізити та місцезнаходження</p>
              </div>
            </div>

            <div class="form-grid">
              <v-text-field
                v-model="form.edrpou"
                label="ЄДРПОУ / ІПН"
                prepend-inner-icon="mdi-identifier"
              />
              <v-text-field
                v-model="form.city"
                label="Місто"
                prepend-inner-icon="mdi-city-variant-outline"
              />
              <v-text-field
                v-model="form.address"
                label="Адреса"
                prepend-inner-icon="mdi-map-marker-outline"
              />
              <v-text-field
                v-model="form.website"
                label="Сайт"
                prepend-inner-icon="mdi-web"
                placeholder="https://"
              />
            </div>
          </section>

          <v-divider class="section-divider" />

          <section class="form-section">
            <div class="section-heading">
              <span class="section-number">03</span>
              <div>
                <h3>Робота з клієнтом</h3>
                <p>Джерело, статус і відповідальний</p>
              </div>
            </div>

            <div class="form-grid">
              <v-select
                v-model="form.source"
                :items="CLIENT_SOURCES"
                label="Джерело клієнта"
                prepend-inner-icon="mdi-source-branch"
                clearable
              />
              <v-select
                v-model="form.managerId"
                :items="managers"
                item-title="name"
                item-value="id"
                label="Відповідальний менеджер"
                prepend-inner-icon="mdi-account-tie-outline"
                clearable
              />
              <v-select
                v-model="form.status"
                :items="CLIENT_STATUSES"
                label="Статус клієнта"
                prepend-inner-icon="mdi-progress-check"
              />
              <v-textarea
                v-model="form.comment"
                label="Коментар"
                prepend-inner-icon="mdi-text-box-outline"
                rows="3"
                counter="5000"
                class="form-grid__full"
              />
            </div>
          </section>
        </v-form>
      </v-card-text>

      <v-divider />

      <v-card-actions class="dialog-actions">
        <v-btn
          variant="text"
          :disabled="loading"
          @click="emit('update:modelValue', false)"
        >
          Скасувати
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading || duplicateLoading"
          prepend-icon="mdi-check"
          class="save-button"
          @click="submit"
        >
          {{ mode === 'create' ? 'Додати клієнта' : 'Зберегти зміни' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="duplicateConfirm" max-width="520" persistent>
    <v-card class="duplicate-confirm">
      <v-card-text class="text-center">
        <div class="duplicate-confirm__icon">
          <v-icon icon="mdi-content-duplicate" size="29" />
        </div>
        <h3>Можливий дублікат клієнта</h3>
        <p>
          Кількість записів зі збігом за назвою компанії або ЄДРПОУ:
          {{ duplicates.length }}.
        </p>
        <div class="duplicate-confirm__items">
          <div
            v-for="client in duplicates.slice(0, 4)"
            :key="client.id"
          >
            <strong>{{ duplicateName(client) }}</strong>
            <span>
              {{ duplicateMatch(client) }}
              <template v-if="client.edrpou"> · {{ client.edrpou }}</template>
            </span>
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="duplicate-confirm__actions">
        <v-btn variant="text" @click="duplicateConfirm = false">
          Повернутися до форми
        </v-btn>
        <v-btn
          color="warning"
          variant="tonal"
          prepend-icon="mdi-alert-check-outline"
          @click="confirmDuplicate"
        >
          Усе одно створити
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.client-dialog {
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  min-height: 84px;
  padding: 16px 22px;
}

.dialog-header__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-right: 12px;
  border-radius: 14px;
  color: #26736a;
  background: #e8f2ee;
}

.dialog-title {
  color: #17293e;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 21px;
  font-weight: 700;
}

.dialog-subtitle {
  margin-top: 3px;
  color: #87919a;
  font-size: 12px;
}

.dialog-body {
  padding: 26px 28px !important;
  background: #fbfcfa;
}

.form-section {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 22px;
}

.section-heading {
  display: flex;
  gap: 10px;
}

.section-number {
  padding-top: 2px;
  color: #d87942;
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 800;
}

.section-heading h3 {
  margin: 0;
  color: #263747;
  font-size: 14px;
}

.section-heading p {
  margin: 6px 0 0;
  color: #929ba2;
  font-size: 11px;
  line-height: 1.45;
}

.type-toggle {
  grid-column: 2;
  width: fit-content;
  margin-bottom: 16px;
}

.type-toggle .v-btn {
  font-size: 12px;
}

.form-grid {
  display: grid;
  grid-column: 2;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.duplicate-notice {
  display: grid;
  grid-column: 2;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 16px;
  padding: 13px 14px;
  border: 1px solid #ecd2a9;
  border-radius: 13px;
  color: #765127;
  background: #fff8eb;
}

.duplicate-notice--error {
  color: #934949;
  border-color: #e9c5c2;
  background: #fff4f2;
}

.duplicate-notice__icon {
  display: grid;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(216, 121, 66, 0.1);
  place-items: center;
}

.duplicate-notice strong,
.duplicate-notice span {
  display: block;
}

.duplicate-notice strong {
  font-size: 11px;
}

.duplicate-notice span {
  margin-top: 3px;
  color: #a17a4f;
  font-size: 10px;
}

.duplicate-list {
  display: grid;
  gap: 7px;
  margin-top: 11px;
}

.duplicate-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.65);
}

.duplicate-list__item b,
.duplicate-list__item small {
  display: block;
}

.duplicate-list__item b {
  color: #674923;
  font-size: 10px;
}

.duplicate-list__item small {
  margin-top: 2px;
  color: #a17a4f;
  font-size: 9px;
}

.form-grid__full {
  grid-column: 1 / -1;
}

.section-divider {
  margin: 28px 0;
}

.dialog-actions {
  justify-content: flex-end;
  gap: 8px;
  min-height: 74px;
  padding: 14px 22px;
}

.save-button {
  min-width: 182px;
}

.duplicate-confirm {
  padding: 8px;
}

.duplicate-confirm .v-card-text {
  padding: 28px 24px 18px;
}

.duplicate-confirm__icon {
  display: grid;
  width: 60px;
  height: 60px;
  margin: 0 auto 16px;
  border-radius: 18px;
  color: #b66b2e;
  background: #fff1de;
  place-items: center;
}

.duplicate-confirm h3 {
  margin: 0;
  color: #263746;
  font-family: Georgia, serif;
  font-size: 22px;
}

.duplicate-confirm p {
  max-width: 400px;
  margin: 9px auto 16px;
  color: #7e8991;
  font-size: 11px;
  line-height: 1.55;
}

.duplicate-confirm__items {
  display: grid;
  gap: 7px;
  text-align: left;
}

.duplicate-confirm__items > div {
  padding: 10px 12px;
  border-radius: 10px;
  background: #f6f7f4;
}

.duplicate-confirm__items strong,
.duplicate-confirm__items span {
  display: block;
}

.duplicate-confirm__items strong {
  color: #43515c;
  font-size: 11px;
}

.duplicate-confirm__items span {
  margin-top: 3px;
  color: #929ba2;
  font-size: 9px;
}

.duplicate-confirm__actions {
  justify-content: center;
  gap: 7px;
  padding: 8px 18px 20px;
}

@media (max-width: 700px) {
  .dialog-body {
    padding: 22px 18px !important;
  }

  .form-section {
    display: block;
  }

  .section-heading {
    margin-bottom: 18px;
  }

  .type-toggle {
    display: grid;
    width: 100%;
    grid-template-columns: 1fr;
  }

  .type-toggle .v-btn {
    border-width: 0 0 1px !important;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .duplicate-notice {
    grid-column: auto;
  }

  .form-grid__full {
    grid-column: auto;
  }

  .dialog-actions {
    flex-wrap: nowrap;
  }

  .dialog-actions .v-btn {
    flex: 1;
  }
}
</style>
