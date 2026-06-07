/**
 * Money utilities for consistent currency handling
 * 
 * Convention:
 * - Database stores values in Rials (smallest unit)
 * - Display shows values in Tomans for better readability
 * - 1 Toman = 10 Rials
 * - Display format: "125,000 تومان" means 1,250,000 Rials
 */

/**
 * Format amount for display with Persian number separators
 * @param amount - Amount in Rials
 * @returns Formatted string with commas
 * @example formatToDisplay(1250000) // Returns "۱,۲۵۰,۰۰۰"
 */
export function formatToDisplay(amount: number | null): string {
  if (amount == null || isNaN(amount)) return '۰';
  
  try {
    return new Intl.NumberFormat('fa-IR').format(amount);
  } catch {
    return amount.toString();
  }
}

/**
 * Convert Rials to Tomans and format for display
 * @param amount - Amount in Rials
 * @returns Formatted string in tomans
 * @example thousandTomans(1250000) // Returns "۱۲۵,۰۰۰ تومان"
 */
export function thousandTomans(amount: number | null): string {
  if (amount == null || isNaN(amount)) return '۰ تومان';
  
  try {
    // Convert Rials to Tomans (÷ 10)
    const value = Math.floor(amount / 10);
    const formatted = new Intl.NumberFormat('fa-IR').format(value);
    return `${formatted} تومان`;
  } catch {
    return `${amount} تومان`;
  }
}

/**
 * Convert Tomans input to Rials for database storage
 * @param tomans - Amount in tomans
 * @returns Amount in Rials
 * @example fromThousandTomans(125000) // Returns 1250000
 */
export function fromThousandTomans(tomans: number): number {
  if (isNaN(tomans)) return 0;
  // Multiply by 10 to get Rials
  return tomans * 10;
}

/**
 * Format money for invoice/receipt display
 * @param amount - Amount in Rials
 * @returns Formatted string with currency
 * @example formatCurrency(1250000) // Returns "۱۲۵,۰۰۰ تومان"
 */
export function formatCurrency(amount: number | null): string {
  return thousandTomans(amount);
}

/**
 * Format money in short form (without "تومان" suffix)
 * @param amount - Amount in Rials  
 * @returns Just the number in tomans
 * @example formatShort(1250000) // Returns "۱۲۵,۰۰۰"
 */
export function formatShort(amount: number | null): string {
  if (amount == null || isNaN(amount)) return '۰';
  
  try {
    const value = Math.floor(amount / 10);
    return new Intl.NumberFormat('fa-IR').format(value);
  } catch {
    return '۰';
  }
}

/**
 * Parse Persian/English number string to number
 * @param str - String with Persian or English digits
 * @returns Numeric value
 */
export function parseMoneyString(str: string): number {
  if (!str) return 0;
  
  // Convert Persian digits to English
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let normalized = str;
  
  persianDigits.forEach((persian, index) => {
    normalized = normalized.replace(new RegExp(persian, 'g'), index.toString());
  });
  
  // Remove all non-digit characters (commas, spaces, etc.)
  normalized = normalized.replace(/[^\d]/g, '');
  
  return parseInt(normalized) || 0;
}

/**
 * Validate if a value is a valid money amount
 * @param amount - Amount to validate
 * @returns true if valid
 */
export function isValidAmount(amount: any): boolean {
  if (amount == null) return false;
  const num = typeof amount === 'string' ? parseMoneyString(amount) : amount;
  return !isNaN(num) && num >= 0;
}

