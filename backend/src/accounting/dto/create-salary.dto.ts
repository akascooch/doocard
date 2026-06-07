import { IsNumber, IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum SalaryType {
  REGULAR = 'REGULAR',
  TIP_SHARE = 'TIP_SHARE',
  BONUS = 'BONUS',
  ADVANCE = 'ADVANCE',
}

export class CreateSalaryDto {
  @IsNumber()
  barberId: number;

  @IsNumber()
  amount: number;

  @IsDateString()
  month: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SalaryType)
  salaryType?: SalaryType = SalaryType.REGULAR;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
