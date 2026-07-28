import { DealStage } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClientDealDto {
  @ApiProperty({ example: 'Річне обслуговування' })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  title: string;

  @ApiProperty({ example: 125000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  amount: number;

  @ApiPropertyOptional({
    enum: ['UAH', 'USD', 'EUR'],
    default: 'UAH',
  })
  @IsOptional()
  @IsIn(['UAH', 'USD', 'EUR'])
  currency?: string;

  @ApiPropertyOptional({ enum: DealStage, default: DealStage.NEW })
  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @ApiPropertyOptional({
    description: 'Очікувана дата закриття у форматі ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  expectedCloseAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
