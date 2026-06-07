import { 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsEnum,
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SettlePaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CARD2CARD = 'CARD2CARD',
  DEBT = 'DEBT',
}

export class SettleAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'مبلغ باید بزرگتر یا مساوی صفر باشد' })
  @IsNotEmpty()
  amount: number; // RIAL - total charged amount

  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'مبلغ انعام باید بزرگتر یا مساوی صفر باشد' })
  @IsOptional()
  tipAmount?: number; // RIAL - optional tip

  @IsEnum(SettlePaymentMethod, { message: 'روش پرداخت نامعتبر است' })
  @IsNotEmpty()
  paymentMethod: SettlePaymentMethod;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  accountId?: number; // Bank account (required for non-DEBT payments)

  @IsString()
  @IsOptional()
  externalRef?: string; // Idempotency key (e.g., "settle_appointment_123_v1")

  @IsString()
  @IsOptional()
  notes?: string; // Additional settlement notes
}

