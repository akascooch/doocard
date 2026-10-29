import { IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ChequeLeafStatus } from '@prisma/client';

/**
 * Optional due-date range (Asia/Tehran civil days).
 * Accepts `YYYY-MM-DD` or ISO datetime whose prefix is `YYYY-MM-DD`.
 * When either is set, leaves with null `dueDate` are excluded server-side.
 */
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

  /** Inclusive lower bound on dueDate (Tehran day start). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}/, {
    message: 'dueFrom must start with YYYY-MM-DD',
  })
  dueFrom?: string;

  /** Inclusive upper bound on dueDate (Tehran day end). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}/, {
    message: 'dueTo must start with YYYY-MM-DD',
  })
  dueTo?: string;

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
