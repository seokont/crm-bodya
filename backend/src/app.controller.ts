import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('system')
@Controller()
export class AppController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Перевірити стан API' })
  health() {
    return {
      status: 'ok',
      service: 'bodya-crm-api',
      timestamp: new Date().toISOString(),
    };
  }
}
