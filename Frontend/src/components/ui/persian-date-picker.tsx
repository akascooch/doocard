"use client"

import { useState } from "react"

interface PersianDatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

export function isValidJalali(str: string) {
  // فرمت ساده: 1403/03/25
  return /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)
}

const toEnglishDigits = (str: string) =>
  str.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

export function PersianDatePicker({
  value,
  onChange,
  placeholder = "تاریخ تولد (مثلاً 1377/11/22)",
  className,
}: PersianDatePickerProps) {
  return (
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border rounded px-2 py-1 text-sm ${className || ''}`}
      autoComplete="off"
      dir="ltr"
      maxLength={10}
    />
  )
} 