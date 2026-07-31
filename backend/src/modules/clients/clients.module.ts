import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { DealsController } from './deals.controller';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GlobalTasksController } from './global-tasks.controller';
import { CallRemindersController } from './call-reminders.controller';

@Module({
  controllers: [
    ClientsController,
    DealsController,
    DocumentsController,
    CommentsController,
    TasksController,
    GlobalTasksController,
    CallRemindersController,
  ],
  providers: [ClientsService, DocumentsService, CommentsService, TasksService],
  exports: [ClientsService],
})
export class ClientsModule {}
