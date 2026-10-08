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
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentServiceDto } from './appointment-service.dto';

/** One service + one barber. Omitted time inherits the parent schedule. */
export class BarberServiceSelectionDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  serviceId: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  employeeId: number;

  @IsString()
  @IsOptional()
  jalaliDate?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class CreateAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  customerId: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  employeeId?: number; // Optional - can be null if employee not assigned yet

  @ValidateIf((dto: CreateAppointmentDto) => !dto.selections?.length)
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'حداقل یک سرویس باید انتخاب شود' })
  @Type(() => AppointmentServiceDto)
  @IsNotEmpty()
  services?: AppointmentServiceDto[]; // Same-barber services on one appointment

  /** When present, each pair becomes its own appointment in one transaction. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => BarberServiceSelectionDto)
  selections?: BarberServiceSelectionDto[];

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