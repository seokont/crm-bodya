import type {
  Client,
  ClientActivity,
  ClientDeal,
  ClientDealPayload,
  ClientFilters,
  ClientPayload,
  ClientsResponse,
  ClientSort,
  CreateClientActivityPayload,
  DuplicateClientsResponse,
  Manager,
} from '@/types/client';
import { http } from './http';

export interface GetClientsParams extends ClientFilters, ClientSort {
  page: number;
  limit: number;
}

const compactParams = (params: GetClientsParams) => ({
  page: params.page,
  limit: params.limit,
  search: params.search || undefined,
  status: params.status.length ? params.status.join(',') : undefined,
  managerId: params.managerId || undefined,
  source: params.source.length ? params.source.join(',') : undefined,
  city: params.city || undefined,
  dateFrom: params.dateFrom || undefined,
  dateTo: params.dateTo || undefined,
  sortBy: params.sortBy,
  sortOrder: params.sortOrder,
});

export const clientsApi = {
  async getAll(params: GetClientsParams): Promise<ClientsResponse> {
    const { data } = await http.get<ClientsResponse>('/clients', {
      params: compactParams(params),
    });
    return data;
  },

  async getOne(id: number): Promise<Client> {
    const { data } = await http.get<Client>(`/clients/${id}`);
    return data;
  },

  async create(payload: ClientPayload): Promise<Client> {
    const { data } = await http.post<Client>('/clients', payload);
    return data;
  },

  async update(id: number, payload: Partial<ClientPayload>): Promise<Client> {
    const { data } = await http.patch<Client>(`/clients/${id}`, payload);
    return data;
  },

  async archive(id: number): Promise<Client> {
    const { data } = await http.patch<Client>(`/clients/${id}/archive`);
    return data;
  },

  async remove(id: number): Promise<void> {
    await http.delete(`/clients/${id}`);
  },

  async getActivities(clientId: number): Promise<ClientActivity[]> {
    const { data } = await http.get<ClientActivity[]>(
      `/clients/${clientId}/activities`,
    );
    return data;
  },

  async createActivity(
    clientId: number,
    payload: CreateClientActivityPayload,
  ): Promise<ClientActivity> {
    const { data } = await http.post<ClientActivity>(
      `/clients/${clientId}/activities`,
      payload,
    );
    return data;
  },

  async removeActivity(clientId: number, activityId: number): Promise<void> {
    await http.delete(`/clients/${clientId}/activities/${activityId}`);
  },

  async getDeals(clientId: number): Promise<ClientDeal[]> {
    const { data } = await http.get<ClientDeal[]>(`/clients/${clientId}/deals`);
    return data;
  },

  async createDeal(
    clientId: number,
    payload: ClientDealPayload,
  ): Promise<ClientDeal> {
    const { data } = await http.post<ClientDeal>(
      `/clients/${clientId}/deals`,
      payload,
    );
    return data;
  },

  async updateDeal(
    clientId: number,
    dealId: number,
    payload: Partial<ClientDealPayload>,
  ): Promise<ClientDeal> {
    const { data } = await http.patch<ClientDeal>(
      `/clients/${clientId}/deals/${dealId}`,
      payload,
    );
    return data;
  },

  async removeDeal(clientId: number, dealId: number): Promise<void> {
    await http.delete(`/clients/${clientId}/deals/${dealId}`);
  },

  async getManagers(): Promise<Manager[]> {
    const { data } = await http.get<Manager[]>('/managers');
    return data;
  },

  async findDuplicates(
    companyName?: string,
    edrpou?: string,
  ): Promise<DuplicateClientsResponse> {
    const { data } = await http.get<DuplicateClientsResponse>(
      '/clients/duplicates',
      {
        params: {
          companyName: companyName?.trim() || undefined,
          edrpou: edrpou?.trim() || undefined,
        },
      },
    );
    return data;
  },
};
