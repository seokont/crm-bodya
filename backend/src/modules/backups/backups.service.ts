import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const userColumns = [
  'id',
  'name',
  'email',
  'passwordHash',
  'role',
  'isActive',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
];

const clientColumns = [
  'id',
  'type',
  'companyName',
  'contactName',
  'phone',
  'secondaryPhone',
  'email',
  'edrpou',
  'city',
  'address',
  'website',
  'status',
  'source',
  'managerId',
  'creatorId',
  'creatorName',
  'comment',
  'isArchived',
  'createdAt',
  'updatedAt',
];

const activityColumns = [
  'id',
  'type',
  'content',
  'occurredAt',
  'clientId',
  'authorId',
  'authorName',
  'createdAt',
  'updatedAt',
];

const dealColumns = [
  'id',
  'title',
  'amount',
  'currency',
  'stage',
  'expectedCloseAt',
  'description',
  'clientId',
  'ownerId',
  'ownerName',
  'createdAt',
  'updatedAt',
];

const documentColumns = [
  'id',
  'title',
  'originalName',
  'storedName',
  'mimeType',
  'size',
  'category',
  'description',
  'clientId',
  'uploaderId',
  'uploaderName',
  'createdAt',
  'updatedAt',
];

const commentColumns = [
  'id',
  'content',
  'clientId',
  'authorId',
  'authorName',
  'createdAt',
  'updatedAt',
];

const taskColumns = [
  'id',
  'title',
  'description',
  'status',
  'priority',
  'dueAt',
  'completedAt',
  'clientId',
  'assigneeId',
  'assigneeName',
  'creatorId',
  'creatorName',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class BackupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDatabaseBackup() {
    const generatedAt = new Date();
    const [users, clients, activities, deals, documents, comments, tasks] =
      await Promise.all([
        this.prisma.user.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.client.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.clientActivity.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.clientDeal.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.clientDocument.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.clientComment.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.clientTask.findMany({ orderBy: { id: 'asc' } }),
      ]);

    const sql = [
      '-- Резервна копія даних Bodya CRM',
      `-- Створено: ${generatedAt.toISOString()}`,
      `-- Користувачів: ${users.length}; клієнтів: ${clients.length}; активностей: ${activities.length}; угод: ${deals.length}; документів: ${documents.length}; коментарів: ${comments.length}; завдань: ${tasks.length}`,
      '',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      'START TRANSACTION;',
      '',
      'DELETE FROM `ClientActivity`;',
      'DELETE FROM `ClientDeal`;',
      'DELETE FROM `ClientDocument`;',
      'DELETE FROM `ClientComment`;',
      'DELETE FROM `ClientTask`;',
      'DELETE FROM `Client`;',
      'DELETE FROM `User`;',
      '',
      this.renderInsert('User', userColumns, users),
      '',
      this.renderInsert('Client', clientColumns, clients),
      '',
      this.renderInsert('ClientActivity', activityColumns, activities),
      '',
      this.renderInsert('ClientDeal', dealColumns, deals),
      '',
      this.renderInsert('ClientDocument', documentColumns, documents),
      '',
      this.renderInsert('ClientComment', commentColumns, comments),
      '',
      this.renderInsert('ClientTask', taskColumns, tasks),
      '',
      `ALTER TABLE \`User\` AUTO_INCREMENT = ${this.nextId(users)};`,
      `ALTER TABLE \`Client\` AUTO_INCREMENT = ${this.nextId(clients)};`,
      `ALTER TABLE \`ClientActivity\` AUTO_INCREMENT = ${this.nextId(activities)};`,
      `ALTER TABLE \`ClientDeal\` AUTO_INCREMENT = ${this.nextId(deals)};`,
      `ALTER TABLE \`ClientDocument\` AUTO_INCREMENT = ${this.nextId(documents)};`,
      `ALTER TABLE \`ClientComment\` AUTO_INCREMENT = ${this.nextId(comments)};`,
      `ALTER TABLE \`ClientTask\` AUTO_INCREMENT = ${this.nextId(tasks)};`,
      '',
      'COMMIT;',
      'SET FOREIGN_KEY_CHECKS = 1;',
      '',
    ].join('\n');

    const stamp = generatedAt
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .slice(0, 15);

    return {
      filename: `bodya-crm-backup-${stamp}.sql`,
      content: sql,
    };
  }

  private renderInsert<T>(table: string, columns: string[], rows: T[]) {
    if (!rows.length) return `-- Таблиця \`${table}\` не містить даних.`;

    const columnSql = columns.map((column) => `\`${column}\``).join(', ');
    const valuesSql = rows
      .map((row) => {
        const record = row as Record<string, unknown>;
        const values = columns
          .map((column) => this.sqlValue(record[column]))
          .join(', ');
        return `(${values})`;
      })
      .join(',\n');

    return `INSERT INTO \`${table}\` (${columnSql}) VALUES\n${valuesSql};`;
  }

  private nextId<T extends { id: number }>(rows: T[]) {
    return rows.length ? Math.max(...rows.map((row) => row.id)) + 1 : 1;
  }

  private sqlValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value instanceof Date) {
      return `'${value.toISOString().slice(0, 23).replace('T', ' ')}'`;
    }

    const escaped = String(value)
      .replace(/\\/g, '\\\\')
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/'/g, "''");
    return `'${escaped}'`;
  }
}
