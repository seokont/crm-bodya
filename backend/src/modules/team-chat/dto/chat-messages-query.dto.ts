import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ChatMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Отримати повідомлення з ID, більшим за вказаний',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  afterId?: number;

  @ApiPropertyOptional({
    description: 'Отримати повідомлення з ID, меншим за вказаний',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeId?: number;

  @ApiPropertyOptional({ default: 80, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 80;
}
