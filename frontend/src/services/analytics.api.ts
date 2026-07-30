import type {
  AnalyticsPeriod,
  AnalyticsResponse,
} from '@/types/analytics';
import { http } from './http';

export const analyticsApi = {
  async get(period: AnalyticsPeriod): Promise<AnalyticsResponse> {
    const { data } = await http.get<AnalyticsResponse>('/analytics', {
      params: { period },
    });
    return data;
  },
};
