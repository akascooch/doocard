/**
 * Money utilities for frontend
 * 
 * NEW CONVENTION (2025-10-28):
 * - Everything in RIALS (no Toman conversion)
 * - User inputs in Rials
 * - Display shows Rials with Persian separators
 * - Backend stores/sends values in Rials
 * - Format: "15,000,000 ریال"
 */

/**
 * Format number with commas (thousands separator)
 * @param value - Number or string to format
 * @returns Formatted string with commas
 * @example formatNumberWithCommas(125000) // Returns "125,000"
 */
export const formatNumberWithCommas = (value: string | number): string => {
  if (!value && value !== 0) return '';
  
  // Remove all non-digit characters first
  const num = value.toString().replace(/\D/g, '');
  
  // Add commas
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Parse formatted number string to raw number
 * @param value - Formatted string (may include commas)
 * @returns Raw number
 * @example parseFormattedNumber("125,000") // Returns 125000
 */
export const parseFormattedNumber = (value: string): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[,،\s]/g, '');
  return parseInt(cleaned, 10) || 0;
};

/**
 * Format Rials for display (NO conversion to Toman)
 * @param rialValue - Value in Rials
 * @returns Formatted string in Rials
 * @example formatRials(15000000) // Returns "۱۵,۰۰۰,۰۰۰ ریال"
 */
export const formatRials = (rialValue: number | null | undefined): string => {
  if (rialValue == null || isNaN(rialValue)) return '۰ ریال';
  
  const formatted = new Intl.NumberFormat('fa-IR').format(rialValue);
  return `${formatted} ریال`;
};

// Legacy: Keep for backward compatibility (but now returns Rials)
export const toThousandTomans = (rialValue: number | null | undefined): string => {
  return formatRials(rialValue);
};

/**
 * Parse input value (NO conversion - return as is)
 * @param value - Value in Rials
 * @returns Value in Rials (unchanged)
 * @example parseRialInput(15000000) // Returns 15000000
 */
export const parseRialInput = (value: number): number => {
  if (isNaN(value)) return 0;
  return value; // No conversion!
};

// Legacy: Keep for backward compatibility (but now returns as is)
export const fromThousandTomans = (value: number): number => {
  return parseRialInput(value);
};

/**
 * Format for short display (just the number in Rials, no label)
 * @param rialValue - Value in Rials
 * @returns Number in Rials
 * @example formatShortMoney(15000000) // Returns "۱۵,۰۰۰,۰۰۰"
 */
export const formatShortMoney = (rialValue: number | null | undefined): string => {
  if (rialValue == null || isNaN(rialValue)) return '۰';
  
  return new Intl.NumberFormat('fa-IR').format(rialValue);
};

/**
 * Convert Persian digits to English digits
 * @param str - String with Persian digits
 * @returns String with English digits
 */
export const persianToEnglishDigits = (str: string): string => {
  if (!str) return '';
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  return str
    .split('')
    .map((char) => {
      const persianIndex = persianDigits.indexOf(char);
      if (persianIndex !== -1) return persianIndex.toString();
      
      const arabicIndex = arabicDigits.indexOf(char);
      if (arabicIndex !== -1) return arabicIndex.toString();
      
      return char;
    })
    .join('');
};

/**
 * Convert English digits to Persian digits
 * @param str - String with English digits
 * @returns String with Persian digits
 */
export const englishToPersianDigits = (str: string): string => {
  if (!str) return '';
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
};

/**
 * Format value for display in tables (with Persian digits)
 * @param rialValue - Value in Rials
 * @returns Formatted display value
 * @example formatForDisplay(1250000) // Returns "۱۲۵,۰۰۰ تومان"
 */
export const formatForDisplay = (rialValue: number | null | undefined): string => {
  const formatted = toThousandTomans(rialValue);
  return englishToPersianDigits(formatted);
};

/**
 * Format currency in IRR (Rials) - for compatibility
 * @param amount - Amount in Rials
 * @returns Formatted IRR string
 */
export const formatIRR = (amount: number): string => {
  return new Intl.NumberFormat('fa-IR', {
    style: 'currency',
    currency: 'IRR',
    minimumFractionDigits: 0
  }).format(amount);
};

/**
 * Format large amounts in compact form (میلیارد، میلیون، هزار) - in RIALS
 * @param rialValue - Value in Rials
 * @param decimals - Number of decimal places (default: 1)
 * @returns Compact formatted string
 * @example formatCompactMoney(150000000) // Returns "۱۵۰ میلیون ریال"
 * @example formatCompactMoney(15000000) // Returns "۱۵ میلیون ریال"
 */
export const formatCompactMoney = (
  rialValue: number | null | undefined,
  decimals: number = 1
): string => {
  if (rialValue == null || isNaN(rialValue)) return '۰ ریال';
  
  // Work with Rials directly (no conversion)
  const billion = 1_000_000_000;  // میلیارد
  const million = 1_000_000;      // میلیون
  const thousand = 1_000;         // هزار
  
  let value: number;
  let unit: string;
  
  if (rialValue >= billion) {
    value = rialValue / billion;
    unit = 'میلیارد';
  } else if (rialValue >= million) {
    value = rialValue / million;
    unit = 'میلیون';
  } else if (rialValue >= thousand) {
    value = rialValue / thousand;
    unit = 'هزار';
  } else {
    return `${new Intl.NumberFormat('fa-IR').format(rialValue)} ریال`;
  }
  
  // Format with specified decimals
  const formatted = value.toFixed(decimals).replace(/\.?0+$/, '');
  const persianFormatted = englishToPersianDigits(formatted);
  
  return `${persianFormatted} ${unit} ریال`;
};

/**
 * Format large amounts with abbreviated notation - in RIALS
 * @param rialValue - Value in Rials
 * @returns Ultra-compact string
 */
export const formatCompactMoneyShort = (
  rialValue: number | null | undefined
): string => {
  if (rialValue == null || isNaN(rialValue)) return '۰';
  
  const billion = 1_000_000_000;
  const million = 1_000_000;
  const thousand = 1_000;
  
  if (rialValue >= billion) {
    const value = (rialValue / billion).toFixed(1).replace(/\.?0+$/, '');
    return englishToPersianDigits(value) + ' میلیارد';
  } else if (rialValue >= million) {
    const value = (rialValue / million).toFixed(1).replace(/\.?0+$/, '');
    return englishToPersianDigits(value) + ' میلیون';
  } else if (rialValue >= thousand) {
    const value = (rialValue / thousand).toFixed(0);
    return englishToPersianDigits(value) + ' هزار';
  } else {
    return new Intl.NumberFormat('fa-IR').format(rialValue);
  }
};

/**
 * Format IRR (Rials) as Toman for display only.
 * Backend storage remains IRR. Display = floor(IRR / 10).
 * @example formatTomansFromRial(5000000) // "۵۰۰,۰۰۰ تومان"
 */
export const formatTomansFromRial = (
  rialValue: number | string | null | undefined,
): string => {
  if (rialValue == null || rialValue === '') return '۰ تومان';
  const raw =
    typeof rialValue === 'string'
      ? rialValue.replace(/[^\d-]/g, '')
      : String(Math.trunc(rialValue));
  if (!raw || raw === '-' || Number.isNaN(Number(raw))) return '۰ تومان';
  try {
    const rial = BigInt(raw);
    const toman = rial / BigInt(10);
    const formatted = new Intl.NumberFormat('fa-IR').format(toman);
    return `${formatted} تومان`;
  } catch {
    return '۰ تومان';
  }
};

/**
 * Format IRR as Toman without unit suffix (for compact table cells).
 */
export const formatTomansFromRialShort = (
  rialValue: number | string | null | undefined,
): string => {
  if (rialValue == null || rialValue === '') return '۰';
  const raw =
    typeof rialValue === 'string'
      ? rialValue.replace(/[^\d-]/g, '')
      : String(Math.trunc(rialValue));
  if (!raw || raw === '-') return '۰';
  try {
    const toman = BigInt(raw) / BigInt(10);
    return new Intl.NumberFormat('fa-IR').format(toman);
  } catch {
    return '۰';
  }
};

// Main exports (RIALS)
export const formatMoney = formatRials;

// Aliases for convenience
export const toTomans = toThousandTomans; // Legacy (now returns Rials)
export const fromTomans = fromThousandTomans; // Legacy (no conversion)

export default {
  formatNumberWithCommas,
  parseFormattedNumber,
  formatRials,
  formatMoney,
  toThousandTomans,
  toTomans,
  fromThousandTomans,
  fromTomans,
  parseRialInput,
  formatShortMoney,
  formatForDisplay,
  formatIRR,
  formatCompactMoney,
  formatCompactMoneyShort,
  formatTomansFromRial,
  formatTomansFromRialShort,
  persianToEnglishDigits,
  englishToPersianDigits,
};

