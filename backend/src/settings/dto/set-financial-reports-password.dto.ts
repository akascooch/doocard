import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetFinancialReportsPasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
