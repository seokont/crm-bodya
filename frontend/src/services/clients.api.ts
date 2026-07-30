import type {
  Client,
  ClientActivity,
  ClientComment,
  ClientDeal,
  ClientDealPayload,
  ClientDocument,
  ClientDocumentPayload,
  ClientFilters,
  ClientPayload,
  ClientsResponse,
  ClientSort,
  ClientTask,
  ClientTaskPayload,
  CreateClientActivityPayload,
  DuplicateClientsResponse,
  Manager,
  UploadClientDocumentPayload,
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

  async getComments(clientId: number): Promise<ClientComment[]> {
    const { data } = await http.get<ClientComment[]>(
      `/clients/${clientId}/comments`,
    );
    return data;
  },

  async createComment(
    clientId: number,
    content: string,
  ): Promise<ClientComment> {
    const { data } = await http.post<ClientComment>(
      `/clients/${clientId}/comments`,
      { content },
    );
    return data;
  },

  async updateComment(
    clientId: number,
    commentId: number,
    content: string,
  ): Promise<ClientComment> {
    const { data } = await http.patch<ClientComment>(
      `/clients/${clientId}/comments/${commentId}`,
      { content },
    );
    return data;
  },

  async removeComment(clientId: number, commentId: number): Promise<void> {
    await http.delete(`/clients/${clientId}/comments/${commentId}`);
  },

  async getTasks(clientId: number): Promise<ClientTask[]> {
    const { data } = await http.get<ClientTask[]>(
      `/clients/${clientId}/tasks`,
    );
    return data;
  },

  async createTask(
    clientId: number,
    payload: ClientTaskPayload,
  ): Promise<ClientTask> {
    const { data } = await http.post<ClientTask>(
      `/clients/${clientId}/tasks`,
      payload,
    );
    return data;
  },

  async updateTask(
    clientId: number,
    taskId: number,
    payload: Partial<ClientTaskPayload>,
  ): Promise<ClientTask> {
    const { data } = await http.patch<ClientTask>(
      `/clients/${clientId}/tasks/${taskId}`,
      payload,
    );
    return data;
  },

  async removeTask(clientId: number, taskId: number): Promise<void> {
    await http.delete(`/clients/${clientId}/tasks/${taskId}`);
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

  async getDocuments(clientId: number): Promise<ClientDocument[]> {
    const { data } = await http.get<ClientDocument[]>(
      `/clients/${clientId}/documents`,
    );
    return data;
  },

  async uploadDocument(
    clientId: number,
    payload: UploadClientDocumentPayload,
    onProgress?: (progress: number) => void,
  ): Promise<ClientDocument> {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.title.trim()) formData.append('title', payload.title.trim());
    formData.append('category', payload.category);
    if (payload.description.trim()) {
      formData.append('description', payload.description.trim());
    }

    const { data } = await http.post<ClientDocument>(
      `/clients/${clientId}/documents`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
        onUploadProgress: (event) => {
          if (event.total) {
            onProgress?.(Math.round((event.loaded / event.total) * 100));
          }
        },
      },
    );
    return data;
  },

  async updateDocument(
    clientId: number,
    documentId: number,
    payload: ClientDocumentPayload,
  ): Promise<ClientDocument> {
    const { data } = await http.patch<ClientDocument>(
      `/clients/${clientId}/documents/${documentId}`,
      payload,
    );
    return data;
  },

  async downloadDocument(
    clientId: number,
    document: Pick<ClientDocument, 'id' | 'originalName'>,
  ): Promise<void> {
    const response = await http.get<Blob>(
      `/clients/${clientId}/documents/${document.id}/download`,
      {
        responseType: 'blob',
        timeout: 60_000,
      },
    );
    const blobUrl = URL.createObjectURL(response.data);
    const link = window.document.createElement('a');
    link.href = blobUrl;
    link.download = document.originalName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  async removeDocument(clientId: number, documentId: number): Promise<void> {
    await http.delete(`/clients/${clientId}/documents/${documentId}`);
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
