"use client"

import React, { useState, useEffect, useRef } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import type { Value } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { englishToPersianDigits, formatJalaliParts, parseStrictJalaliYmd, persianToEnglishDigits } from '@/lib/date';
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
  const [draft, setDraft] = useState('');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const focusedRef = useRef(false);

  const toDateObject = (dateStr?: string) => {
    const parts = dateStr ? parseStrictJalaliYmd(dateStr) : null;
    if (!parts) return null;
    return new DateObject({
      calendar: persian,
      locale: persian_fa,
      year: parts.jy,
      month: parts.jm,
      day: parts.jd,
    });
  };

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
      @media (max-width: 640px) {
        .rmdp-calendar {
          width: min(100vw - 1.5rem, 22rem) !important;
        }
        .rmdp-day span,
        .rmdp-week-day {
          font-size: 0.9rem;
        }
        .rmdp-day {
          height: 2.75rem;
          width: 2.75rem;
        }
      }
    `;
    document.head.appendChild(style);
  }, [disablePortal]);

  // Only a strict Jalali Y-M-D becomes a DateObject. An extra segment such as
  // "1405/07/161405/10/03" must not be split into an overflowing day.
  useEffect(() => {
    const parts = value ? parseStrictJalaliYmd(value) : null;
    setDateValue(parts ? toDateObject(value) : null);
    if (!focusedRef.current) {
      setDraft(parts ? formatJalaliParts(parts, '/') : '');
    }
  }, [value]);

  const commitJalali = (raw: string) => {
    const parts = parseStrictJalaliYmd(raw);
    if (!parts) return;
    const canonical = formatJalaliParts(parts, '/');
    setDraft(canonical);
    setDateValue(toDateObject(canonical));
    onChange(canonical);
  };

  const handleChange = (date: Value) => {
    if (date && typeof date === 'object' && 'format' in date) {
      commitJalali(persianToEnglishDigits((date as DateObject).format(format)));
    } else if (!date) {
      setDateValue(null);
      setDraft('');
      onChange('');
    }
  };

  const getMinMaxDate = (dateStr?: string) => toDateObject(dateStr) ?? undefined;

  const inputClass = `
          rmdp-input
          w-full px-4 py-2 rounded-lg border text-right
          ${error
            ? 'border-destructive focus:ring-destructive focus:border-destructive'
            : 'border-border focus:border-border focus:ring-ring'
          }
          ${disabled ? 'bg-accent cursor-not-allowed' : 'bg-accent backdrop-blur-md'}
          focus:ring-1 focus:outline-none
          transition-colors duration-200
          text-sm
        `;

  return (
    <div className={`space-y-2 ${className} ${disablePortal ? 'relative overflow-visible' : ''}`} data-cy="jalali-date-picker">
      {label && (
        <Label className="text-sm font-medium text-foreground dark:text-foreground">
          {label}
          {required && <span className="text-destructive mr-1">*</span>}
        </Label>
      )}
      
      <DatePicker
        value={dateValue}
        onChange={handleChange}
        calendar={persian}
        locale={persian_fa}
        format={format}
        minDate={getMinMaxDate(minDate)}
        maxDate={getMinMaxDate(maxDate)}
        render={(_stringValue, openCalendar) => (
          <input
            className={inputClass}
            value={englishToPersianDigits(draft)}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => {
              focusedRef.current = true;
              openCalendar();
            }}
            onBlur={() => {
              focusedRef.current = false;
              const typed = parseStrictJalaliYmd(draft);
              const current = value ? parseStrictJalaliYmd(value) : null;
              const parts = typed || current;
              setDraft(parts ? formatJalaliParts(parts, '/') : '');
            }}
            onChange={(event) => {
              const next = persianToEnglishDigits(event.target.value);
              setDraft(next);
              if (!next.trim()) {
                setDateValue(null);
                onChange('');
                return;
              }
              commitJalali(next);
            }}
          />
        )}
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
        <p className="text-sm text-destructive mt-1">{error}</p>
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
        <Label className="text-sm font-medium text-foreground dark:text-foreground">
          {label}
          {required && <span className="text-destructive mr-1">*</span>}
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
            ? 'border-destructive focus:ring-destructive focus:border-destructive'
            : 'border-border focus:border-border focus:ring-ring'
          }
          ${disabled ? 'bg-accent cursor-not-allowed' : 'bg-accent backdrop-blur-md'}
          focus:ring-1 focus:outline-none
          transition-colors duration-200
          text-sm
        `}
      />
      
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
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

