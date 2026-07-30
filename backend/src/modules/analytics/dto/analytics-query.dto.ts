import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Період аналітики у днях',
    enum: [30, 90, 180, 365],
    default: 90,
  })
  @Transform(({ value }) => Number(value))
  @IsIn([30, 90, 180, 365])
  period = 90;
}
