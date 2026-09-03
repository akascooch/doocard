import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional } from 'class-validator';

export class CreateFinancialEntryDto {
  @IsNumber()
  amount: number;

  @IsEnum(['SERVICE', 'TIP', 'EXPENSE', 'SALARY'])
  type: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  categoryId: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsNumber()
  createdBy: number;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsNumber()
  @IsOptional()
  bankAccountId?: number;
} 