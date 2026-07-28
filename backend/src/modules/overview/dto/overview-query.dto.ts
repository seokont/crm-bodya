import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export class OverviewQueryDto {
  @ApiPropertyOptional({
    description: 'Період статистики у днях',
    enum: [7, 30, 90],
    default: 30,
  })
  @Transform(({ value }) => Number(value))
  @IsIn([7, 30, 90])
  period = 30;
}
