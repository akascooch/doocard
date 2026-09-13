import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const FROG_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;
export type FrogStatus = (typeof FROG_STATUSES)[number];

/** Inclusive max petty-cash amount in rials. Fits JSON decimal string and Number.MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_RIAL = 99_999_999_999_999;
export const MAX_PAGE_SIZE = 50;
export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() + 1 === month &&
    probe.getUTCDate() === day
  );
}

export function parseAmountRial(value: unknown): bigint {
  let digits: string | null = null;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || !Number.isFinite(value) || value < 1) {
      throw new Error('invalid');
    }
    digits = String(value);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) throw new Error('invalid');
    digits = trimmed;
  }
  if (!digits) throw new Error('invalid');
  const amount = BigInt(digits);
  if (amount < 1n || amount > BigInt(MAX_AMOUNT_RIAL)) throw new Error('range');
  return amount;
}

export class UpsertTodayFrogDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  rolloverId?: string;
}

export class ToggleFrogDto {
  @IsOptional()
  @IsIn(FROG_STATUSES)
  status?: FrogStatus;
}

export const EXPENSE_CATEGORIES = [
  'SALON_SUPPLIES',
  'FOOD_REFRESHMENT',
  'PETTY_CASH',
  'UTILITY',
  'PERSONAL',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export class CreatePersonalExpenseDto {
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : String(value ?? '').trim()))
  @IsString()
  @Matches(/^\d+$/, { message: 'مبلغ باید عدد صحیح ریال باشد' })
  @MaxLength(14)
  amount: string;

  @IsIn(EXPENSE_CATEGORIES)
  category: ExpenseCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'dateKey باید YYYY-MM-DD باشد' })
  dateKey?: string;
}

export class ListPersonalExpensesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  to?: string;

  @IsOptional()
  @IsIn(EXPENSE_CATEGORIES)
  category?: ExpenseCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export class FrogHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}
