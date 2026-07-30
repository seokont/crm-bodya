import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';
import { CreateClientCommentDto } from './dto/create-client-comment.dto';
import { UpdateClientCommentDto } from './dto/update-client-comment.dto';

const commentSelect = {
  id: true,
  content: true,
  clientId: true,
  authorId: true,
  authorName: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientCommentSelect;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clientId: number) {
    await this.ensureClient(clientId);
    return this.prisma.clientComment.findMany({
      where: { clientId },
      select: commentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async create(
    clientId: number,
    dto: CreateClientCommentDto,
    user: AuthUser,
  ) {
    await this.ensureClient(clientId);
    return this.prisma.clientComment.create({
      data: {
        content: dto.content.trim(),
        clientId,
        authorId: user.id,
        authorName: user.name,
      },
      select: commentSelect,
    });
  }

  async update(
    clientId: number,
    commentId: number,
    dto: UpdateClientCommentDto,
    user: AuthUser,
  ) {
    const comment = await this.findForMutation(clientId, commentId, user);
    return this.prisma.clientComment.update({
      where: { id: comment.id },
      data: { content: dto.content.trim() },
      select: commentSelect,
    });
  }

  async remove(clientId: number, commentId: number, user: AuthUser) {
    const comment = await this.findForMutation(clientId, commentId, user);
    await this.prisma.clientComment.delete({ where: { id: comment.id } });
    return { success: true };
  }

  private async ensureClient(clientId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, isArchived: false },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Клієнта з ID ${clientId} не знайдено`);
    }
  }

  private async findForMutation(
    clientId: number,
    commentId: number,
    user: AuthUser,
  ) {
    const comment = await this.prisma.clientComment.findFirst({
      where: { id: commentId, clientId },
      select: { id: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Коментар не знайдено');
    if (user.role !== UserRole.ADMIN && comment.authorId !== user.id) {
      throw new ForbiddenException(
        'Ви можете змінювати лише власні коментарі',
      );
    }
    return comment;
  }
}
