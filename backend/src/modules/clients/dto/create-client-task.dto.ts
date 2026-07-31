import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskKind, TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClientTaskDto {
  @ApiProperty({ minLength: 2, maxLength: 191 })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  title!: string;

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskKind, default: TaskKind.GENERAL })
  @IsOptional()
  @IsEnum(TaskKind)
  kind?: TaskKind;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2026-08-01T12:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ example: '2026-08-01T11:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  remindAt?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  assigneeId?: number;
}
