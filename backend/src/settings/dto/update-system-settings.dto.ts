import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoBackupEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  backupIntervalDays?: number;

  @IsOptional()
  @IsString()
  backupPath?: string | null;
}
