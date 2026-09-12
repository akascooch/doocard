import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  trackingCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quotedTotalRial?: number;
}
