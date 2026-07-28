import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  ClientStatus,
  DealStage,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';
import {
  ClientFilterDto,
  ClientSortBy,
} from './dto/client-filter.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateClientActivityDto } from './dto/create-client-activity.dto';
import { CreateClientDealDto } from './dto/create-client-deal.dto';
import { DuplicateClientQueryDto } from './dto/duplicate-client-query.dto';
import { DealFilterDto, DealSortBy } from './dto/deal-filter.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientDealDto } from './dto/update-client-deal.dto';

const clientInclude = {
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.ClientInclude;

const activitySelect = {
  id: true,
  type: true,
  content: true,
  occurredAt: true,
  clientId: true,
  authorId: true,
  authorName: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientActivitySelect;

const dealSelect = {
  id: true,
  title: true,
  amount: true,
  currency: true,
  stage: true,
  expectedCloseAt: true,
  description: true,
  clientId: true,
  ownerId: true,
  ownerName: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientDealSelect;

const globalDealSelect = {
  ...dealSelect,
  client: {
    select: {
      id: true,
      companyName: true,
      contactName: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ClientDealSelect;

const statusLabels: Record<ClientStatus, string> = {
  NEW: 'Новий',
  IN_PROGRESS: 'У роботі',
  CONTACTED: "Зв'язалися",
  WAITING: 'Очікує рішення',
  INTERESTED: 'Зацікавлений',
  NOT_INTERESTED: 'Не зацікавлений',
  CLIENT: 'Клієнт',
  REJECTED: 'Відмова',
  ARCHIVED: 'Архів',
};

const dealStageLabels: Record<DealStage, string> = {
  NEW: 'Нова',
  QUALIFICATION: 'Кваліфікація',
  PROPOSAL: 'Пропозиція',
  NEGOTIATION: 'Переговори',
  WON: 'Успішна',
  LOST: 'Втрачена',
};

const protectedActivityTypes: ActivityType[] = [
  ActivityType.SYSTEM,
  ActivityType.STATUS_CHANGE,
];

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findDuplicates(query: DuplicateClientQueryDto) {
    const companyName = query.companyName?.trim();
    const edrpou = query.edrpou?.trim();
    const conditions: Prisma.ClientWhereInput[] = [];

    if (companyName) conditions.push({ companyName: { equals: companyName } });
    if (edrpou) conditions.push({ edrpou: { equals: edrpou } });

    if (!conditions.length) return { duplicates: [] };

    const clients = await this.prisma.client.findMany({
      where: { OR: conditions },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        edrpou: true,
        status: true,
        isArchived: true,
        manager: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      duplicates: clients.map((client) => ({
        ...client,
        matchedBy: [
          ...(companyName &&
          client.companyName?.localeCompare(companyName, 'uk', {
            sensitivity: 'accent',
          }) === 0
            ? ['COMPANY_NAME' as const]
            : []),
          ...(edrpou && client.edrpou === edrpou
            ? ['EDRPOU' as const]
            : []),
        ],
      })),
    };
  }

  async findAll(filters: ClientFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const where = this.buildWhere(filters);
    const orderBy = this.buildOrderBy(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: clientInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, isArchived: false },
      include: clientInclude,
    });

    if (!client) {
      throw new NotFoundException(`Клієнта з ID ${id} не знайдено`);
    }

    return client;
  }

  async create(dto: CreateClientDto, user: AuthUser) {
    const { managerId, ...data } = dto;

    return this.prisma.$transaction(async (transaction) => {
      const client = await transaction.client.create({
        data: {
          ...data,
          manager: managerId ? { connect: { id: managerId } } : undefined,
        },
        include: clientInclude,
      });
      await transaction.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: 'Клієнта додано до CRM',
          clientId: client.id,
          authorId: user.id,
          authorName: user.name,
        },
      });
      return client;
    });
  }

  async update(id: number, dto: UpdateClientDto, user: AuthUser) {
    const current = await this.findOne(id);
    const { managerId, ...data } = dto;

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.client.update({
        where: { id },
        data: {
          ...data,
          ...(managerId !== undefined
            ? {
                manager:
                  managerId === null
                    ? { disconnect: true }
                    : { connect: { id: managerId } },
              }
            : {}),
        },
        include: clientInclude,
      });

      const activities: Prisma.ClientActivityCreateManyInput[] = [];
      if (dto.status && dto.status !== current.status) {
        activities.push({
          type: ActivityType.STATUS_CHANGE,
          content: `Статус змінено: «${statusLabels[current.status]}» → «${statusLabels[dto.status]}»`,
          clientId: id,
          authorId: user.id,
          authorName: user.name,
        });
      }
      if (
        managerId !== undefined &&
        managerId !== current.managerId
      ) {
        activities.push({
          type: ActivityType.SYSTEM,
          content: `Відповідального змінено: ${current.manager?.name || 'не призначено'} → ${updated.manager?.name || 'не призначено'}`,
          clientId: id,
          authorId: user.id,
          authorName: user.name,
        });
      }
      if (activities.length) {
        await transaction.clientActivity.createMany({ data: activities });
      }

      return updated;
    });
  }

  async archive(id: number, user: AuthUser) {
    const current = await this.findOne(id);

    return this.prisma.$transaction(async (transaction) => {
      const archived = await transaction.client.update({
        where: { id },
        data: {
          isArchived: true,
          status: ClientStatus.ARCHIVED,
        },
        include: clientInclude,
      });
      await transaction.clientActivity.create({
        data: {
          type: ActivityType.STATUS_CHANGE,
          content: `Статус змінено: «${statusLabels[current.status]}» → «Архів»`,
          clientId: id,
          authorId: user.id,
          authorName: user.name,
        },
      });
      return archived;
    });
  }

  async findActivities(id: number) {
    await this.findOne(id);
    return this.prisma.clientActivity.findMany({
      where: { clientId: id },
      select: activitySelect,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async createActivity(
    id: number,
    dto: CreateClientActivityDto,
    user: AuthUser,
  ) {
    await this.findOne(id);
    return this.prisma.clientActivity.create({
      data: {
        type: dto.type,
        content: dto.content.trim(),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        clientId: id,
        authorId: user.id,
        authorName: user.name,
      },
      select: activitySelect,
    });
  }

  async removeActivity(
    clientId: number,
    activityId: number,
    user: AuthUser,
  ) {
    const activity = await this.prisma.clientActivity.findFirst({
      where: { id: activityId, clientId },
      select: {
        id: true,
        type: true,
        authorId: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Запис активності не знайдено');
    }

    const isSystemActivity = protectedActivityTypes.includes(activity.type);
    if (
      user.role !== UserRole.ADMIN &&
      (isSystemActivity || activity.authorId !== user.id)
    ) {
      throw new ForbiddenException(
        'Ви не можете видалити цей запис активності',
      );
    }

    await this.prisma.clientActivity.delete({
      where: { id: activity.id },
    });
    return { success: true };
  }

  async findDeals(clientId: number) {
    await this.findOne(clientId);
    return this.prisma.clientDeal.findMany({
      where: { clientId },
      select: dealSelect,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findAllDeals(filters: DealFilterDto, user: AuthUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const conditions: Prisma.ClientDealWhereInput[] = [
      { client: { isArchived: false } },
    ];

    if (user.role !== UserRole.ADMIN) {
      conditions.push({
        OR: [
          { ownerId: user.id },
          { client: { managerId: user.id } },
        ],
      });
    }
    if (filters.search) {
      conditions.push({
        OR: [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
          { client: { companyName: { contains: filters.search } } },
          { client: { contactName: { contains: filters.search } } },
        ],
      });
    }
    if (filters.stage?.length) {
      conditions.push({ stage: { in: filters.stage } });
    }
    if (filters.currency) {
      conditions.push({ currency: filters.currency });
    }
    if (filters.managerId) {
      conditions.push({ client: { managerId: filters.managerId } });
    }

    const where: Prisma.ClientDealWhereInput = { AND: conditions };
    const orderBy: Prisma.ClientDealOrderByWithRelationInput = {
      [filters.sortBy ?? DealSortBy.UPDATED_AT]: filters.sortOrder ?? 'desc',
    };

    const [items, total, summaryRows] = await this.prisma.$transaction([
      this.prisma.clientDeal.findMany({
        where,
        select: globalDealSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clientDeal.count({ where }),
      this.prisma.clientDeal.findMany({
        where,
        select: {
          stage: true,
          currency: true,
          amount: true,
        },
      }),
    ]);

    const activeStages: DealStage[] = [
      DealStage.NEW,
      DealStage.QUALIFICATION,
      DealStage.PROPOSAL,
      DealStage.NEGOTIATION,
    ];
    const activeValue = new Map<string, Prisma.Decimal>();
    for (const row of summaryRows) {
      if (activeStages.includes(row.stage)) {
        const current = activeValue.get(row.currency) ?? new Prisma.Decimal(0);
        activeValue.set(row.currency, current.add(row.amount));
      }
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total,
        open: summaryRows.filter((row) => activeStages.includes(row.stage))
          .length,
        won: summaryRows.filter((row) => row.stage === DealStage.WON).length,
        lost: summaryRows.filter((row) => row.stage === DealStage.LOST).length,
        activeValue: Array.from(activeValue, ([currency, amount]) => ({
          currency,
          amount: amount.toString(),
        })),
      },
    };
  }

  findDealClientOptions(user: AuthUser) {
    return this.prisma.client.findMany({
      where: {
        isArchived: false,
        ...(user.role === UserRole.ADMIN ? {} : { managerId: user.id }),
      },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ companyName: 'asc' }, { contactName: 'asc' }],
    });
  }

  async createDeal(
    clientId: number,
    dto: CreateClientDealDto,
    user: AuthUser,
  ) {
    await this.findOne(clientId);

    return this.prisma.$transaction(async (transaction) => {
      const deal = await transaction.clientDeal.create({
        data: {
          title: dto.title.trim(),
          amount: dto.amount,
          currency: dto.currency ?? 'UAH',
          stage: dto.stage ?? DealStage.NEW,
          expectedCloseAt: dto.expectedCloseAt
            ? new Date(dto.expectedCloseAt)
            : null,
          description: dto.description?.trim() || null,
          clientId,
          ownerId: user.id,
          ownerName: user.name,
        },
        select: dealSelect,
      });
      await transaction.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Створено угоду «${deal.title}» на суму ${deal.amount.toString()} ${deal.currency}`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        },
      });
      return deal;
    });
  }

  async updateDeal(
    clientId: number,
    dealId: number,
    dto: UpdateClientDealDto,
    user: AuthUser,
  ) {
    const current = await this.findDealForMutation(clientId, dealId, user);

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.clientDeal.update({
        where: { id: dealId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.stage !== undefined ? { stage: dto.stage } : {}),
          ...(dto.expectedCloseAt !== undefined
            ? {
                expectedCloseAt: dto.expectedCloseAt
                  ? new Date(dto.expectedCloseAt)
                  : null,
              }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
        },
        select: dealSelect,
      });

      if (dto.stage && dto.stage !== current.stage) {
        await transaction.clientActivity.create({
          data: {
            type: ActivityType.SYSTEM,
            content: `Етап угоди «${updated.title}» змінено: «${dealStageLabels[current.stage]}» → «${dealStageLabels[dto.stage]}»`,
            clientId,
            authorId: user.id,
            authorName: user.name,
          },
        });
      }
      return updated;
    });
  }

  async removeDeal(clientId: number, dealId: number, user: AuthUser) {
    const deal = await this.findDealForMutation(clientId, dealId, user);

    await this.prisma.$transaction([
      this.prisma.clientDeal.delete({ where: { id: deal.id } }),
      this.prisma.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Угоду «${deal.title}» видалено`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        },
      }),
    ]);
    return { success: true };
  }

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException(`Клієнта з ID ${id} не знайдено`);
    }

    await this.prisma.client.delete({ where: { id } });
    return { success: true };
  }

  private async findDealForMutation(
    clientId: number,
    dealId: number,
    user: AuthUser,
  ) {
    const deal = await this.prisma.clientDeal.findFirst({
      where: { id: dealId, clientId },
      select: {
        id: true,
        title: true,
        stage: true,
        ownerId: true,
        client: {
          select: {
            managerId: true,
          },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException('Угоду не знайдено');
    }
    if (
      user.role !== UserRole.ADMIN &&
      deal.ownerId !== user.id &&
      deal.client.managerId !== user.id
    ) {
      throw new ForbiddenException('Ви не можете змінювати цю угоду');
    }
    return deal;
  }

  private buildWhere(filters: ClientFilterDto): Prisma.ClientWhereInput {
    const where: Prisma.ClientWhereInput = { isArchived: false };

    if (filters.search) {
      where.OR = [
        { companyName: { contains: filters.search } },
        { contactName: { contains: filters.search } },
        { phone: { contains: filters.search } },
        { secondaryPhone: { contains: filters.search } },
        { email: { contains: filters.search } },
        { edrpou: { contains: filters.search } },
      ];
    }

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters.managerId) {
      where.managerId = filters.managerId;
    }

    if (filters.source?.length) {
      where.source = { in: filters.source };
    }

    if (filters.city) {
      where.city = { contains: filters.city };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom
          ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) }
          : {}),
        ...(filters.dateTo
          ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) }
          : {}),
      };
    }

    return where;
  }

  private buildOrderBy(
    filters: ClientFilterDto,
  ): Prisma.ClientOrderByWithRelationInput {
    const order = filters.sortOrder ?? 'desc';

    switch (filters.sortBy) {
      case ClientSortBy.NAME:
        return { companyName: order };
      case ClientSortBy.UPDATED_AT:
        return { updatedAt: order };
      case ClientSortBy.STATUS:
        return { status: order };
      case ClientSortBy.MANAGER:
        return { manager: { name: order } };
      case ClientSortBy.CITY:
        return { city: order };
      case ClientSortBy.CREATED_AT:
      default:
        return { createdAt: order };
    }
  }
}
