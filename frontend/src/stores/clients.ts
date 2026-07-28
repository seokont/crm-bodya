import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { clientsApi } from '@/services/clients.api';
import { getApiError } from '@/services/http';
import {
  emptyClientFilters,
  type Client,
  type ClientFilters,
  type ClientPayload,
  type ClientSort,
  type Manager,
} from '@/types/client';

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<Client[]>([]);
  const selectedClient = ref<Client | null>(null);
  const managers = ref<Manager[]>([]);
  const loading = ref(false);
  const detailsLoading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const total = ref(0);
  const page = ref(1);
  const limit = ref(25);
  const filters = ref<ClientFilters>(emptyClientFilters());
  const sort = ref<ClientSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(total.value / limit.value)),
  );

  async function fetchClients() {
    loading.value = true;
    error.value = '';
    try {
      const response = await clientsApi.getAll({
        ...filters.value,
        ...sort.value,
        page: page.value,
        limit: limit.value,
      });
      clients.value = response.items;
      total.value = response.meta.total;
      page.value = response.meta.page;
    } catch (requestError) {
      error.value = getApiError(requestError);
    } finally {
      loading.value = false;
    }
  }

  async function fetchClient(id: number) {
    detailsLoading.value = true;
    error.value = '';
    try {
      selectedClient.value = await clientsApi.getOne(id);
      return selectedClient.value;
    } catch (requestError) {
      error.value = getApiError(requestError);
      throw requestError;
    } finally {
      detailsLoading.value = false;
    }
  }

  async function fetchManagers() {
    try {
      managers.value = await clientsApi.getManagers();
    } catch (requestError) {
      error.value = getApiError(requestError);
    }
  }

  async function createClient(payload: ClientPayload) {
    saving.value = true;
    error.value = '';
    try {
      const client = await clientsApi.create(payload);
      await fetchClients();
      return client;
    } catch (requestError) {
      error.value = getApiError(requestError);
      throw requestError;
    } finally {
      saving.value = false;
    }
  }

  async function updateClient(id: number, payload: Partial<ClientPayload>) {
    saving.value = true;
    error.value = '';
    try {
      const client = await clientsApi.update(id, payload);
      selectedClient.value =
        selectedClient.value?.id === id ? client : selectedClient.value;
      await fetchClients();
      return client;
    } catch (requestError) {
      error.value = getApiError(requestError);
      throw requestError;
    } finally {
      saving.value = false;
    }
  }

  async function archiveClient(id: number) {
    saving.value = true;
    error.value = '';
    try {
      await clientsApi.archive(id);
      if (selectedClient.value?.id === id) selectedClient.value = null;
      await fetchClients();
    } catch (requestError) {
      error.value = getApiError(requestError);
      throw requestError;
    } finally {
      saving.value = false;
    }
  }

  async function deleteClient(id: number) {
    saving.value = true;
    error.value = '';
    try {
      await clientsApi.remove(id);
      if (selectedClient.value?.id === id) selectedClient.value = null;
      if (clients.value.length === 1 && page.value > 1) page.value -= 1;
      await fetchClients();
    } catch (requestError) {
      error.value = getApiError(requestError);
      throw requestError;
    } finally {
      saving.value = false;
    }
  }

  function setFilters(nextFilters: ClientFilters) {
    filters.value = { ...nextFilters };
    page.value = 1;
  }

  function resetFilters() {
    filters.value = emptyClientFilters();
    page.value = 1;
  }

  return {
    clients,
    selectedClient,
    managers,
    loading,
    detailsLoading,
    saving,
    error,
    total,
    totalPages,
    page,
    limit,
    filters,
    sort,
    fetchClients,
    fetchClient,
    fetchManagers,
    createClient,
    updateClient,
    archiveClient,
    deleteClient,
    setFilters,
    resetFilters,
  };
});
