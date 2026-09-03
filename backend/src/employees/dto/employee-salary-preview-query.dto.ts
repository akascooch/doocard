import { IsNotEmpty, IsString, Matches } from 'class-validator';

const JALALI_DATE_PATTERN = /^[\d۰-۹]{4}[\/\-][\d۰-۹]{1,2}[\/\-][\d۰-۹]{1,2}$/;

export class EmployeeSalaryPreviewQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(JALALI_DATE_PATTERN, {
    message: 'from must be a Jalali date (YYYY/MM/DD)',
  })
  from: string;

  @IsString()
  @IsNotEmpty()
  @Matches(JALALI_DATE_PATTERN, {
    message: 'to must be a Jalali date (YYYY/MM/DD)',
  })
  to: string;
}
