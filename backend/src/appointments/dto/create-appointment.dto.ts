import { 
  IsDateString, 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsArray, 
  ValidateNested,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentServiceDto } from './appointment-service.dto';

export class CreateAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  customerId: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  employeeId?: number; // Optional - can be null if employee not assigned yet

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'حداقل یک سرویس باید انتخاب شود' })
  @Type(() => AppointmentServiceDto)
  @IsNotEmpty()
  services: AppointmentServiceDto[]; // Multi-service support

  // Date input: Accept either jalali_date + time OR scheduled_at (ISO)
  @IsString()
  @IsOptional()
  jalaliDate?: string; // Format: YYYY-MM-DD (e.g., "1404-08-06")

  @IsString()
  @IsOptional()
  time?: string; // Format: HH:mm (e.g., "14:30")

  @IsDateString()
  @IsOptional()
  scheduledAt?: string; // ISO UTC date-time (alternative to jalaliDate + time)

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  durationMin?: number; // Total duration - will be computed if not provided

  @IsString()
  @IsOptional()
  notes?: string;

  /** Client-generated idempotency key for offline sync replay */
  @IsString()
  @IsOptional()
  @MaxLength(128)
  clientOpId?: string;
} 