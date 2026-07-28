import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClientsService } from './clients.service';
import { DealFilterDto } from './dto/deal-filter.dto';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати загальний список угод' })
  @ApiOkResponse({ description: 'Угоди, підсумки й метадані пагінації' })
  findAll(
    @Query() filters: DealFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.findAllDeals(filters, user);
  }

  @Get('clients')
  @ApiOperation({ summary: 'Отримати клієнтів, доступних для нової угоди' })
  findClientOptions(@CurrentUser() user: AuthUser) {
    return this.clientsService.findDealClientOptions(user);
  }
}
