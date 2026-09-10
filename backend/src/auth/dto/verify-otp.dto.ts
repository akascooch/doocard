import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeIranMobile } from '../../common/utils/phone.util';
import { OTP_PURPOSES, type OtpPurpose } from './request-otp.dto';

export class VerifyOtpDto {
  @Transform(({ value }) => normalizeIranMobile(String(value ?? '')) ?? value)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'کد تأیید نامعتبر است' })
  code: string;

  @IsOptional()
  @IsIn(OTP_PURPOSES)
  purpose?: OtpPurpose;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  rememberMe?: boolean;
}
