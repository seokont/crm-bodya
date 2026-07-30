import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamMessageDto {
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
