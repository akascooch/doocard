import {
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

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

  /**
   * Desk UIs must pass true to allow ADMIN/EMPLOYEE Ashkan bypass.
   * Public booking must omit this so an incidental admin cookie cannot bypass.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 1)
  @IsBoolean()
  staffAccess?: boolean;
}
