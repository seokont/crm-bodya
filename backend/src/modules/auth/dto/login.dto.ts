import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@bodya.crm' })
  @IsEmail()
  @MaxLength(191)
  email: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
