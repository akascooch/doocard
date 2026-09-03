import { IsDateString, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

const MAX_LEAF_NUMBER = 9999999999999999;

export class CreateChequebookDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bankAccountId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  serialNumber?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LEAF_NUMBER)
  startNumber: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LEAF_NUMBER)
  endNumber: number;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
