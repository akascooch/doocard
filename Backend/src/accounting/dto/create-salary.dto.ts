import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateSalaryDto {
  @IsNumber()
  barberId: number;

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  month: string;

  @IsString()
  @IsOptional()
  description?: string;
} 