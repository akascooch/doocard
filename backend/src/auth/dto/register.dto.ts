import { IsEmail, IsNotEmpty, IsString, IsOptional, IsDateString, ValidateIf, IsInt } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @ValidateIf((o) => o.email && o.email.trim() !== '')
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @ValidateIf((o) => o.birthdate && o.birthdate.trim() !== '')
  @IsDateString()
  birthdate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsOptional()
  @IsInt()
  preferredEmployeeId?: number;
} 