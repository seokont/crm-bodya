export type ClientType = 'PERSON' | 'FOP' | 'COMPANY';

export type ClientStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'CONTACTED'
  | 'WAITING'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'CLIENT'
  | 'REJECTED'
  | 'ARCHIVED';

export interface Manager {
  id: number;
  name: string;
  email: string;
}

export interface Client {
  id: number;
  type: ClientType;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  edrpou: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  status: ClientStatus;
  source: string | null;
  managerId: number | null;
  manager: Manager | null;
  creatorId: number | null;
  creatorName: string | null;
  creator: {
    id: number;
    name: string;
    email: string;
    role: 'ADMIN' | 'MANAGER';
  } | null;
  comment: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientActivityType =
  | 'NOTE'
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'STATUS_CHANGE'
  | 'SYSTEM';

export type ManualClientActivityType = Exclude<
  ClientActivityType,
  'STATUS_CHANGE' | 'SYSTEM'
>;

export interface ClientActivity {
  id: number;
  type: ClientActivityType;
  content: string;
  occurredAt: string;
  clientId: number;
  authorId: number | null;
  authorName: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
  } | null;
}

export interface CreateClientActivityPayload {
  type: ManualClientActivityType;
  content: string;
  occurredAt?: string;
}

export interface ClientComment {
  id: number;
  content: string;
  clientId: number;
  authorId: number | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    name: string;
  } | null;
}

export type ClientTaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED';

export type ClientTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ClientTask {
  id: number;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  priority: ClientTaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  clientId: number;
  assigneeId: number | null;
  assigneeName: string | null;
  creatorId: number | null;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  assignee: {
    id: number;
    name: string;
    email: string;
  } | null;
  creator: {
    id: number;
    name: string;
  } | null;
}

export interface ClientTaskPayload {
  title: string;
  description: string;
  status: ClientTaskStatus;
  priority: ClientTaskPriority;
  dueAt: string | null;
  assigneeId: number | null;
}

export interface TaskClientOption {
  id: number;
  companyName: string | null;
  contactName: string | null;
  managerId: number | null;
  manager: {
    id: number;
    name: string;
  } | null;
}

export interface GlobalClientTask extends ClientTask {
  client: TaskClientOption & {
    creatorId: number | null;
  };
}

export interface TasksResponse {
  items: GlobalClientTask[];
  meta: PaginationMeta;
  summary: {
    total: number;
    open: number;
    done: number;
    overdue: number;
    today: number;
  };
}

export type ClientDealStage =
  | 'NEW'
  | 'QUALIFICATION'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export type ClientDealCurrency = 'UAH' | 'USD' | 'EUR';

export interface ClientDeal {
  id: number;
  title: string;
  amount: string;
  currency: ClientDealCurrency;
  stage: ClientDealStage;
  expectedCloseAt: string | null;
  description: string | null;
  clientId: number;
  ownerId: number | null;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: number;
    name: string;
  } | null;
}

export interface DealClientOption {
  id: number;
  companyName: string | null;
  contactName: string | null;
  managerId: number | null;
  manager: {
    id: number;
    name: string;
  } | null;
}

export interface GlobalClientDeal extends ClientDeal {
  client: DealClientOption;
}

export interface DealsResponse {
  items: GlobalClientDeal[];
  meta: PaginationMeta;
  summary: {
    total: number;
    open: number;
    won: number;
    lost: number;
    activeValue: {
      currency: string;
      amount: string;
    }[];
  };
}

export interface ClientDealPayload {
  title: string;
  amount: number;
  currency: ClientDealCurrency;
  stage: ClientDealStage;
  expectedCloseAt?: string | null;
  description?: string;
}

export type ClientDocumentCategory =
  | 'CONTRACT'
  | 'INVOICE'
  | 'ACT'
  | 'APPLICATION'
  | 'POWER_OF_ATTORNEY'
  | 'OTHER';

export interface ClientDocument {
  id: number;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: ClientDocumentCategory;
  description: string | null;
  clientId: number;
  uploaderId: number | null;
  uploaderName: string;
  createdAt: string;
  updatedAt: string;
  uploader: {
    id: number;
    name: string;
  } | null;
}

export interface ClientDocumentPayload {
  title: string;
  category: ClientDocumentCategory;
  description: string;
}

export interface UploadClientDocumentPayload extends ClientDocumentPayload {
  file: File;
}

export interface ClientPayload {
  type: ClientType;
  companyName?: string;
  contactName?: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  edrpou?: string;
  city?: string;
  address?: string;
  website?: string;
  status?: ClientStatus;
  source?: string;
  managerId?: number;
  comment?: string;
}

export interface ClientFilters {
  search: string;
  status: ClientStatus[];
  managerId: number | null;
  source: string[];
  city: string;
  dateFrom: string;
  dateTo: string;
}

export interface ClientSort {
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'status' | 'manager' | 'city';
  sortOrder: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ClientsResponse {
  items: Client[];
  meta: PaginationMeta;
}

export interface DuplicateClient {
  id: number;
  companyName: string | null;
  contactName: string | null;
  edrpou: string | null;
  status: ClientStatus;
  isArchived: boolean;
  manager: {
    id: number;
    name: string;
  } | null;
  matchedBy: ('COMPANY_NAME' | 'EDRPOU')[];
}

export interface DuplicateClientsResponse {
  duplicates: DuplicateClient[];
}

export interface SelectOption<T = string> {
  title: string;
  value: T;
}

export const CLIENT_TYPES: SelectOption<ClientType>[] = [
  { title: 'Фізична особа', value: 'PERSON' },
  { title: 'ФОП', value: 'FOP' },
  { title: 'Компанія', value: 'COMPANY' },
];

export const CLIENT_STATUSES: SelectOption<ClientStatus>[] = [
  { title: 'Новий', value: 'NEW' },
  { title: 'У роботі', value: 'IN_PROGRESS' },
  { title: "Зв'язалися", value: 'CONTACTED' },
  { title: 'Очікує рішення', value: 'WAITING' },
  { title: 'Зацікавлений', value: 'INTERESTED' },
  { title: 'Не зацікавлений', value: 'NOT_INTERESTED' },
  { title: 'Клієнт', value: 'CLIENT' },
  { title: 'Відмова', value: 'REJECTED' },
  { title: 'Архів', value: 'ARCHIVED' },
];

export const CLIENT_SOURCES: SelectOption[] = [
  'Холодний дзвінок',
  'Google',
  'Facebook',
  'Instagram',
  'LinkedIn',
  'Telegram',
  'WhatsApp',
  'Рекомендація',
  'Сайт',
  'Email',
  'Партнер',
  'Інше',
].map((value) => ({ title: value, value }));

export const CLIENT_ACTIVITY_TYPES: SelectOption<ManualClientActivityType>[] = [
  { title: 'Нотатка', value: 'NOTE' },
  { title: 'Дзвінок', value: 'CALL' },
  { title: 'Email', value: 'EMAIL' },
  { title: 'Зустріч', value: 'MEETING' },
];

export const CLIENT_DEAL_STAGES: SelectOption<ClientDealStage>[] = [
  { title: 'Нова', value: 'NEW' },
  { title: 'Кваліфікація', value: 'QUALIFICATION' },
  { title: 'Пропозиція', value: 'PROPOSAL' },
  { title: 'Переговори', value: 'NEGOTIATION' },
  { title: 'Успішна', value: 'WON' },
  { title: 'Втрачена', value: 'LOST' },
];

export const CLIENT_DEAL_CURRENCIES: SelectOption<ClientDealCurrency>[] = [
  { title: '₴ UAH', value: 'UAH' },
  { title: '$ USD', value: 'USD' },
  { title: '€ EUR', value: 'EUR' },
];

export const CLIENT_DOCUMENT_CATEGORIES: SelectOption<ClientDocumentCategory>[] =
  [
    { title: 'Договір', value: 'CONTRACT' },
    { title: 'Рахунок', value: 'INVOICE' },
    { title: 'Акт', value: 'ACT' },
    { title: 'Заява', value: 'APPLICATION' },
    { title: 'Довіреність', value: 'POWER_OF_ATTORNEY' },
    { title: 'Інше', value: 'OTHER' },
  ];

export const CLIENT_TASK_STATUSES: SelectOption<ClientTaskStatus>[] = [
  { title: 'Заплановано', value: 'TODO' },
  { title: 'У роботі', value: 'IN_PROGRESS' },
  { title: 'Виконано', value: 'DONE' },
  { title: 'Скасовано', value: 'CANCELLED' },
];

export const CLIENT_TASK_PRIORITIES: SelectOption<ClientTaskPriority>[] = [
  { title: 'Низький', value: 'LOW' },
  { title: 'Середній', value: 'MEDIUM' },
  { title: 'Високий', value: 'HIGH' },
  { title: 'Терміновий', value: 'URGENT' },
];

export const emptyClientFilters = (): ClientFilters => ({
  search: '',
  status: [],
  managerId: null,
  source: [],
  city: '',
  dateFrom: '',
  dateTo: '',
});

export const clientDisplayName = (
  client: Pick<Client, 'id' | 'companyName' | 'contactName'>,
): string =>
  client.companyName || client.contactName || `Клієнт #${client.id}`;
