import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ChequeLeafCategory, ChequeLeafStatus } from '@prisma/client';

export class UpdateChequeLeafDto {
  @IsOptional()
  @IsEnum(ChequeLeafStatus)
  status?: ChequeLeafStatus;

  @IsOptional()
  @IsEnum(ChequeLeafCategory)
  category?: ChequeLeafCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  payee?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsDateString()
  clearedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transactionId?: number;
}
