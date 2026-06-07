'use client';

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { faIR } from 'date-fns/locale'

interface DateFilterProps {
  onDateChange: (date: Date | undefined) => void
  selectedDate?: Date
}

export function DateFilter({ onDateChange, selectedDate }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start text-left font-normal"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {selectedDate ? (
          format(selectedDate, 'PPP', { locale: faIR })
        ) : (
          <span>انتخاب تاریخ</span>
        )}
      </Button>
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onDateChange(date)
              setIsOpen(false)
            }}
            locale={faIR}
            className="rounded-md border"
          />
        </div>
      )}
    </div>
  )
} 