import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BackupsModule } from './modules/backups/backups.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ManagersModule } from './modules/managers/managers.module';
import { OverviewModule } from './modules/overview/overview.module';
import { TeamChatModule } from './modules/team-chat/team-chat.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    BackupsModule,
    OverviewModule,
    TeamChatModule,
    ClientsModule,
    ManagersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
