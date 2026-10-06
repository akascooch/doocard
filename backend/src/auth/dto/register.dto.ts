import { IsEmail, IsNotEmpty, IsString, IsOptional, IsDateString, ValidateIf, IsInt } from 'class-validator';
import { UserRole } from '@prisma/client';

/**
 * Public self-registration. `role` is not a field: the global ValidationPipe
 * (whitelist + forbidNonWhitelisted) rejects any client-supplied role.
 * The only role this path may create is CUSTOMER, hardcoded in AuthService.
 */
export const PUBLIC_REGISTER_ROLE = UserRole.CUSTOMER;

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

  @IsOptional()
  @IsInt()
  preferredEmployeeId?: number;
} 