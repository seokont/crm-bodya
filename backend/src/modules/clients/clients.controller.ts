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
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateClientActivityDto } from './dto/create-client-activity.dto';
import { CreateClientDealDto } from './dto/create-client-deal.dto';
import { ClientFilterDto } from './dto/client-filter.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { DuplicateClientQueryDto } from './dto/duplicate-client-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientDealDto } from './dto/update-client-deal.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати клієнтів із фільтрацією та пагінацією' })
  @ApiOkResponse({ description: 'Список клієнтів і метадані пагінації' })
  findAll(@Query() filters: ClientFilterDto) {
    return this.clientsService.findAll(filters);
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Перевірити назву компанії та ЄДРПОУ на дублікати' })
  findDuplicates(@Query() query: DuplicateClientQueryDto) {
    return this.clientsService.findDuplicates(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати картку клієнта' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Створити клієнта' })
  @ApiCreatedResponse({ description: 'Клієнта створено' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUser) {
    return this.clientsService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Оновити клієнта' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Архівувати клієнта без фізичного видалення' })
  archive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.archive(id, user);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'Отримати історію активностей клієнта' })
  findActivities(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findActivities(id);
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Додати активність до картки клієнта' })
  createActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateClientActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.createActivity(id, dto, user);
  }

  @Delete(':clientId/activities/:activityId')
  @ApiOperation({ summary: 'Видалити запис активності' })
  removeActivity(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.removeActivity(clientId, activityId, user);
  }

  @Get(':clientId/deals')
  @ApiOperation({ summary: 'Отримати угоди клієнта' })
  findDeals(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.clientsService.findDeals(clientId);
  }

  @Post(':clientId/deals')
  @ApiOperation({ summary: 'Створити угоду для клієнта' })
  createDeal(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: CreateClientDealDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.createDeal(clientId, dto, user);
  }

  @Patch(':clientId/deals/:dealId')
  @ApiOperation({ summary: 'Оновити угоду клієнта' })
  updateDeal(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('dealId', ParseIntPipe) dealId: number,
    @Body() dto: UpdateClientDealDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.updateDeal(clientId, dealId, dto, user);
  }

  @Delete(':clientId/deals/:dealId')
  @ApiOperation({ summary: 'Видалити угоду клієнта' })
  removeDeal(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('dealId', ParseIntPipe) dealId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.removeDeal(clientId, dealId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Остаточно видалити клієнта' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}
