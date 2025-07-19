import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { EntryType, EntryStatus } from '@prisma/client';

export class UpdateFinancialEntryDto {
  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsEnum(EntryType)
  @IsOptional()
  type?: EntryType;

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

  @IsEnum(EntryStatus)
  @IsOptional()
  status?: EntryStatus;

  @IsNumber()
  @IsOptional()
  bankAccountId?: number;
} 