import { IsString, MinLength, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class QuickCreateCustomerDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  phone: string;

  /** Admin-only preferred barber; ignored for EMPLOYEE/SERVICE (JWT actor used). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  preferredEmployeeId?: number;
}
