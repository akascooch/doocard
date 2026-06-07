import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum([
    'CUSTOMER_REGISTERED',
    'APPOINTMENT_CREATED',
    'APPOINTMENT_CONFIRMED',
    'APPOINTMENT_SETTLED',
    'APPOINTMENT_CANCELLED',
    'DEBT_CREATED',
    'DEBT_SETTLED',
    'TRANSACTION_CREATED',
    'PAYMENT_RECEIVED',
    'GENERAL',
  ])
  type: string;

  @IsOptional()
  @IsString()
  roleTarget?: string; // ADMIN, EMPLOYEE, CUSTOMER

  @IsOptional()
  @IsInt()
  userIdTarget?: number;

  @IsOptional()
  @IsString()
  relatedEntity?: string; // e.g., "appointment:123"
}

