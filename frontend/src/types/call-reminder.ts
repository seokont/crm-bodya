export interface CallReminder {
  id: number;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS';
  dueAt: string;
  remindAt: string;
  assigneeId: number;
  assigneeName: string;
  clientId: number;
  client: {
    id: number;
    companyName: string | null;
    contactName: string | null;
    phone: string | null;
  };
}

export interface CallRemindersResponse {
  items: CallReminder[];
  unreadCount: number;
  freshIds: number[];
}
