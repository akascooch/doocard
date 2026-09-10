import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeIranMobile } from '../../common/utils/phone.util';

export const OTP_PURPOSES = ['LOGIN', 'BOOKING'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export class RequestOtpDto {
  @Transform(({ value }) => normalizeIranMobile(String(value ?? '')) ?? value)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @IsOptional()
  @IsIn(OTP_PURPOSES)
  purpose?: OtpPurpose;
}
