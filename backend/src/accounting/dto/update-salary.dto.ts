import { IsNumber, IsString, IsOptional, IsDateString, IsEnum, IsBoolean } from 'class-validator';

export class UpdateSalaryDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['REGULAR', 'TIP_SHARE', 'BONUS', 'ADVANCE'])
  salaryType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
