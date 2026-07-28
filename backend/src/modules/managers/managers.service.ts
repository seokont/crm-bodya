import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateManagerDto } from './dto/create-manager.dto';
import { ResetManagerPasswordDto } from './dto/reset-manager-password.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';

@Injectable()
export class ManagersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: UserRole.MANAGER },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  findAllForAdmin() {
    return this.prisma.user.findMany({
      where: { role: UserRole.MANAGER },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateManagerDto) {
    try {
      const passwordHash = await hash(dto.password, 12);
      return await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          role: UserRole.MANAGER,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.handleUniqueEmail(error);
    }
  }

  async update(id: number, dto: UpdateManagerDto) {
    await this.ensureManager(id);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.email !== undefined
            ? { email: dto.email.trim().toLowerCase() }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.handleUniqueEmail(error);
    }
  }

  async resetPassword(id: number, dto: ResetManagerPasswordDto) {
    await this.ensureManager(id);
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hash(dto.password, 12),
      },
    });
    return { success: true };
  }

  async remove(id: number) {
    await this.ensureManager(id);
    const assignedClients = await this.prisma.client.count({
      where: { managerId: id },
    });

    await this.prisma.user.delete({ where: { id } });
    return {
      success: true,
      unassignedClients: assignedClients,
    };
  }

  private async ensureManager(id: number) {
    const manager = await this.prisma.user.findFirst({
      where: { id, role: UserRole.MANAGER },
      select: { id: true },
    });
    if (!manager) {
      throw new NotFoundException(`Менеджера з ID ${id} не знайдено`);
    }
  }

  private handleUniqueEmail(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Користувач із таким email уже існує');
    }
    throw error;
  }
}
