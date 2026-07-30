import type {
  ClientActivityType,
  ClientDealStage,
  ClientStatus,
} from './client';

export type AnalyticsPeriod = 30 | 90 | 180 | 365;

export interface AnalyticsResponse {
  scope: 'TEAM' | 'PERSONAL';
  period: AnalyticsPeriod;
  generatedAt: string;
  metrics: {
    activeClients: number;
    newClients: number;
    conversionRate: number;
    totalDeals: number;
    wonDeals: number;
    dealWinRate: number;
    openTasks: number;
    overdueTasks: number;
    taskCompletionRate: number;
    activities: number;
  };
  statuses: {
    status: ClientStatus;
    count: number;
  }[];
  sources: {
    source: string;
    count: number;
  }[];
  pipeline: {
    stage: ClientDealStage;
    count: number;
    values: CurrencyAmount[];
  }[];
  revenue: CurrencyAmount[];
  tasks: {
    total: number;
    open: number;
    done: number;
    cancelled: number;
    overdue: number;
  };
  activityTypes: {
    type: ClientActivityType;
    count: number;
  }[];
  trend: {
    label: string;
    clients: number;
    deals: number;
    activities: number;
  }[];
  team: {
    id: number;
    name: string;
    clients: number;
    wonDeals: number;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
  }[];
}

export interface CurrencyAmount {
  currency: string;
  amount: string;
}
