export const MAX_PACKAGE_PRICE_RIAL = 99_999_999_999_999;
export const MAX_SESSIONS = 500;
export const MAX_VALIDITY_DAYS = 3650;
export const LOYALTY_MIN_REDEEM_POINTS = 100;
export const LOYALTY_RIALS_PER_POINT = 1000;

export const PACKAGE_PAYMENTS = ['WALLET', 'CASH', 'CARD', 'COMPLIMENTARY'] as const;
export type PackagePayment = (typeof PACKAGE_PAYMENTS)[number];

export const LOYALTY_ACTIONS = [
  'EARNED_PURCHASE',
  'EARNED_BONUS',
  'REDEEMED_WALLET',
  'ADMIN_ADJUSTMENT',
] as const;
export type LoyaltyAction = (typeof LOYALTY_ACTIONS)[number];

export function parsePositiveRial(value: unknown): bigint {
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
  if (amount < 1n || amount > BigInt(MAX_PACKAGE_PRICE_RIAL)) throw new Error('range');
  return amount;
}
