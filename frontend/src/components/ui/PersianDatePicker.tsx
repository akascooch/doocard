"use client"

import React, { useState, useEffect } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import type { Value } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { persianToEnglishDigits } from '@/lib/date';
import { Label } from './label';

interface PersianDatePickerProps {
  value?: string; // Jalali date string YYYY/MM/DD
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  minDate?: string; // Jalali date string
  maxDate?: string; // Jalali date string
  className?: string;
  required?: boolean;
  format?: string;
  /** When true, calendar uses portal=false so it stays inside parent (avoids clipping in modals) */
  disablePortal?: boolean;
}

/**
 * Persian (Jalali/Shamsi) Date Picker Component
 * 
 * Features:
 * - Full Jalali calendar support
 * - Persian locale (month names, weekdays in Farsi)
 * - Supports both clicking calendar and typing
 * - Auto-converts Persian digits to English
 * - Validates date input
 * 
 * @example
 * <PersianDatePicker
 *   value={birthdate}
 *   onChange={setBirthdate}
 *   label="تاریخ تولد"
 *   placeholder="۱۳۷۰/۰۱/۰۱"
 * />
 */
export default function PersianDatePicker({
  value,
  onChange,
  label,
  placeholder = 'تاریخ را انتخاب کنید',
  error,
  disabled = false,
  minDate,
  maxDate,
  className = '',
  required = false,
  format = 'YYYY/MM/DD',
  disablePortal = false,
}: PersianDatePickerProps) {
  const [dateValue, setDateValue] = useState<Value>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalTarget(document.body);
  }, []);

  // Radix Dialog sets body { pointer-events: none }. Portaled calendars must opt back in.
  useEffect(() => {
    if (disablePortal || typeof document === 'undefined') return;
    const styleId = 'rmdp-portal-dialog-fix';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .rmdp-portal {
        pointer-events: auto !important;
        z-index: 10050 !important;
      }
    `;
    document.head.appendChild(style);
  }, [disablePortal]);

  // Convert string value to DateObject when value prop changes
  useEffect(() => {
    if (value) {
      try {
        // Normalize Persian digits to English
        const normalizedValue = persianToEnglishDigits(value);
        const [year, month, day] = normalizedValue.split('/').map(Number);
        
        if (year && month && day) {
          setDateValue(new DateObject({
            calendar: persian,
            locale: persian_fa,
            year,
            month,
            day,
          }));
        }
      } catch (error) {
        console.error('Error parsing date value:', error);
        setDateValue(null);
      }
    } else {
      setDateValue(null);
    }
  }, [value]);

  const handleChange = (date: Value) => {
    setDateValue(date);

    if (date && typeof date === 'object' && 'format' in date) {
      // Always emit English digits YYYY/MM/DD so consumers can parse reliably
      const formatted = persianToEnglishDigits((date as DateObject).format(format));
      onChange(formatted);
    } else if (!date) {
      onChange('');
    }
  };

  const getMinMaxDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    
    try {
      const normalizedDate = persianToEnglishDigits(dateStr);
      const [year, month, day] = normalizedDate.split('/').map(Number);
      return new DateObject({
        calendar: persian,
        locale: persian_fa,
        year,
        month,
        day,
      });
    } catch {
      return undefined;
    }
  };

  return (
    <div className={`space-y-2 ${className} ${disablePortal ? 'relative overflow-visible' : ''}`}>
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      )}
      
      <DatePicker
        value={dateValue}
        onChange={handleChange}
        calendar={persian}
        locale={persian_fa}
        format={format}
        placeholder={placeholder}
        disabled={disabled}
        minDate={getMinMaxDate(minDate)}
        maxDate={getMinMaxDate(maxDate)}
        editable
        inputClass={`
          w-full px-4 py-2 rounded-lg border text-right
          ${error 
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-main-orange focus:border-main-orange'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          focus:ring-2 focus:outline-none
          transition-colors duration-200
          text-sm
        `}
        containerClassName="w-full"
        calendarPosition="bottom-right"
        weekDays={['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']}
        months={[
          'فروردین',
          'اردیبهشت',
          'خرداد',
          'تیر',
          'مرداد',
          'شهریور',
          'مهر',
          'آبان',
          'آذر',
          'دی',
          'بهمن',
          'اسفند',
        ]}
        style={{
          width: '100%',
        }}
        // Inside modals: keep calendar in-tree (disablePortal). Otherwise portal to body.
        // Portaled calendars need pointer-events:auto — Radix Dialog sets body to none.
        portal={!disablePortal && !!portalTarget}
        {...(!disablePortal && portalTarget ? { portalTarget } : {})}
        zIndex={10050}
      />
      
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

/**
 * Time Picker Component (24-hour format)
 */
interface TimePickerProps {
  value?: string; // HH:mm format
  onChange: (time: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function TimePicker({
  value = '',
  onChange,
  label,
  error,
  disabled = false,
  className = '',
  required = false,
}: TimePickerProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      )}
      
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full px-4 py-2 rounded-lg border text-right
          ${error 
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-main-orange focus:border-main-orange'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          focus:ring-2 focus:outline-none
          transition-colors duration-200
          text-sm
        `}
      />
      
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

/**
 * Combined Date and Time Picker
 */
interface DateTimePickerProps {
  dateValue?: string;
  timeValue?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  dateLabel?: string;
  timeLabel?: string;
  dateError?: string;
  timeError?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  dateLabel = 'تاریخ',
  timeLabel = 'ساعت',
  dateError,
  timeError,
  disabled = false,
  className = '',
  required = false,
}: DateTimePickerProps) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <PersianDatePicker
        value={dateValue}
        onChange={onDateChange}
        label={dateLabel}
        error={dateError}
        disabled={disabled}
        required={required}
      />
      
      <TimePicker
        value={timeValue}
        onChange={onTimeChange}
        label={timeLabel}
        error={timeError}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}

