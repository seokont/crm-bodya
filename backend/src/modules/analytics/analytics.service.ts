import { Injectable } from '@nestjs/common';
import {
  ActivityType,
  ClientStatus,
  DealStage,
  Prisma,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';

const openTaskStatuses: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(user: AuthUser, period: number) {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCDate(periodStart.getUTCDate() - period + 1);

    const managerClientScope: Prisma.ClientWhereInput =
      user.role === UserRole.ADMIN ? {} : { managerId: user.id };
    const clientScope: Prisma.ClientWhereInput = {
      ...managerClientScope,
      isArchived: false,
    };
    const dealScope: Prisma.ClientDealWhereInput = {
      client: {
        isArchived: false,
        ...(user.role === UserRole.ADMIN ? {} : { managerId: user.id }),
      },
    };
    const taskScope: Prisma.ClientTaskWhereInput =
      user.role === UserRole.ADMIN
        ? { client: { isArchived: false } }
        : {
            AND: [
              { client: { isArchived: false } },
              {
                OR: [
                  { assigneeId: user.id },
                  { creatorId: user.id },
                  { client: { managerId: user.id } },
                ],
              },
            ],
          };
    const activityScope: Prisma.ClientActivityWhereInput = {
      createdAt: { gte: periodStart, lte: now },
      client: {
        isArchived: false,
        ...(user.role === UserRole.ADMIN ? {} : { managerId: user.id }),
      },
    };

    const [
      activeClients,
      newClients,
      convertedClients,
      statuses,
      sources,
      clientRows,
      newClientRows,
      dealRows,
      taskRows,
      activityRows,
      managers,
    ] = await Promise.all([
      this.prisma.client.count({ where: clientScope }),
      this.prisma.client.count({
        where: {
          ...clientScope,
          createdAt: { gte: periodStart, lte: now },
        },
      }),
      this.prisma.client.count({
        where: {
          ...clientScope,
          status: {
            in: [
              ClientStatus.INTERESTED,
              ClientStatus.SIGNED_CONTRACT,
              ClientStatus.PARTIALLY_PAID,
              ClientStatus.FULLY_PAID,
            ],
          },
        },
      }),
      this.prisma.client.groupBy({
        by: ['status'],
        where: clientScope,
        _count: { _all: true },
      }),
      this.prisma.client.groupBy({
        by: ['source'],
        where: { ...clientScope, source: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.client.findMany({
        where: clientScope,
        select: { managerId: true },
      }),
      this.prisma.client.findMany({
        where: {
          ...clientScope,
          createdAt: { gte: periodStart, lte: now },
        },
        select: { createdAt: true },
      }),
      this.prisma.clientDeal.findMany({
        where: {
          ...dealScope,
          createdAt: { gte: periodStart, lte: now },
        },
        select: {
          stage: true,
          currency: true,
          amount: true,
          createdAt: true,
          client: {
            select: { managerId: true },
          },
        },
      }),
      this.prisma.clientTask.findMany({
        where: taskScope,
        select: {
          status: true,
          dueAt: true,
          completedAt: true,
          assigneeId: true,
          createdAt: true,
        },
      }),
      this.prisma.clientActivity.findMany({
        where: activityScope,
        select: { type: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where:
          user.role === UserRole.ADMIN
            ? { role: UserRole.MANAGER, isActive: true }
            : { id: -1 },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const pipeline = Object.values(DealStage).map((stage) => {
      const rows = dealRows.filter((deal) => deal.stage === stage);
      return {
        stage,
        count: rows.length,
        values: this.sumByCurrency(rows),
      };
    });
    const wonRows = dealRows.filter((deal) => deal.stage === DealStage.WON);
    const lostRows = dealRows.filter((deal) => deal.stage === DealStage.LOST);
    const doneTasks = taskRows.filter((task) => task.status === TaskStatus.DONE);
    const openTasks = taskRows.filter((task) =>
      openTaskStatuses.includes(task.status),
    );
    const overdueTasks = openTasks.filter(
      (task) => task.dueAt && task.dueAt < now,
    );
    const terminalTaskStatuses: TaskStatus[] = [
      TaskStatus.DONE,
      TaskStatus.CANCELLED,
    ];
    const completedOrCancelled = taskRows.filter((task) =>
      terminalTaskStatuses.includes(task.status),
    );

    const activityTypes = Object.values(ActivityType)
      .map((type) => ({
        type,
        count: activityRows.filter((activity) => activity.type === type).length,
      }))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count);

    const team = managers
      .map((manager) => {
        const managerTasks = taskRows.filter(
          (task) => task.assigneeId === manager.id,
        );
        return {
          id: manager.id,
          name: manager.name,
          clients: clientRows.filter(
            (client) => client.managerId === manager.id,
          ).length,
          wonDeals: wonRows.filter(
            (deal) => deal.client.managerId === manager.id,
          ).length,
          openTasks: managerTasks.filter((task) =>
            openTaskStatuses.includes(task.status),
          ).length,
          completedTasks: managerTasks.filter(
            (task) => task.status === TaskStatus.DONE,
          ).length,
          overdueTasks: managerTasks.filter(
            (task) =>
              openTaskStatuses.includes(task.status) &&
              task.dueAt &&
              task.dueAt < now,
          ).length,
        };
      })
      .sort(
        (left, right) =>
          right.wonDeals +
          right.completedTasks -
          (left.wonDeals + left.completedTasks),
      );

    return {
      scope: user.role === UserRole.ADMIN ? 'TEAM' : 'PERSONAL',
      period,
      generatedAt: now,
      metrics: {
        activeClients,
        newClients,
        conversionRate: activeClients
          ? Math.round((convertedClients / activeClients) * 100)
          : 0,
        totalDeals: dealRows.length,
        wonDeals: wonRows.length,
        dealWinRate:
          wonRows.length + lostRows.length
            ? Math.round(
                (wonRows.length / (wonRows.length + lostRows.length)) * 100,
              )
            : 0,
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
        taskCompletionRate: completedOrCancelled.length
          ? Math.round((doneTasks.length / completedOrCancelled.length) * 100)
          : 0,
        activities: activityRows.length,
      },
      statuses: statuses
        .map((item) => ({
          status: item.status,
          count: item._count._all,
        }))
        .sort((left, right) => right.count - left.count),
      sources: sources
        .filter((item) => item.source)
        .map((item) => ({
          source: item.source as string,
          count: item._count._all,
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      pipeline,
      revenue: this.sumByCurrency(wonRows),
      tasks: {
        total: taskRows.length,
        open: openTasks.length,
        done: doneTasks.length,
        cancelled: taskRows.filter(
          (task) => task.status === TaskStatus.CANCELLED,
        ).length,
        overdue: overdueTasks.length,
      },
      activityTypes,
      trend: this.buildTrend(
        period,
        periodStart,
        newClientRows,
        dealRows,
        activityRows,
      ),
      team,
    };
  }

  private sumByCurrency(
    rows: { currency: string; amount: Prisma.Decimal }[],
  ) {
    const totals = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const current = totals.get(row.currency) ?? new Prisma.Decimal(0);
      totals.set(row.currency, current.add(row.amount));
    }
    return Array.from(totals, ([currency, amount]) => ({
      currency,
      amount: amount.toString(),
    }));
  }

  private buildTrend(
    period: number,
    periodStart: Date,
    clients: { createdAt: Date }[],
    deals: { createdAt: Date }[],
    activities: { createdAt: Date }[],
  ) {
    const bucketCount = period <= 30 ? 10 : 12;
    const bucketSize = Math.ceil(period / bucketCount);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(periodStart);
      start.setUTCDate(start.getUTCDate() + index * bucketSize);
      return { start, clients: 0, deals: 0, activities: 0 };
    });

    const addRows = (
      rows: { createdAt: Date }[],
      key: 'clients' | 'deals' | 'activities',
    ) => {
      for (const row of rows) {
        const days = Math.max(
          0,
          Math.floor(
            (row.createdAt.getTime() - periodStart.getTime()) / 86_400_000,
          ),
        );
        const index = Math.min(
          buckets.length - 1,
          Math.floor(days / bucketSize),
        );
        buckets[index][key] += 1;
      }
    };

    addRows(clients, 'clients');
    addRows(deals, 'deals');
    addRows(activities, 'activities');

    return buckets.map((bucket) => ({
      label: new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
        .format(bucket.start)
        .replace('.', ''),
      clients: bucket.clients,
      deals: bucket.deals,
      activities: bucket.activities,
    }));
  }
}
