import { plainToInstance, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { normalizeIranMobile } from '../../common/utils/phone.util';
import { CreateOrderItemDto } from './create-order-item.dto';

function parseItems(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function toOrderItems(value: unknown): unknown {
  const parsed = parseItems(value);
  if (!Array.isArray(parsed)) return parsed;
  return plainToInstance(CreateOrderItemDto, parsed);
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName: string;

  @Transform(({ value }) => {
    const normalized = normalizeIranMobile(String(value ?? ''));
    return normalized ?? value;
  })
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  customerPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNotes?: string;

  @Transform(({ value }) => toOrderItems(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  items: CreateOrderItemDto[];
}
