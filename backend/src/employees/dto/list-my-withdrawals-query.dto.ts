import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const JALALI_DATE_PATTERN = /^[\d۰-۹]{4}[\/\-][\d۰-۹]{1,2}[\/\-][\d۰-۹]{1,2}$/;

export class ListMyWithdrawalsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(JALALI_DATE_PATTERN, {
    message: 'from must be a Jalali date (YYYY/MM/DD)',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(JALALI_DATE_PATTERN, {
    message: 'to must be a Jalali date (YYYY/MM/DD)',
  })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
