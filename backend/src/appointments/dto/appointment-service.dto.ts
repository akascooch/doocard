import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AppointmentServiceDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  serviceId: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  priceAtBooking?: number; // RIAL - will be auto-filled if not provided

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  durationMin?: number; // will be auto-filled if not provided
}

