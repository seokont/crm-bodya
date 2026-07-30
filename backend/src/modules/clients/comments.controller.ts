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
import { CommentsService } from './comments.service';
import { CreateClientCommentDto } from './dto/create-client-comment.dto';
import { UpdateClientCommentDto } from './dto/update-client-comment.dto';

@ApiTags('client comments')
@ApiBearerAuth()
@Controller('clients/:clientId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати коментарі клієнта' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.commentsService.findAll(clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Додати коментар до картки клієнта' })
  @ApiCreatedResponse({ description: 'Коментар додано' })
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: CreateClientCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commentsService.create(clientId, dto, user);
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Редагувати власний коментар' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateClientCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commentsService.update(clientId, commentId, dto, user);
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Видалити власний коментар' })
  remove(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commentsService.remove(clientId, commentId, user);
  }
}
