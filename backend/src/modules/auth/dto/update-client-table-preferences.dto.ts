import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
} from 'class-validator';

export const clientTableColumnKeys = [
  'id',
  'client',
  'edrpou',
  'phone',
  'email',
  'city',
  'status',
  'source',
  'manager',
  'createdAt',
  'updatedAt',
] as const;

export type ClientTableColumnKey = (typeof clientTableColumnKeys)[number];

export class UpdateClientTablePreferencesDto {
  @ApiProperty({
    enum: clientTableColumnKeys,
    isArray: true,
    description: 'Колонки, які користувач бажає бачити в таблиці клієнтів',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(clientTableColumnKeys, { each: true })
  columns!: ClientTableColumnKey[];
}
