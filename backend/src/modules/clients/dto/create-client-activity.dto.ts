import { ActivityType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const manualActivityTypes = [
  ActivityType.NOTE,
  ActivityType.CALL,
  ActivityType.EMAIL,
  ActivityType.MEETING,
];

export class CreateClientActivityDto {
  @ApiProperty({
    enum: manualActivityTypes,
    example: ActivityType.CALL,
  })
  @IsIn(manualActivityTypes)
  type: ActivityType;

  @ApiProperty({
    example: 'Обговорили умови співпраці та домовилися про наступний дзвінок.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    description: 'Дата й час взаємодії у форматі ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
