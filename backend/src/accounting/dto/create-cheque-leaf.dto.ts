import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ChequeLeafCategory } from '@prisma/client';

const MAX_LEAF_NUMBER = 9999999999999999;

export class CreateChequeLeafDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chequebookId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LEAF_NUMBER)
  leafNumber: number;

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
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transactionId?: number;
}
