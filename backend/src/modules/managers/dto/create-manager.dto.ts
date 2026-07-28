import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateManagerDto {
  @ApiProperty({ example: 'Оксана Петренко' })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name: string;

  @ApiProperty({ example: 'oksana@bodya.crm' })
  @IsEmail()
  @MaxLength(191)
  email: string;

  @ApiProperty({ minLength: 8, example: 'Manager123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
