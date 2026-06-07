import { IsNotEmpty, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetSlotsDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  employeeId: number;

  @IsDateString()
  @IsNotEmpty()
  date: string; // Date in format YYYY-MM-DD

  @IsNumber()
  @Type(() => Number)
  @Min(1, { message: 'مدت زمان باید حداقل 1 دقیقه باشد' })
  @IsOptional() // Made optional for public booking - defaults to 30 minutes
  durationMin?: number; // Total duration needed (default: 30)

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  bufferMin?: number; // Buffer between appointments (default: 5 minutes)

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(5)
  slotIntervalMin?: number; // Slot interval granularity (default: 60 minutes - hourly slots)
}

