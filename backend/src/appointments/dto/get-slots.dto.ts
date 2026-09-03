import { IsNotEmpty, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsOptional()
  durationMin?: number; // Total duration needed (default: 60 minutes)

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  bufferMin?: number; // Optional gap after appointment end (default: 0; not applied to slot end boundary)

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(15)
  slotIntervalMin?: number; // Slot start granularity (default: 30 minutes)
}
