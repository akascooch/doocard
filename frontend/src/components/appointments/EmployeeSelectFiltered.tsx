'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  type EmployeeListItem,
  getEmployeeDisplayName,
  normalizeEmployeeList,
} from '@/lib/employee';
import { cacheFromResponse, getReferenceCache, REFERENCE_KEYS } from '@/lib/offline/reference-cache';

interface Service {
  id: number;
  name: string;
}

interface EmployeeService {
  id: number;
  serviceId: number;
  service: Service;
}

type Employee = EmployeeListItem;

interface EmployeeSelectFilteredProps {
  selectedServiceIds: number[];
  selectedEmployeeId: number | null;
  onChange: (employeeId: number | null) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function EmployeeSelectFiltered({
  selectedServiceIds,
  selectedEmployeeId,
  onChange,
  label = 'آرایشگر',
  required = false,
  error,
}: EmployeeSelectFilteredProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/employees');
      console.log('👥 Loaded employees:', response.data);
      const data = normalizeEmployeeList(await cacheFromResponse(REFERENCE_KEYS.employees, response.data));
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      const cached = await getReferenceCache<EmployeeListItem[]>(REFERENCE_KEYS.employees);
      if (cached?.data?.length) {
        setEmployees(normalizeEmployeeList(cached.data));
      } else {
        toast({
          title: 'خطا',
          description: 'بارگذاری لیست آرایشگران با خطا مواجه شد',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter employees who can perform at least one of the selected services
  const filteredEmployees = employees.filter(employee => {
    if (selectedServiceIds.length === 0) return true; // Show all if no services selected
    
    if (!employee.employeeServices || !Array.isArray(employee.employeeServices)) {
      return false;
    }
    
    const employeeServiceIds = employee.employeeServices.map(es => es.serviceId);
    return selectedServiceIds.some(sid => employeeServiceIds.includes(sid));
  });

  // Get matching services for an employee (badges)
  const getMatchingServices = (employee: Employee): Service[] => {
    if (selectedServiceIds.length === 0) return [];
    
    if (!employee.employeeServices || !Array.isArray(employee.employeeServices)) {
      return [];
    }
    
    const employeeServiceIds = employee.employeeServices.map(es => es.serviceId);
    return employee.employeeServices
      .filter(es => selectedServiceIds.includes(es.serviceId))
      .map(es => es.service)
      .filter((s): s is Service => s != null);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {label && (
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 mr-1">*</span>}
          </Label>
        )}
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      )}

      <Select
        value={selectedEmployeeId?.toString() || ''}
        onValueChange={(val) => onChange(val ? parseInt(val) : null)}
      >
        <SelectTrigger className={cn('text-right', error && 'border-red-500')}>
          <SelectValue placeholder="انتخاب آرایشگر..." />
        </SelectTrigger>
        <SelectContent>
          {filteredEmployees.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {selectedServiceIds.length > 0
                ? 'هیچ آرایشگری برای سرویس‌های انتخابی یافت نشد'
                : 'لطفاً ابتدا سرویس را انتخاب کنید'}
            </div>
          ) : (
            filteredEmployees.map((employee) => {
              const matchingServices = getMatchingServices(employee);
              
              return (
                <SelectItem key={employee.id} value={employee.id.toString()}>
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex gap-1 flex-wrap justify-start">
                      {matchingServices.map(service => (
                        <Badge
                          key={service.id}
                          variant="outline"
                          className="text-xs px-1.5 py-0"
                        >
                          {service.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-medium">{getEmployeeDisplayName(employee)}</div>
                      {employee.specialty && (
                        <div className="text-xs text-muted-foreground">
                          {employee.specialty}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>

      {selectedServiceIds.length > 0 && filteredEmployees.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filteredEmployees.length} آرایشگر برای سرویس‌های انتخابی موجود است
        </p>
      )}

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}

