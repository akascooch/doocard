import { IsOptional, IsNumber, IsDateString, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

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

