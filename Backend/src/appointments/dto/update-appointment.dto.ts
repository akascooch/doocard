import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  customerId?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  serviceId?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  barberId?: number;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  amount?: number;
} 