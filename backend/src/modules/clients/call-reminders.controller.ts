import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TasksService } from './tasks.service';

@ApiTags('call reminders')
@ApiBearerAuth()
@Controller('call-reminders')
export class CallRemindersController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати актуальні нагадування про дзвінки' })
  findDue(@CurrentUser() user: AuthUser) {
    return this.tasksService.findDueCallReminders(user);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Позначити всі нагадування прочитаними' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.tasksService.markAllCallRemindersRead(user);
  }

  @Patch(':taskId/read')
  @ApiOperation({ summary: 'Позначити нагадування прочитаним' })
  markRead(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.markCallReminderRead(taskId, user);
  }
}
