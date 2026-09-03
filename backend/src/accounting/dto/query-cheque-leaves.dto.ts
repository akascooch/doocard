import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ChequeLeafStatus } from '@prisma/client';

export class QueryChequeLeavesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chequebookId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bankAccountId?: number;

  @IsOptional()
  @IsEnum(ChequeLeafStatus)
  status?: ChequeLeafStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}
