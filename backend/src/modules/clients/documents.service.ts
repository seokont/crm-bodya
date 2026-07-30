import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  DocumentCategory,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user.interface';
import { CreateClientDocumentDto } from './dto/create-client-document.dto';
import { UpdateClientDocumentDto } from './dto/update-client-document.dto';

export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const documentSelect = {
  id: true,
  title: true,
  originalName: true,
  mimeType: true,
  size: true,
  category: true,
  description: true,
  clientId: true,
  uploaderId: true,
  uploaderName: true,
  createdAt: true,
  updatedAt: true,
  uploader: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientDocumentSelect;

@Injectable()
export class DocumentsService {
  private readonly documentsDir = resolve(
    process.env.DOCUMENTS_DIR || 'uploads/documents',
  );

  constructor(private readonly prisma: PrismaService) {}

  async findAll(clientId: number) {
    await this.ensureClient(clientId);
    return this.prisma.clientDocument.findMany({
      where: { clientId },
      select: documentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async create(
    clientId: number,
    dto: CreateClientDocumentDto,
    file: UploadedDocumentFile | undefined,
    user: AuthUser,
  ) {
    await this.ensureClient(clientId);
    if (!file) {
      throw new BadRequestException('Оберіть файл для завантаження');
    }

    const originalName = this.cleanOriginalName(file.originalname);
    const extension = extname(originalName).toLowerCase();
    const storedName = `${randomUUID()}${extension}`;
    const filePath = this.filePath(storedName);
    const title =
      dto.title?.trim() ||
      basename(originalName, extension).trim().slice(0, 160) ||
      'Документ';

    await mkdir(this.documentsDir, { recursive: true });
    await writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const document = await transaction.clientDocument.create({
          data: {
            title,
            originalName,
            storedName,
            mimeType: file.mimetype || 'application/octet-stream',
            size: file.size,
            category: dto.category ?? DocumentCategory.OTHER,
            description: dto.description?.trim() || null,
            clientId,
            uploaderId: user.id,
            uploaderName: user.name,
          },
          select: documentSelect,
        });
        await transaction.clientActivity.create({
          data: {
            type: ActivityType.SYSTEM,
            content: `Додано документ «${document.title}»`,
            clientId,
            authorId: user.id,
            authorName: user.name,
          },
        });
        return document;
      });
    } catch (error) {
      await this.removeStoredFiles([storedName]);
      throw error;
    }
  }

  async update(
    clientId: number,
    documentId: number,
    dto: UpdateClientDocumentDto,
    user: AuthUser,
  ) {
    const current = await this.findForMutation(clientId, documentId, user);

    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.clientDocument.update({
        where: { id: current.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
        },
        select: documentSelect,
      });
      await transaction.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Оновлено документ «${document.title}»`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        },
      });
      return document;
    });
  }

  async getForDownload(clientId: number, documentId: number) {
    const document = await this.prisma.clientDocument.findFirst({
      where: { id: documentId, clientId },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        storedName: true,
      },
    });
    if (!document) {
      throw new NotFoundException('Документ не знайдено');
    }

    const path = this.filePath(document.storedName);
    try {
      await access(path);
    } catch {
      throw new NotFoundException('Файл документа відсутній у сховищі');
    }

    return { ...document, path };
  }

  async remove(clientId: number, documentId: number, user: AuthUser) {
    const document = await this.findForMutation(clientId, documentId, user);

    await this.prisma.$transaction([
      this.prisma.clientDocument.delete({ where: { id: document.id } }),
      this.prisma.clientActivity.create({
        data: {
          type: ActivityType.SYSTEM,
          content: `Документ «${document.title}» видалено`,
          clientId,
          authorId: user.id,
          authorName: user.name,
        },
      }),
    ]);
    await this.removeStoredFiles([document.storedName]);
    return { success: true };
  }

  async removeStoredFiles(storedNames: string[]) {
    await Promise.all(
      storedNames.map(async (storedName) => {
        try {
          await unlink(this.filePath(storedName));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }),
    );
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
    documentId: number,
    user: AuthUser,
  ) {
    const document = await this.prisma.clientDocument.findFirst({
      where: { id: documentId, clientId },
      select: {
        id: true,
        title: true,
        storedName: true,
        uploaderId: true,
        client: {
          select: {
            managerId: true,
          },
        },
      },
    });
    if (!document) {
      throw new NotFoundException('Документ не знайдено');
    }
    if (
      user.role !== UserRole.ADMIN &&
      document.uploaderId !== user.id &&
      document.client.managerId !== user.id
    ) {
      throw new ForbiddenException('Ви не можете змінювати цей документ');
    }
    return document;
  }

  private cleanOriginalName(value: string) {
    const cleaned = basename(value)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();
    if (!cleaned) throw new BadRequestException('Некоректна назва файла');
    return cleaned.slice(0, 255);
  }

  private filePath(storedName: string) {
    return resolve(this.documentsDir, basename(storedName));
  }
}
