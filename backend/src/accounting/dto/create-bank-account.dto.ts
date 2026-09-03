import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{4}-\d{4}-\d{4}$/, { message: 'شماره کارت باید به صورت ۴ رقم-۴ رقم-۴ رقم-۴ رقم باشد.' })
  cardNumber: string;
} 