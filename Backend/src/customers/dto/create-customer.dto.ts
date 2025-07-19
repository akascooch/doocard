import { IsString, IsEmail, IsOptional, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsNumber()
  barberId?: number;
} 