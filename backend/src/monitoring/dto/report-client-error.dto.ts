import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportClientErrorDto {
  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}
