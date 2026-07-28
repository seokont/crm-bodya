import {
  Controller,
  Get,
  Header,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { BackupsService } from './backups.service';

@ApiTags('backups')
@ApiBearerAuth()
@Controller('backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get('database')
  @Roles(UserRole.ADMIN)
  @Header('Cache-Control', 'no-store, max-age=0')
  @ApiOperation({ summary: 'Завантажити резервну копію бази даних' })
  @ApiOkResponse({
    description:
      'SQL-файл із користувачами, клієнтами, активностями та угодами CRM',
  })
  async downloadDatabase() {
    const backup = await this.backupsService.createDatabaseBackup();
    return new StreamableFile(Buffer.from(backup.content, 'utf8'), {
      type: 'application/sql; charset=utf-8',
      disposition: `attachment; filename="${backup.filename}"`,
    });
  }
}
