import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';
import { ChatMessagesQueryDto } from './dto/chat-messages-query.dto';
import { CreateTeamMessageDto } from './dto/create-team-message.dto';
import { UpdateTeamMessageDto } from './dto/update-team-message.dto';

const messageSelect = {
  id: true,
  content: true,
  authorId: true,
  authorName: true,
  recipientId: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  },
  recipient: {
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.TeamMessageSelect;

export type TeamMessageResult = Prisma.TeamMessageGetPayload<{
  select: typeof messageSelect;
}>;

@Injectable()
export class TeamChatService {
  constructor(private readonly prisma: PrismaService) {}

  async findMessages(query: ChatMessagesQueryDto, user: AuthUser) {
    if (query.afterId && query.beforeId) {
      throw new BadRequestException(
        'Не можна одночасно вказувати afterId і beforeId',
      );
    }

    const limit = query.limit || 80;
    const isForward = Boolean(query.afterId);
    const idWhere: Prisma.TeamMessageWhereInput = query.afterId
      ? { id: { gt: query.afterId } }
      : query.beforeId
        ? { id: { lt: query.beforeId } }
        : {};
    const conversationWhere: Prisma.TeamMessageWhereInput = query.partnerId
      ? {
          OR: [
            { authorId: user.id, recipientId: query.partnerId },
            { authorId: query.partnerId, recipientId: user.id },
          ],
        }
      : { recipientId: null };

    const rows = await this.prisma.teamMessage.findMany({
      where: { AND: [conversationWhere, idWhere] },
      select: messageSelect,
      orderBy: { id: isForward ? 'asc' : 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    return {
      items: isForward ? page : page.reverse(),
      hasMore,
    };
  }

  findMembers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async findConversations(user: AuthUser) {
    const members = await this.prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    const [general, privateConversations] = await Promise.all([
      this.prisma.teamMessage.findFirst({
        where: { recipientId: null },
        select: messageSelect,
        orderBy: { id: 'desc' },
      }),
      Promise.all(
        members.map(async (partner) => ({
          partner,
          latestMessage: await this.prisma.teamMessage.findFirst({
            where: {
              OR: [
                { authorId: user.id, recipientId: partner.id },
                { authorId: partner.id, recipientId: user.id },
              ],
            },
            select: messageSelect,
            orderBy: { id: 'desc' },
          }),
        })),
      ),
    ]);

    return { general, private: privateConversations };
  }

  async create(dto: CreateTeamMessageDto, user: AuthUser) {
    const content = this.cleanContent(dto.content);
    if (dto.recipientId === user.id) {
      throw new BadRequestException('Не можна надіслати повідомлення самому собі');
    }
    if (dto.recipientId) {
      const recipient = await this.prisma.user.findFirst({
        where: { id: dto.recipientId, isActive: true },
        select: { id: true },
      });
      if (!recipient) throw new NotFoundException('Адресата не знайдено');
    }

    return this.prisma.teamMessage.create({
      data: {
        content,
        authorId: user.id,
        authorName: user.name,
        recipientId: dto.recipientId || null,
      },
      select: messageSelect,
    });
  }

  async update(
    id: number,
    dto: UpdateTeamMessageDto,
    user: AuthUser,
  ) {
    const message = await this.findForMutation(id, user);
    return this.prisma.teamMessage.update({
      where: { id: message.id },
      data: { content: this.cleanContent(dto.content) },
      select: messageSelect,
    });
  }

  async remove(id: number, user: AuthUser) {
    const message = await this.findForMutation(id, user);
    await this.prisma.teamMessage.delete({ where: { id: message.id } });
    return {
      success: true,
      id: message.id,
      authorId: message.authorId,
      recipientId: message.recipientId,
    };
  }

  private cleanContent(content: string) {
    if (typeof content !== 'string') {
      throw new BadRequestException('Вкажіть текст повідомлення');
    }
    const value = content.trim();
    if (!value) throw new BadRequestException('Повідомлення не може бути порожнім');
    if (value.length > 5000) {
      throw new BadRequestException(
        'Повідомлення не може перевищувати 5000 символів',
      );
    }
    return value;
  }

  private async findForMutation(id: number, user: AuthUser) {
    const message = await this.prisma.teamMessage.findUnique({
      where: { id },
      select: { id: true, authorId: true, recipientId: true },
    });
    if (!message) throw new NotFoundException('Повідомлення не знайдено');
    const isPrivate = message.recipientId !== null;
    const canManage =
      message.authorId === user.id ||
      (!isPrivate && user.role === UserRole.ADMIN);
    if (!canManage) {
      throw new ForbiddenException(
        'Ви можете змінювати лише власні повідомлення',
      );
    }
    return message;
  }
}
