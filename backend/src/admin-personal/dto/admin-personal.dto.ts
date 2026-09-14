import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'dateKey باید YYYY-MM-DD باشد' })
  dateKey?: string;

  /** Tehran clock, 24h HH:mm. Some browsers submit HH:mm:ss from <input type="time">. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(trimmed)) return trimmed.slice(0, 5);
    return trimmed;
  })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'dueTime باید HH:mm باشد' })
  dueTime?: string;
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

export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  'خوراک',
  'رفت و آمد',
  'تجهیزات شخصی',
  'متفرقه',
] as const;

export function enumForCategoryName(name: string): ExpenseCategory {
  switch (name.trim()) {
    case 'خوراک':
      return 'FOOD_REFRESHMENT';
    case 'رفت و آمد':
      return 'UTILITY';
    case 'تجهیزات شخصی':
      return 'SALON_SUPPLIES';
    case 'متفرقه':
      return 'PETTY_CASH';
    default:
      return 'PERSONAL';
  }
}

export class CreatePersonalExpenseDto {
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : String(value ?? '').trim()))
  @IsString()
  @Matches(/^\d+$/, { message: 'مبلغ باید عدد صحیح ریال باشد' })
  @MaxLength(14)
  amount: string;

  @ValidateIf((o: CreatePersonalExpenseDto) => !o.categoryId)
  @IsIn(EXPENSE_CATEGORIES)
  category?: ExpenseCategory;

  @ValidateIf((o: CreatePersonalExpenseDto) => !o.category)
  @IsUUID(undefined, { message: 'شناسه دسته نامعتبر است' })
  categoryId?: string;

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
  @IsUUID()
  categoryId?: string;

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

export const FROG_FREQUENCIES = ['DAILY', 'WEEKLY'] as const;
export type FrogFrequency = (typeof FROG_FREQUENCIES)[number];

export class CreateFrogRecurrenceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(FROG_FREQUENCIES)
  frequency: FrogFrequency;

  @ValidateIf((o: CreateFrogRecurrenceDto) => o.frequency === 'WEEKLY')
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;
}

export class UpdateFrogRecurrenceDto {
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
  @IsIn(FROG_FREQUENCIES)
  frequency?: FrogFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
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

export class ListFrogsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  dateKey?: string;
}

export class CreateExpenseCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

export class UpdateExpenseCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}
