import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { BackupsModule } from './modules/backups/backups.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ManagersModule } from './modules/managers/managers.module';
import { OverviewModule } from './modules/overview/overview.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BackupsModule,
    OverviewModule,
    ClientsModule,
    ManagersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
