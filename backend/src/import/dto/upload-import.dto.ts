import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ImportEntity {
  EMPLOYEES = 'EMPLOYEES',
  CUSTOMERS = 'CUSTOMERS',
  TRANSACTIONS = 'TRANSACTIONS',
  APPOINTMENTS = 'APPOINTMENTS',
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class UploadImportDto {
  @IsEnum(ImportEntity)
  entity: ImportEntity;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value) ?? true)
  @IsBoolean()
  dryRun?: boolean = true;

  @IsString()
  @IsOptional()
  batchId?: string;
}
export class CommitImportDto {
  @IsString()
  batchId: string;

  @IsEnum(ImportEntity)
  entity: ImportEntity;

  @IsBoolean()
  confirmed: boolean;

  @IsBoolean()
  @IsOptional()
  createMissing?: boolean = true;

  @IsBoolean()
  @IsOptional()
  createIncomeTx?: boolean = true;
}

export class ClearAllDataDto {
  @IsString()
  confirmPhrase: string; // Must be "DELETE ALL DATA"

  @IsString()
  adminPassword: string;
}

