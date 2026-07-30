import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientCommentDto {
  @ApiProperty({
    description: 'Текст коментаря',
    minLength: 1,
    maxLength: 3000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content!: string;
}
