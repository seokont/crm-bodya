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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateClientTaskDto } from './dto/create-client-task.dto';
import { UpdateClientTaskDto } from './dto/update-client-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('client tasks')
@ApiBearerAuth()
@Controller('clients/:clientId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати завдання клієнта' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.tasksService.findAll(clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Створити завдання клієнта' })
  @ApiCreatedResponse({ description: 'Завдання створено' })
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: CreateClientTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.create(clientId, dto, user);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Оновити завдання клієнта' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateClientTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.update(clientId, taskId, dto, user);
  }

  @Delete(':taskId')
  @ApiOperation({ summary: 'Видалити завдання клієнта' })
  remove(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.remove(clientId, taskId, user);
  }
}
