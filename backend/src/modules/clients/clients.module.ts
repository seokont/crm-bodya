import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { DealsController } from './deals.controller';

@Module({
  controllers: [ClientsController, DealsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
