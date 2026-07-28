import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.interface';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { OverviewService } from './overview.service';

@ApiTags('overview')
@ApiBearerAuth()
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати показники робочого огляду' })
  getOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: OverviewQueryDto,
  ) {
    return this.overviewService.getOverview(user, query.period);
  }
}
