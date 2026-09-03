import { IsString, IsEmail, IsOptional, IsDateString, IsNumber, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  role?: string;

  // Additional fields for customer/employee creation
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  /** Preferred barber for CUSTOMER role creates. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  preferredEmployeeId?: number;
}
