'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, User, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface Customer {
  id: number;
  user?: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  } | null;
}

interface CustomerTypeaheadProps {
  selectedCustomerId: number | null;
  onChange: (customerId: number | null, customer?: Customer) => void;
  label?: string;
  required?: boolean;
  error?: string;
  prefillPhone?: string;
}

export default function CustomerTypeahead({
  selectedCustomerId,
  onChange,
  label = 'مشتری *',
  required = true,
  error,
  prefillPhone = '',
}: CustomerTypeaheadProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: prefillPhone,
    email: '',
  });

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setCustomers([]);
      return;
    }

    const timer = setTimeout(() => {
      searchCustomers(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchCustomers = async (query: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/customers`, {
        params: { search: query },
      });
      console.log('🔍 Customer search results:', response.data);
      setCustomers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    onChange(customer.id, customer);
    setOpen(false);
    setSearchQuery('');
  };

  const handleQuickAdd = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      toast({
        title: 'خطا',
        description: 'نام و شماره تلفن الزامی است',
        variant: 'destructive',
      });
      return;
    }

    try {
      const userResponse = await api.post('/users', {
        name: newCustomerForm.name,
        phone: newCustomerForm.phone,
        email: newCustomerForm.email || undefined,
        password: '123456',
        role: 'CUSTOMER',
      });

      console.log('✅ User created:', userResponse.data);

      const customersResponse = await api.get(`/customers`, {
        params: { search: newCustomerForm.phone },
      });

      const newCustomer = customersResponse.data.find(
        (c: Customer) => c.user?.phone === newCustomerForm.phone
      );

      if (newCustomer) {
        selectCustomer(newCustomer);
        toast({
          title: '✅ موفق',
          description: 'مشتری جدید با موفقیت ایجاد شد',
        });
      }

      setIsQuickAddOpen(false);
      setNewCustomerForm({ name: '', phone: '', email: '' });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast({
        title: '❌ خطا',
        description: error.response?.data?.message || 'ایجاد مشتری با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
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
                !selectedCustomer && 'text-muted-foreground'
              )}
            >
              {selectedCustomer ? (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{selectedCustomer?.user?.name ?? 'نام نامشخص'}</span>
                  <span className="text-muted-foreground text-sm">
                    ({selectedCustomer?.user?.phone ?? '—'})
                  </span>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>جستجو مشتری...</span>
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>انتخاب مشتری</DialogTitle>
              <DialogDescription>
                جستجو بر اساس نام، تلفن، یا ایمیل
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="نام، تلفن، یا ایمیل..."
                  className="pr-10 text-right"
                  dir="rtl"
                />
              </div>

              {/* Results */}
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    در حال جستجو...
                  </div>
                ) : searchQuery.length < 2 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    حداقل 2 حرف وارد کنید
                  </div>
                ) : customers.length > 0 ? (
                  customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => {
                        selectCustomer(customer);
                        setOpen(false);
                      }}
                    >
                      <div className="text-right flex-1">
                        <div className="font-medium">{customer?.user?.name ?? 'نام نامشخص'}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer?.user?.phone ?? '—'}
                          {customer?.user?.email && ` • ${customer?.user?.email}`}
                        </div>
                      </div>
                      {selectedCustomerId === customer.id && (
                        <Check className="h-5 w-5 text-main-orange" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      مشتری یافت نشد
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setNewCustomerForm({
                          ...newCustomerForm,
                          phone: searchQuery,
                        });
                        setIsQuickAddOpen(true);
                        setOpen(false);
                      }}
                      className="bg-main-orange hover:bg-main-orange/90"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      افزودن سریع مشتری
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {selectedCustomer && (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
            <span className="text-sm text-muted-foreground">
              مشتری: {selectedCustomer?.user?.name ?? 'نام نامشخص'} - {selectedCustomer?.user?.phone ?? '—'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCustomer(null);
                onChange(null);
              }}
            >
              تغییر
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>

      {/* Quick Add Customer Dialog */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>افزودن سریع مشتری</DialogTitle>
            <DialogDescription>
              اطلاعات مشتری جدید را وارد کنید
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>نام و نام خانوادگی *</Label>
              <Input
                value={newCustomerForm.name}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, name: e.target.value })
                }
                placeholder="مثال: علی احمدی"
                dir="rtl"
              />
            </div>
            <div>
              <Label>شماره تلفن *</Label>
              <Input
                value={newCustomerForm.phone}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })
                }
                placeholder="09xxxxxxxxx"
                dir="ltr"
              />
            </div>
            <div>
              <Label>ایمیل (اختیاری)</Label>
              <Input
                value={newCustomerForm.email}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, email: e.target.value })
                }
                placeholder="example@email.com"
                type="email"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              رمز عبور پیش‌فرض: 123456
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsQuickAddOpen(false)}>
              انصراف
            </Button>
            <Button
              type="button"
              className="bg-main-orange hover:bg-main-orange/90"
              onClick={handleQuickAdd}
            >
              ایجاد مشتری
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
