import { IsString, IsOptional, Matches } from 'class-validator';

export class UpdateBankAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{4}-\d{4}-\d{4}$/, { message: 'شماره کارت باید به صورت ۴ رقم-۴ رقم-۴ رقم-۴ رقم باشد.' })
  cardNumber?: string;
} 