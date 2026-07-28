import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DuplicateClientQueryDto {
  @ApiPropertyOptional({ description: 'Повна назва компанії' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  companyName?: string;

  @ApiPropertyOptional({ description: 'ЄДРПОУ або ІПН' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  edrpou?: string;
}
