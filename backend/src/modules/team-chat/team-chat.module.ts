import { Module } from '@nestjs/common';
import { TeamChatController } from './team-chat.controller';
import { TeamChatGateway } from './team-chat.gateway';
import { TeamChatService } from './team-chat.service';

@Module({
  controllers: [TeamChatController],
  providers: [TeamChatService, TeamChatGateway],
})
export class TeamChatModule {}
