import { EmployeeSalaryRequestType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateMySalaryRequestDto {
  @IsEnum(EmployeeSalaryRequestType)
  requestType: EmployeeSalaryRequestType;

  @IsString()
  upToJalali: string;

  @IsOptional()
  @IsString()
  periodStartJalali?: string;

  @IsString()
  requestedAmountRial: string;

  @IsOptional()
  @IsString()
  destinationNote?: string;

  @IsOptional()
  @IsBoolean()
  allowNegative?: boolean;
}
