import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  durationMinutes: number;

  @IsNumber()
  price: number;
} 