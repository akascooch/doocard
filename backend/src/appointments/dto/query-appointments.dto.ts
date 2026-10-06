import { IsOptional, IsNumber, IsDateString, IsEnum, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export enum AppointmentPaymentMethodEnum {
  CASH = 'CASH',
  CARD = 'CARD',
  ONLINE = 'ONLINE',
  TRANSFER = 'TRANSFER',
  CHEQUE = 'CHEQUE',
  CARD2CARD = 'CARD2CARD',
  DEBT = 'DEBT',
}

export enum AppointmentStatusEnum {
  PENDING = 'PENDING',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  PAID = 'PAID',
  SETTLED = 'SETTLED',
}

export class QueryAppointmentsDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  customerId?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  employeeId?: number;

  @IsEnum(AppointmentStatusEnum)
  @IsOptional()
  status?: AppointmentStatusEnum;

  @IsEnum(AppointmentPaymentMethodEnum)
  @IsOptional()
  paymentMethod?: AppointmentPaymentMethodEnum;

  /**
   * Explicit null/legacy filter. Stored as a string so implicit Boolean
   * conversion cannot turn an arbitrary query value into true.
   */
  @IsIn(['true', 'false', '1', '0', true, false])
  @IsOptional()
  paymentMethodUnset?: string | boolean;

  @IsDateString()
  @IsOptional()
  from?: string; // Start date filter

  @IsDateString()
  @IsOptional()
  to?: string; // End date filter

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  skip?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  take?: number;

  @IsString()
  @IsOptional()
  search?: string; // Search by customer name/phone
}

