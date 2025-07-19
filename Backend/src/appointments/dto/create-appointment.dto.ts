import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  customerId: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  barberId: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNotEmpty()
  services: { serviceId: number; price: number }[];
} 