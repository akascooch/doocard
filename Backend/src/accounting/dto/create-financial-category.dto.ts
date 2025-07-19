import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateFinancialCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;

  @IsString()
  description?: string;
} 