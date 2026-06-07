import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export enum ImportEntity {
  EMPLOYEES = 'EMPLOYEES',
  CUSTOMERS = 'CUSTOMERS',
  TRANSACTIONS = 'TRANSACTIONS',
  APPOINTMENTS = 'APPOINTMENTS',
}

export class UploadImportDto {
  @IsEnum(ImportEntity)
  entity: ImportEntity;

  @IsBoolean()
  @IsOptional()
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
}

export class ClearAllDataDto {
  @IsString()
  confirmPhrase: string; // Must be "DELETE ALL DATA"

  @IsString()
  adminPassword: string;
}

