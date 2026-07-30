import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskFilterDto } from './dto/task-filter.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class GlobalTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати глобальний список завдань' })
  @ApiOkResponse({ description: 'Завдання, підсумки й пагінація' })
  findAll(
    @Query() filters: TaskFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.findAllGlobal(filters, user);
  }

  @Get('clients')
  @ApiOperation({ summary: 'Отримати клієнтів для створення завдання' })
  findClientOptions(@CurrentUser() user: AuthUser) {
    return this.tasksService.findTaskClientOptions(user);
  }
}
