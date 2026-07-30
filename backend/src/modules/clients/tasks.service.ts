import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  Prisma,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';
import { CreateClientTaskDto } from './dto/create-client-task.dto';
import {
  TaskDueFilter,
  TaskFilterDto,
  TaskSortBy,
} from './dto/task-filter.dto';
import { UpdateClientTaskDto } from './dto/update-client-task.dto';

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  clientId: true,
  assigneeId: true,
  assigneeName: true,
  creatorId: true,
  creatorName: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  creator: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientTaskSelect;

const globalTaskSelect = {
  ...taskSelect,
  client: {
    select: {
      id: true,
      companyName: true,
      contactName: true,
      managerId: true,
      creatorId: true,
      manager: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ClientTaskSelect;

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'Заплановано',
  IN_PROGRESS: 'У роботі',
  DONE: 'Виконано',
  CANCELLED: 'Скасовано',
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clientId: number) {
    await this.ensureClient(clientId);
    return this.prisma.clientTask.findMany({
      where: { clientId },
      select: taskSelect,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findAllGlobal(filters: TaskFilterDto, user: AuthUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const scopeConditions = this.taskScopeConditions(user);
    const conditions: Prisma.ClientTaskWhereInput[] = [...scopeConditions];

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
    if (filters.status?.length) {
      conditions.push({ status: { in: filters.status } });
    }
    if (filters.priority?.length) {
      conditions.push({ priority: { in: filters.priority } });
    }
    if (filters.assigneeId) {
      conditions.push({ assigneeId: filters.assigneeId });
    }
    if (filters.clientId) {
      conditions.push({ clientId: filters.clientId });
    }

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const openStatuses: TaskStatus[] = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
    ];

    if (filters.due === TaskDueFilter.OVERDUE) {
      conditions.push({ status: { in: openStatuses }, dueAt: { lt: now } });
    } else if (filters.due === TaskDueFilter.TODAY) {
      conditions.push({
        status: { in: openStatuses },
        dueAt: { gte: todayStart, lt: tomorrow },
      });
    } else if (filters.due === TaskDueFilter.UPCOMING) {
      conditions.push({
        status: { in: openStatuses },
        dueAt: { gte: tomorrow },
      });
    } else if (filters.due === TaskDueFilter.NO_DUE_DATE) {
      conditions.push({ dueAt: null });
    }

    const where: Prisma.ClientTaskWhereInput = { AND: conditions };
    const summaryWhere: Prisma.ClientTaskWhereInput = {
      AND: scopeConditions,
    };
    const orderBy: Prisma.ClientTaskOrderByWithRelationInput =
      filters.sortBy === TaskSortBy.DUE_AT
        ? { dueAt: filters.sortOrder }
        : { [filters.sortBy]: filters.sortOrder };

    const [items, total, summaryTotal, open, done, overdue, today] =
      await this.prisma.$transaction([
        this.prisma.clientTask.findMany({
          where,
          select: globalTaskSelect,
          orderBy: [orderBy, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.clientTask.count({ where }),
        this.prisma.clientTask.count({ where: summaryWhere }),
        this.prisma.clientTask.count({
          where: { AND: [...scopeConditions, { status: { in: openStatuses } }] },
        }),
        this.prisma.clientTask.count({
          where: { AND: [...scopeConditions, { status: TaskStatus.DONE }] },
        }),
        this.prisma.clientTask.count({
          where: {
            AND: [
              ...scopeConditions,
              { status: { in: openStatuses }, dueAt: { lt: now } },
            ],
          },
        }),
        this.prisma.clientTask.count({
          where: {
            AND: [
              ...scopeConditions,
              {
                status: { in: openStatuses },
                dueAt: { gte: todayStart, lt: tomorrow },
              },
            ],
          },
        }),
      ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: { total: summaryTotal, open, done, overdue, today },
    };
  }

  findTaskClientOptions(user: AuthUser) {
    return this.prisma.client.findMany({
      where: {
        isArchived: false,
        ...(user.role === UserRole.ADMIN
          ? {}
          : {
              OR: [{ managerId: user.id }, { creatorId: user.id }],
            }),
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

  async create(clientId: number, dto: CreateClientTaskDto, user: AuthUser) {
    const client = await this.ensureClient(clientId);
    const assigneeId =
      dto.assigneeId ??
      client.managerId ??
      (user.role === UserRole.MANAGER ? user.id : null);
    const assignee = assigneeId
      ? await this.ensureAssignee(assigneeId)
      : null;
    const status = dto.status ?? TaskStatus.TODO;

    return this.prisma.$transaction(async (transaction) => {
      const task = await transaction.clientTask.create({
        data: {
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          status,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          completedAt: status === TaskStatus.DONE ? new Date() : null,
          clientId,
          assigneeId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          creatorId: user.id,
          creatorName: user.name,
        },
        select: taskSelect,
      });
      await transaction.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Створено завдання «${task.title}»${task.assigneeName ? ` для ${task.assigneeName}` : ''}`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        },
      });
      return task;
    });
  }

  async update(
    clientId: number,
    taskId: number,
    dto: UpdateClientTaskDto,
    user: AuthUser,
  ) {
    const current = await this.findForMutation(clientId, taskId, user);
    const assignee =
      dto.assigneeId !== undefined && dto.assigneeId !== null
        ? await this.ensureAssignee(dto.assigneeId)
        : null;

    return this.prisma.$transaction(async (transaction) => {
      const task = await transaction.clientTask.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.status !== undefined
            ? {
                status: dto.status,
                completedAt:
                  dto.status === TaskStatus.DONE
                    ? current.completedAt ?? new Date()
                    : null,
              }
            : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.dueAt !== undefined
            ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
            : {}),
          ...(dto.assigneeId !== undefined
            ? {
                assigneeId: assignee?.id ?? null,
                assigneeName: assignee?.name ?? null,
              }
            : {}),
        },
        select: taskSelect,
      });

      const events: Prisma.ClientActivityCreateManyInput[] = [];
      if (dto.status && dto.status !== current.status) {
        events.push({
          type: ActivityType.SYSTEM,
          content: `Статус завдання «${task.title}» змінено: «${taskStatusLabels[current.status]}» → «${taskStatusLabels[dto.status]}»`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        });
      }
      if (
        dto.assigneeId !== undefined &&
        (assignee?.id ?? null) !== current.assigneeId
      ) {
        events.push({
          type: ActivityType.SYSTEM,
          content: `Відповідального за завдання «${task.title}» змінено: ${current.assigneeName || 'не призначено'} → ${assignee?.name || 'не призначено'}`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        });
      }
      if (events.length) {
        await transaction.clientActivity.createMany({ data: events });
      }
      return task;
    });
  }

  async remove(clientId: number, taskId: number, user: AuthUser) {
    const task = await this.findForMutation(clientId, taskId, user);
    await this.prisma.$transaction([
      this.prisma.clientTask.delete({ where: { id: task.id } }),
      this.prisma.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Завдання «${task.title}» видалено`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        },
      }),
    ]);
    return { success: true };
  }

  private async ensureClient(clientId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, isArchived: false },
      select: { id: true, managerId: true },
    });
    if (!client) {
      throw new NotFoundException(`Клієнта з ID ${clientId} не знайдено`);
    }
    return client;
  }

  private async ensureAssignee(id: number) {
    const manager = await this.prisma.user.findFirst({
      where: { id, role: UserRole.MANAGER, isActive: true },
      select: { id: true, name: true },
    });
    if (!manager) {
      throw new NotFoundException('Активного менеджера не знайдено');
    }
    return manager;
  }

  private async findForMutation(
    clientId: number,
    taskId: number,
    user: AuthUser,
  ) {
    const task = await this.prisma.clientTask.findFirst({
      where: { id: taskId, clientId },
      select: {
        id: true,
        title: true,
        status: true,
        completedAt: true,
        assigneeId: true,
        assigneeName: true,
        creatorId: true,
        client: {
          select: { managerId: true },
        },
      },
    });
    if (!task) throw new NotFoundException('Завдання не знайдено');
    if (
      user.role !== UserRole.ADMIN &&
      task.creatorId !== user.id &&
      task.assigneeId !== user.id &&
      task.client.managerId !== user.id
    ) {
      throw new ForbiddenException('Ви не можете змінювати це завдання');
    }
    return task;
  }

  private taskScopeConditions(user: AuthUser): Prisma.ClientTaskWhereInput[] {
    const conditions: Prisma.ClientTaskWhereInput[] = [
      { client: { isArchived: false } },
    ];
    if (user.role !== UserRole.ADMIN) {
      conditions.push({
        OR: [
          { assigneeId: user.id },
          { creatorId: user.id },
          { client: { managerId: user.id } },
        ],
      });
    }
    return conditions;
  }
}
