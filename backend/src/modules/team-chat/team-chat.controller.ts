import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatMessagesQueryDto } from './dto/chat-messages-query.dto';
import { CreateTeamMessageDto } from './dto/create-team-message.dto';
import { UpdateTeamMessageDto } from './dto/update-team-message.dto';
import { TeamChatService } from './team-chat.service';
import { TeamChatGateway } from './team-chat.gateway';

@ApiTags('team chat')
@ApiBearerAuth()
@Controller('team-chat')
export class TeamChatController {
  constructor(
    private readonly teamChatService: TeamChatService,
    private readonly teamChatGateway: TeamChatGateway,
  ) {}

  @Get('messages')
  @ApiOperation({ summary: 'Отримати повідомлення командного чату' })
  findMessages(@Query() query: ChatMessagesQueryDto) {
    return this.teamChatService.findMessages(query);
  }

  @Get('members')
  @ApiOperation({ summary: 'Отримати учасників командного чату' })
  findMembers() {
    return this.teamChatService.findMembers();
  }

  @Post('messages')
  @ApiCreatedResponse({ description: 'Повідомлення надіслано' })
  @ApiOperation({ summary: 'Надіслати повідомлення команді' })
  async create(
    @Body() dto: CreateTeamMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    const message = await this.teamChatService.create(dto, user);
    this.teamChatGateway.broadcastCreated(message);
    return message;
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Редагувати власне повідомлення' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    const message = await this.teamChatService.update(id, dto, user);
    this.teamChatGateway.broadcastUpdated(message);
    return message;
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Видалити повідомлення' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.teamChatService.remove(id, user);
    this.teamChatGateway.broadcastDeleted(id);
    return result;
  }
}
