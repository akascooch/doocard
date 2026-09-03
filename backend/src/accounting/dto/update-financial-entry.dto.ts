import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class UpdateFinancialEntryDto {
  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsEnum(['SERVICE', 'TIP', 'EXPENSE', 'SALARY'])
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsNumber()
  @IsOptional()
  createdBy?: number;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsEnum(['PENDING', 'PAID', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  bankAccountId?: number;
} 