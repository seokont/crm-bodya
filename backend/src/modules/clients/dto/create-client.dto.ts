import { ClientStatus, ClientType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ enum: ClientType, default: ClientType.COMPANY })
  @IsEnum(ClientType)
  type: ClientType = ClientType.COMPANY;

  @ApiPropertyOptional({ example: 'ТОВ «Приклад»' })
  @ValidateIf((object: CreateClientDto, value: unknown) => {
    return value !== undefined || object.type !== ClientType.PERSON;
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  companyName?: string;

  @ApiPropertyOptional({ example: 'Іван Петренко' })
  @ValidateIf((object: CreateClientDto, value: unknown) => {
    return value !== undefined || object.type === ClientType.PERSON;
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  contactName?: string;

  @ApiPropertyOptional({ example: '+380671234567' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  secondaryPhone?: string;

  @ApiPropertyOptional({ example: 'office@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  edrpou?: string;

  @ApiPropertyOptional({ example: 'Київ' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  website?: string;

  @ApiPropertyOptional({ enum: ClientStatus, default: ClientStatus.NEW })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  managerId?: number;

  @ApiPropertyOptional({ example: 'Первинний контакт' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}
