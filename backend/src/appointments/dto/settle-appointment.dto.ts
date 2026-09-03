import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
  IsArray,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SettlePaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CARD2CARD = 'CARD2CARD',
  DEBT = 'DEBT',
}

export enum TipRecipientType {
  INDIVIDUAL = 'INDIVIDUAL',
  TEAM = 'TEAM',
}

function toPositiveIntArray(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const ids = raw
    .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids;
}

/**
 * Settlement DTO (amounts in RIAL integers / BigInt-compatible).
 * Hybrid: paidAmount + debtAmount must equal `amount` when either split field is sent.
 * Legacy: omit paidAmount/debtAmount → full CASH/CARD/… or full DEBT via paymentMethod.
 */
export class SettleAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'مبلغ باید بزرگتر یا مساوی صفر باشد' })
  @IsNotEmpty()
  amount: number; // RIAL - total charged amount

  /** RIAL paid now (cash/card/…). Optional; defaults from paymentMethod when omitted with debtAmount. */
  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'مبلغ پرداختی باید بزرگتر یا مساوی صفر باشد' })
  @IsOptional()
  paidAmount?: number;

  /** RIAL recorded as customer debt. Optional. */
  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'مبلغ بدهی باید بزرگتر یا مساوی صفر باشد' })
  @IsOptional()
  debtAmount?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0, { message: 'مبلغ انعام باید بزرگتر یا مساوی صفر باشد' })
  @IsOptional()
  tipAmount?: number; // RIAL - optional tip

  @IsEnum(TipRecipientType, { message: 'نوع گیرنده انعام نامعتبر است' })
  @IsOptional()
  tipRecipientType?: TipRecipientType;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tipRecipientEmployeeId?: number;

  /** Selected SERVICE employee ids for TEAM tip (optional; backend falls back to all active SERVICE staff). */
  @IsOptional()
  @Transform(({ value }) => toPositiveIntArray(value))
  @IsArray()
  @IsInt({ each: true })
  tipTeamMemberIds?: number[];

  /**
   * Method for the paid portion (or full DEBT when debt-only legacy).
   * For hybrid, use CASH/CARD/CARD2CARD for the paid part (not DEBT).
   */
  @IsEnum(SettlePaymentMethod, { message: 'روش پرداخت نامعتبر است' })
  @IsNotEmpty()
  paymentMethod: SettlePaymentMethod;

  @ValidateIf((o: SettleAppointmentDto) => {
    const paid =
      o.paidAmount != null
        ? o.paidAmount
        : o.paymentMethod === SettlePaymentMethod.DEBT
          ? 0
          : o.amount;
    return paid > 0;
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  accountId?: number; // Bank account (required when paidAmount > 0)

  @IsString()
  @IsOptional()
  externalRef?: string; // Idempotency key (e.g., "settle_appointment_123_v1")

  @IsString()
  @IsOptional()
  notes?: string; // Additional settlement notes
}
