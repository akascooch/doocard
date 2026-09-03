"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { faIR } from "date-fns/locale"
import * as jalaali from "jalaali-js"

interface PersianDatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: (date: Date) => boolean
}

export function isValidJalali(str: string) {
  // فرمت ساده: 1403/03/25
  return /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)
}

const toEnglishDigits = (str: string) =>
  str.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

const toPersianDigits = (str: string) =>
  str.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d)]);

export function PersianDatePicker({
  value,
  onChange,
  placeholder = "تاریخ را انتخاب کنید",
  className,
  disabled,
}: PersianDatePickerProps) {
  const [open, setOpen] = useState(false)

  const formatPersianDate = (date: Date) => {
    const jalali = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return `${jalali.jy}/${jalali.jm.toString().padStart(2, '0')}/${jalali.jd.toString().padStart(2, '0')}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${className || ''}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? toPersianDigits(formatPersianDate(value)) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
          disabled={disabled}
          initialFocus
          locale={faIR}
        />
      </PopoverContent>
    </Popover>
  )
}

// Simple text input version for backward compatibility
export function PersianDateInput({
  value,
  onChange,
  placeholder = "تاریخ تولد (مثلاً 1377/11/22)",
  className,
}: {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}) {
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