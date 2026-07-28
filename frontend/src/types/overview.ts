import type { ClientStatus, ClientType } from './client';

export type OverviewPeriod = 7 | 30 | 90;

export interface OverviewMetrics {
  activeClients: number;
  newClients: number;
  newClientsChange: number;
  inWorkClients: number;
  archivedClients: number;
  unassignedClients: number;
}

export interface OverviewCount {
  count: number;
}

export interface OverviewStatus extends OverviewCount {
  status: ClientStatus;
}

export interface OverviewSource extends OverviewCount {
  source: string;
}

export interface OverviewActivity extends OverviewCount {
  label: string;
}

export interface OverviewManager {
  id: number;
  name: string;
  clients: number;
}

export interface OverviewRecentClient {
  id: number;
  type: ClientType;
  companyName: string | null;
  contactName: string | null;
  status: ClientStatus;
  source: string | null;
  city: string | null;
  createdAt: string;
  manager: {
    id: number;
    name: string;
  } | null;
}

export interface OverviewResponse {
  scope: 'TEAM' | 'PERSONAL';
  period: OverviewPeriod;
  generatedAt: string;
  metrics: OverviewMetrics;
  statuses: OverviewStatus[];
  sources: OverviewSource[];
  activity: OverviewActivity[];
  team: OverviewManager[];
  recentClients: OverviewRecentClient[];
}
