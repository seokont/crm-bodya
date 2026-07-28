import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthTokenPayload } from './auth-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (
      !user?.isActive ||
      !user.passwordHash ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Неправильний email або пароль');
    }

    const authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
    const payload: AuthTokenPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const [accessToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return { accessToken, user: authUser };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        isActive: true,
      },
    });

    if (
      !user?.isActive ||
      !user.passwordHash ||
      !(await compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Поточний пароль вказано неправильно');
    }

    if (await compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'Новий пароль має відрізнятися від поточного',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(dto.newPassword, 12),
      },
    });

    return { success: true };
  }
}
