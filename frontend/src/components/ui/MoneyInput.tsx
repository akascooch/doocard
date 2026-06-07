"use client"

import { useState, useEffect } from 'react';
import { formatNumberWithCommas, parseFormattedNumber, persianToEnglishDigits } from '@/lib/money';
import { Label } from './label';

interface MoneyInputProps {
  value?: number; // Value in Rials
  onChange: (rials: number) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  min?: number;
  max?: number;
}

/**
 * Money Input Component
 * 
 * Features:
 * - Accepts input in Tomans
 * - Automatically formats with commas
 * - Converts Persian digits to English
 * - Returns value in Rials to parent
 * - Shows "تومان" label
 * 
 * @example
 * <MoneyInput
 *   value={price} // in Rials, e.g., 1250000
 *   onChange={setPrice}
 *   label="قیمت خدمت"
 *   placeholder="مثال: 125,000"
 * />
 * 
 * User types: 125,000 → Displays: "125,000 تومان" → Returns: 1250000 Rials
 */
export default function MoneyInput({
  value = 0,
  onChange,
  label,
  placeholder = 'مبلغ را وارد کنید',
  error,
  disabled = false,
  className = '',
  required = false,
  min = 0,
  max,
}: MoneyInputProps) {
  // Display value in Tomans (user-friendly format)
  const [displayValue, setDisplayValue] = useState('');

  // Convert Rials to Tomans for display
  useEffect(() => {
    if (value != null && !isNaN(value)) {
      const tomans = Math.floor(value / 10);
      setDisplayValue(formatNumberWithCommas(tomans));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Convert Persian digits to English
    inputValue = persianToEnglishDigits(inputValue);
    
    // Format with commas
    const formatted = formatNumberWithCommas(inputValue);
    setDisplayValue(formatted);
    
    // Parse and convert to Rials
    const tomans = parseFormattedNumber(formatted);
    const rials = tomans * 10;
    
    // Apply min/max validation
    if (max !== undefined && rials > max) {
      onChange(max);
      return;
    }
    if (min !== undefined && rials < min) {
      if (rials === 0 && inputValue === '') {
        onChange(0);
        return;
      }
      onChange(min);
      return;
    }
    
    onChange(rials);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      )}
      
      <div className="relative w-full">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-2 rounded-lg border text-right font-medium tracking-wide
            ${error 
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 focus:ring-main-orange focus:border-main-orange'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            focus:ring-2 focus:outline-none
            transition-colors duration-200
            text-base
            pr-4 pl-28
          `}
          dir="rtl"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">
          تومان
        </span>
      </div>
      
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
      
      {!error && displayValue && parseFormattedNumber(displayValue) > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          معادل: {new Intl.NumberFormat('fa-IR').format(parseFormattedNumber(displayValue) * 10)} ریال
        </p>
      )}
    </div>
  );
}

/**
 * Simple Money Display Component (read-only)
 */
interface MoneyDisplayProps {
  value: number; // in Rials
  className?: string;
  showLabel?: boolean;
}

export function MoneyDisplay({ value, className = '', showLabel = true }: MoneyDisplayProps) {
  const tomans = Math.floor(value / 10);
  const formatted = new Intl.NumberFormat('fa-IR').format(tomans);
  
  return (
    <span className={`font-medium ${className}`}>
      {formatted}
      {showLabel && <span className="text-sm text-gray-500 mr-1">تومان</span>}
    </span>
  );
}

