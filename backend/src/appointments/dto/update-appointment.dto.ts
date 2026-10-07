import { 
  IsDateString, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsArray, 
  ValidateNested,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentServiceDto } from './appointment-service.dto';
import { AppointmentStatusEnum } from './query-appointments.dto';

export class UpdateAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  customerId?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  employeeId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentServiceDto)
  @IsOptional()
  services?: AppointmentServiceDto[];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string; // ISO UTC date-time

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  durationMin?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  priceOverrideReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(AppointmentStatusEnum)
  @IsOptional()
  status?: AppointmentStatusEnum;
}
 