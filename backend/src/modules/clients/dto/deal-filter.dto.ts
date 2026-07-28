import { DealStage } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SortOrder } from './client-filter.dto';

export enum DealSortBy {
  UPDATED_AT = 'updatedAt',
  CREATED_AT = 'createdAt',
  AMOUNT = 'amount',
  EXPECTED_CLOSE_AT = 'expectedCloseAt',
}

const toArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return (Array.isArray(value) ? value : String(value).split(','))
    .map(String)
    .map((item) => item.trim())
    .filter(Boolean);
};

export class DealFilterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  search?: string;

  @ApiPropertyOptional({ enum: DealStage, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsEnum(DealStage, { each: true })
  stage?: DealStage[];

  @ApiPropertyOptional({ enum: ['UAH', 'USD', 'EUR'] })
  @IsOptional()
  @IsIn(['UAH', 'USD', 'EUR'])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  managerId?: number;

  @ApiPropertyOptional({ enum: DealSortBy, default: DealSortBy.UPDATED_AT })
  @IsOptional()
  @IsEnum(DealSortBy)
  sortBy: DealSortBy = DealSortBy.UPDATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;
}
