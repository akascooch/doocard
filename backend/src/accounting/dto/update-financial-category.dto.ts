import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class UpdateFinancialCategoryDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEnum(CategoryType)
  @IsOptional()
  type?: CategoryType;

  @IsString()
  @IsOptional()
  description?: string;
} 