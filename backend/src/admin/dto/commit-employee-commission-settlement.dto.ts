import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CommitEmployeeCommissionSettlementDto {
  @IsInt()
  @Type(() => Number)
  employeeId: number;

  @IsString()
  @IsNotEmpty()
  fromJalali: string;

  @IsString()
  @IsNotEmpty()
  toJalali: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  commissionPercentage: number;

  @IsBoolean()
  periodStartConfirmed: boolean;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  bankAccountId: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
