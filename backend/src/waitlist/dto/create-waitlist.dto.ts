import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { StockWaitlistChannel } from '@prisma/client';

export class CreateWaitlistDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId: number;

  @IsOptional()
  @IsEnum(StockWaitlistChannel, { message: 'کانال اطلاع‌رسانی نامعتبر است' })
  channel?: StockWaitlistChannel;
}
