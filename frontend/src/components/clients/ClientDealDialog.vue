<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import {
  CLIENT_DEAL_CURRENCIES,
  CLIENT_DEAL_STAGES,
  type ClientDeal,
  type ClientDealCurrency,
  type ClientDealPayload,
  type ClientDealStage,
} from '@/types/client';

const props = defineProps<{
  modelValue: boolean;
  deal?: ClientDeal | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: ClientDealPayload];
}>();

const formRef = ref<{
  validate: () => Promise<{ valid: boolean }>;
} | null>(null);

const form = reactive<{
  title: string;
  amount: number | null;
  currency: ClientDealCurrency;
  stage: ClientDealStage;
  expectedCloseAt: string;
  description: string;
}>({
  title: '',
  amount: null,
  currency: 'UAH',
  stage: 'NEW',
  expectedCloseAt: '',
  description: '',
});

const required = (value: unknown) =>
  (value !== null && value !== undefined && String(value).trim().length > 0) ||
  "Обов'язкове поле";
const nonNegative = (value: number | null) =>
  value === null || value >= 0 || 'Сума не може бути від’ємною';

const toLocalDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

function resetForm() {
  form.title = props.deal?.title ?? '';
  form.amount = props.deal ? Number(props.deal.amount) : null;
  form.currency = props.deal?.currency ?? 'UAH';
  form.stage = props.deal?.stage ?? 'NEW';
  form.expectedCloseAt = toLocalDate(props.deal?.expectedCloseAt);
  form.description = props.deal?.description ?? '';
}

async function submit() {
  const result = await formRef.value?.validate();
  if (!result?.valid || form.amount === null) return;

  emit('save', {
    title: form.title.trim(),
    amount: Number(form.amount),
    currency: form.currency,
    stage: form.stage,
    expectedCloseAt: form.expectedCloseAt
      ? new Date(`${form.expectedCloseAt}T12:00:00`).toISOString()
      : null,
    description: form.description.trim(),
  });
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm();
  },
);
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="680"
    :persistent="loading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="deal-dialog-card">
      <div class="deal-dialog-heading">
        <div class="deal-dialog-icon">
          <v-icon icon="mdi-handshake-outline" size="22" />
        </div>
        <div>
          <h2>{{ deal ? 'Редагувати угоду' : 'Нова угода' }}</h2>
          <p>
            {{
              deal
                ? 'Оновіть суму, етап або заплановану дату закриття'
                : 'Додайте угоду до воронки цього клієнта'
            }}
          </p>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Закрити"
          :disabled="loading"
          @click="emit('update:modelValue', false)"
        />
      </div>

      <v-form ref="formRef" @submit.prevent="submit">
        <v-card-text class="deal-dialog-content modal-input-stack">
          <v-text-field
            v-model="form.title"
            label="Назва угоди"
            placeholder="Наприклад: річне обслуговування"
            variant="outlined"
            maxlength="191"
            :rules="[required]"
            autofocus
          />

          <div class="deal-form-grid amount-row">
            <v-text-field
              v-model.number="form.amount"
              type="number"
              min="0"
              max="999999999999.99"
              step="0.01"
              label="Сума"
              variant="outlined"
              :rules="[required, nonNegative]"
            />
            <v-select
              v-model="form.currency"
              :items="CLIENT_DEAL_CURRENCIES"
              label="Валюта"
              variant="outlined"
            />
          </div>

          <div class="deal-form-grid">
            <v-select
              v-model="form.stage"
              :items="CLIENT_DEAL_STAGES"
              label="Етап"
              variant="outlined"
            />
            <v-text-field
              v-model="form.expectedCloseAt"
              type="date"
              label="Очікуване закриття"
              variant="outlined"
              clearable
            />
          </div>

          <v-textarea
            v-model="form.description"
            label="Опис"
            placeholder="Умови, домовленості або наступний крок"
            variant="outlined"
            rows="3"
            auto-grow
            maxlength="5000"
            counter
          />
        </v-card-text>

        <v-card-actions class="deal-dialog-actions">
          <v-btn
            variant="text"
            :disabled="loading"
            @click="emit('update:modelValue', false)"
          >
            Скасувати
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            prepend-icon="mdi-check"
            :loading="loading"
          >
            {{ deal ? 'Зберегти зміни' : 'Створити угоду' }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.deal-dialog-card {
  overflow: hidden;
  border-radius: 20px !important;
}

.deal-dialog-heading {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 22px 24px 16px;
}

.deal-dialog-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  color: #26736a;
  background: #e8f2ef;
}

.deal-dialog-heading h2 {
  margin: 0;
  color: #253946;
  font-family: Georgia, serif;
  font-size: 22px;
}

.deal-dialog-heading p {
  margin: 4px 0 0;
  color: #87939b;
  font-size: 11px;
}

.deal-dialog-content {
  padding: 10px 24px 4px !important;
}

.deal-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.deal-form-grid.amount-row {
  grid-template-columns: minmax(0, 2fr) minmax(130px, 1fr);
}

.deal-dialog-actions {
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 24px 22px;
}

@media (max-width: 599px) {
  .deal-dialog-heading {
    grid-template-columns: 42px minmax(0, 1fr) auto;
    padding: 18px 16px 14px;
  }

  .deal-dialog-icon {
    width: 42px;
    height: 42px;
  }

  .deal-dialog-heading h2 {
    font-size: 19px;
  }

  .deal-dialog-content {
    padding: 8px 16px 2px !important;
  }

  .deal-form-grid,
  .deal-form-grid.amount-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .deal-dialog-actions {
    padding: 12px 16px 18px;
  }
}
</style>
