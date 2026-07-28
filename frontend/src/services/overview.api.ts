import type {
  OverviewPeriod,
  OverviewResponse,
} from '@/types/overview';
import { http } from './http';

export const overviewApi = {
  async get(period: OverviewPeriod): Promise<OverviewResponse> {
    const { data } = await http.get<OverviewResponse>('/overview', {
      params: { period },
    });
    return data;
  },
};
