import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTeamMessageDto {
  @ApiPropertyOptional({
    description:
      'Адресат приватного повідомлення; без значення повідомлення є загальним',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipientId?: number;

  @ApiProperty({
    description: 'Текст повідомлення для команди',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
