import { IsEnum, IsInt, IsOptional, IsString, Min, IsDateString, IsObject } from 'class-validator';
import { TransactionType, PaymentMethod } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsInt()
  @Min(0)
  amount: number; // Will be stored as BigInt in Rials

  @IsOptional()
  @IsString()
  currency?: string = 'IRR';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  accountId?: number;

  @IsOptional()
  @IsString()
  sourceType?: string; // APPOINTMENT, SALARY, TIP, REFUND, MANUAL

  @IsOptional()
  @IsInt()
  sourceId?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  meta?: any; // JSON metadata
}

