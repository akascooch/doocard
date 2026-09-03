import { IsInt, IsString, Min, IsDateString, IsOptional } from 'class-validator';

export class CreateTransferDto {
  @IsInt()
  @Min(1)
  fromAccountId: number;

  @IsInt()
  @Min(1)
  toAccountId: number;

  @IsInt()
  @Min(0)
  amount: number; // Will be stored as BigInt in Rials

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

