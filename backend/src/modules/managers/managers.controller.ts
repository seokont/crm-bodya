import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateManagerDto } from './dto/create-manager.dto';
import { ResetManagerPasswordDto } from './dto/reset-manager-password.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';
import { ManagersService } from './managers.service';

@ApiTags('managers')
@ApiBearerAuth()
@Controller('managers')
export class ManagersController {
  constructor(private readonly managersService: ManagersService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати активних менеджерів' })
  findAll() {
    return this.managersService.findAll();
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Отримати всіх менеджерів для адміністратора' })
  findAllForAdmin() {
    return this.managersService.findAllForAdmin();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Створити менеджера' })
  create(@Body() dto: CreateManagerDto) {
    return this.managersService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Оновити або деактивувати менеджера' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateManagerDto,
  ) {
    return this.managersService.update(id, dto);
  }

  @Patch(':id/password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Встановити новий пароль менеджера' })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetManagerPasswordDto,
  ) {
    return this.managersService.resetPassword(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Остаточно видалити менеджера' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.managersService.remove(id);
  }
}
