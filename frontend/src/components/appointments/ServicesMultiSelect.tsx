'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toTomans } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Service {
  id: number;
  name: string;
  price: number; // in RIAL
  durationMinutes: number;
  description?: string;
}

interface ServicesMultiSelectProps {
  services: Service[];
  selectedServiceIds: number[];
  onChange: (serviceIds: number[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
  hidePrices?: boolean; // Hide prices for customers
}

export default function ServicesMultiSelect({
  services,
  selectedServiceIds,
  onChange,
  label = 'سرویس‌ها *',
  required = true,
  error,
  hidePrices = false,
}: ServicesMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));

  const toggleService = (serviceId: number) => {
    if (selectedServiceIds.includes(serviceId)) {
      onChange(selectedServiceIds.filter(id => id !== serviceId));
    } else {
      onChange([...selectedServiceIds, serviceId]);
    }
  };

  const removeService = (serviceId: number) => {
    onChange(selectedServiceIds.filter(id => id !== serviceId));
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div className="space-y-2" dir="rtl">
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between text-right h-auto min-h-[40px] py-2',
              error && 'border-red-500',
              selectedServiceIds.length === 0 && 'text-muted-foreground'
            )}
          >
            <span className="flex-1 text-right">
              {selectedServiceIds.length > 0
                ? `${selectedServiceIds.length} سرویس انتخاب شده`
                : 'انتخاب سرویس...'}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>انتخاب سرویس‌ها</DialogTitle>
            <DialogDescription>
              سرویس‌های مورد نظر را انتخاب کنید
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {services.map((service) => (
              <div
                key={service.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  selectedServiceIds.includes(service.id) && 'border-main-orange bg-orange-50 dark:bg-orange-900/20'
                )}
                onClick={() => toggleService(service.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    checked={selectedServiceIds.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <div className="flex-1 text-right">
                    <div className="font-medium">{service.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 justify-end">
                      <span>{service.durationMinutes} دقیقه</span>
                      {!hidePrices && (
                        <>
                          <span>•</span>
                          <span>{toTomans(service.price)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setOpen(false)} className="bg-main-orange hover:bg-main-orange/90">
              تأیید ({selectedServiceIds.length} سرویس)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selected Services */}
      {selectedServices.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((service) => (
              <Badge
                key={service.id}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1"
              >
                <span>{service.name}</span>
                <button
                  type="button"
                  onClick={() => removeService(service.id)}
                  className="mr-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
            {!hidePrices && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">مجموع قیمت:</span>
                <span className="font-bold text-main-orange">{toTomans(totalPrice)}</span>
              </div>
            )}
            <div className={cn("flex justify-between items-center", !hidePrices && "mt-1")}>
              <span className="text-muted-foreground">مجموع زمان:</span>
              <span className="font-medium">{totalDuration} دقیقه</span>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
