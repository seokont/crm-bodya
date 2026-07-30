import type {
  ClientTaskPriority,
  ClientTaskStatus,
  TaskClientOption,
  TasksResponse,
} from '@/types/client';
import { http } from './http';

export type TaskDueFilter =
  | 'ALL'
  | 'OVERDUE'
  | 'TODAY'
  | 'UPCOMING'
  | 'NO_DUE_DATE';

export interface GetTasksParams {
  page: number;
  limit: number;
  search: string;
  status: ClientTaskStatus[];
  priority: ClientTaskPriority[];
  assigneeId: number | null;
  clientId: number | null;
  due: TaskDueFilter;
}

export const tasksApi = {
  async getAll(params: GetTasksParams): Promise<TasksResponse> {
    const { data } = await http.get<TasksResponse>('/tasks', {
      params: {
        page: params.page,
        limit: params.limit,
        search: params.search.trim() || undefined,
        status: params.status.length ? params.status.join(',') : undefined,
        priority: params.priority.length
          ? params.priority.join(',')
          : undefined,
        assigneeId: params.assigneeId || undefined,
        clientId: params.clientId || undefined,
        due: params.due,
      },
    });
    return data;
  },

  async getClientOptions(): Promise<TaskClientOption[]> {
    const { data } = await http.get<TaskClientOption[]>('/tasks/clients');
    return data;
  },
};
