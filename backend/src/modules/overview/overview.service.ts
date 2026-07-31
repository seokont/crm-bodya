import { Injectable } from '@nestjs/common';
import { ClientStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';

const inWorkStatuses: ClientStatus[] = [
  ClientStatus.NO_ANSWER,
  ClientStatus.CALL_LATER,
  ClientStatus.FUTURE_PROSPECT,
  ClientStatus.INTERESTED,
  ClientStatus.SIGNED_CONTRACT,
  ClientStatus.PARTIALLY_PAID,
];

const recentClientSelect = {
  id: true,
  type: true,
  companyName: true,
  contactName: true,
  status: true,
  source: true,
  city: true,
  createdAt: true,
  manager: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientSelect;

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(user: AuthUser, period: number) {
    const now = new Date();
    const periodStart = this.startOfUtcDay(now, period - 1);
    const previousPeriodStart = this.startOfUtcDay(now, period * 2 - 1);
    const managerScope: Prisma.ClientWhereInput =
      user.role === UserRole.MANAGER ? { managerId: user.id } : {};
    const activeScope: Prisma.ClientWhereInput = {
      ...managerScope,
      isArchived: false,
    };

    const [
      activeClients,
      archivedClients,
      newClients,
      previousNewClients,
      inWorkClients,
      unassignedClients,
      statusGroups,
      sourceGroups,
      recentClients,
      activityClients,
      managers,
    ] = await Promise.all([
      this.prisma.client.count({ where: activeScope }),
      this.prisma.client.count({
        where: { ...managerScope, isArchived: true },
      }),
      this.prisma.client.count({
        where: {
          ...managerScope,
          createdAt: { gte: periodStart, lte: now },
        },
      }),
      this.prisma.client.count({
        where: {
          ...managerScope,
          createdAt: { gte: previousPeriodStart, lt: periodStart },
        },
      }),
      this.prisma.client.count({
        where: {
          ...activeScope,
          status: { in: inWorkStatuses },
        },
      }),
      this.prisma.client.count({
        where: {
          ...activeScope,
          managerId: null,
        },
      }),
      this.prisma.client.groupBy({
        by: ['status'],
        where: activeScope,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.client.groupBy({
        by: ['source'],
        where: {
          ...activeScope,
          source: { not: null },
        },
        orderBy: { source: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.client.findMany({
        where: activeScope,
        select: recentClientSelect,
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.client.findMany({
        where: {
          ...managerScope,
          createdAt: { gte: periodStart, lte: now },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where:
          user.role === UserRole.ADMIN
            ? {
                role: UserRole.MANAGER,
                isActive: true,
              }
            : { id: -1 },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              clients: {
                where: { isArchived: false },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const sources = sourceGroups
      .filter((item) => item.source)
      .map((item) => ({
        source: item.source as string,
        count: item._count._all,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);

    const team = managers
      .map((manager) => ({
        id: manager.id,
        name: manager.name,
        clients: manager._count.clients,
      }))
      .sort((left, right) => right.clients - left.clients);

    return {
      scope: user.role === UserRole.ADMIN ? 'TEAM' : 'PERSONAL',
      period,
      generatedAt: now,
      metrics: {
        activeClients,
        newClients,
        newClientsChange: this.calculateChange(
          newClients,
          previousNewClients,
        ),
        inWorkClients,
        archivedClients,
        unassignedClients:
          user.role === UserRole.ADMIN ? unassignedClients : 0,
      },
      statuses: statusGroups
        .map((item) => ({
          status: item.status,
          count: item._count._all,
        }))
        .sort((left, right) => right.count - left.count),
      sources,
      activity: this.buildActivity(activityClients, period, periodStart),
      team,
      recentClients,
    };
  }

  private calculateChange(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
  }

  private startOfUtcDay(now: Date, daysAgo: number) {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysAgo,
      ),
    );
  }

  private buildActivity(
    clients: { createdAt: Date }[],
    period: number,
    periodStart: Date,
  ) {
    const bucketSize = period === 7 ? 1 : period === 30 ? 5 : 15;
    const bucketCount = Math.ceil(period / bucketSize);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(periodStart);
      start.setUTCDate(start.getUTCDate() + index * bucketSize);
      return {
        start,
        count: 0,
      };
    });

    for (const client of clients) {
      const daysFromStart = Math.max(
        0,
        Math.floor(
          (client.createdAt.getTime() - periodStart.getTime()) / 86_400_000,
        ),
      );
      const bucketIndex = Math.min(
        buckets.length - 1,
        Math.floor(daysFromStart / bucketSize),
      );
      buckets[bucketIndex].count += 1;
    }

    return buckets.map((bucket) => ({
      label: new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
        .format(bucket.start)
        .replace('.', ''),
      count: bucket.count,
    }));
  }
}
