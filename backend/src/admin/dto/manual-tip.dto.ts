import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { TipRecipientType } from '@prisma/client';

/** Amount is Toman (integer). Backend converts once to IRR (= Toman * 10). */
export class PreviewManualTipDto {
  @IsEnum(TipRecipientType)
  tipType: TipRecipientType;

  @IsInt()
  @IsPositive()
  amountToman: number;

  @IsString()
  @Matches(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)
  effectiveJalali: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  recipientEmployeeId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  teamMemberIds?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateManualTipDto extends PreviewManualTipDto {
  @IsString()
  @MaxLength(120)
  idempotencyKey: string;
}
