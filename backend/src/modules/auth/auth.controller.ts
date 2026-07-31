import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.interface';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateClientTablePreferencesDto } from './dto/update-client-table-preferences.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Увійти до CRM' })
  @ApiOkResponse({ description: 'Авторизація успішна' })
  @ApiUnauthorizedResponse({ description: 'Неправильний email або пароль' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримати поточного користувача' })
  profile(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('preferences/client-table')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отримати персональні колонки таблиці клієнтів' })
  getClientTablePreferences(@CurrentUser() user: AuthUser) {
    return this.authService.getClientTablePreferences(user.id);
  }

  @Patch('preferences/client-table')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Зберегти персональні колонки таблиці клієнтів' })
  updateClientTablePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateClientTablePreferencesDto,
  ) {
    return this.authService.updateClientTablePreferences(user.id, dto);
  }

  @Patch('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Змінити власний пароль' })
  @ApiOkResponse({ description: 'Новий пароль збережено' })
  @ApiUnauthorizedResponse({ description: 'Поточний пароль неправильний' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
