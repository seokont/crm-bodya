import type {
  ClientDeal,
  ClientDealCurrency,
  ClientDealPayload,
  ClientDealStage,
  DealClientOption,
  DealsResponse,
} from '@/types/client';
import { http } from './http';

export interface GetDealsParams {
  page: number;
  limit: number;
  search?: string;
  stage?: ClientDealStage[];
  currency?: ClientDealCurrency | null;
  managerId?: number | null;
  sortBy?: 'updatedAt' | 'createdAt' | 'amount' | 'expectedCloseAt';
  sortOrder?: 'asc' | 'desc';
}

export const dealsApi = {
  async getAll(params: GetDealsParams): Promise<DealsResponse> {
    const { data } = await http.get<DealsResponse>('/deals', {
      params: {
        page: params.page,
        limit: params.limit,
        search: params.search?.trim() || undefined,
        stage: params.stage?.length ? params.stage.join(',') : undefined,
        currency: params.currency || undefined,
        managerId: params.managerId || undefined,
        sortBy: params.sortBy ?? 'updatedAt',
        sortOrder: params.sortOrder ?? 'desc',
      },
    });
    return data;
  },

  async getClientOptions(): Promise<DealClientOption[]> {
    const { data } = await http.get<DealClientOption[]>('/deals/clients');
    return data;
  },

  async create(
    clientId: number,
    payload: ClientDealPayload,
  ): Promise<ClientDeal> {
    const { data } = await http.post<ClientDeal>(
      `/clients/${clientId}/deals`,
      payload,
    );
    return data;
  },

  async update(
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

  async remove(clientId: number, dealId: number): Promise<void> {
    await http.delete(`/clients/${clientId}/deals/${dealId}`);
  },
};
