'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { formatNumber } from '../../lib/utils';
import api from '../../lib/axios';
import { useToast } from '../../components/ui/use-toast';
import { MagnifyingGlassIcon as SearchIcon, CalendarIcon, CurrencyDollarIcon as DollarSignIcon } from '@heroicons/react/24/outline';

interface Transaction {
  id: number;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  date: string;
  dateJalali?: string;
  category?: {
    name: string;
  };
  appointment?: {
    id: number;
    customer: {
      firstName: string;
      lastName: string;
    };
  };
}

export function BarberTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, [currentPage]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/accounting/recent-transactions?limit=${pageSize}&page=${currentPage}`);
      setTransactions(response.data || []);
      // Assuming the API returns pagination info
      setTotalPages(Math.ceil((response.data?.total || 0) / pageSize));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "خطا در دریافت تراکنش‌ها",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction =>
    transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (transaction.appointment?.customer?.firstName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (transaction.appointment?.customer?.lastName ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fa-IR');
  };

  const getTransactionIcon = (type: string) => {
    return type === 'INCOME' ? (
      <DollarSignIcon className="h-4 w-4 text-green-600" />
    ) : (
      <DollarSignIcon className="h-4 w-4 text-red-600" />
    );
  };

  const getTransactionColor = (type: string) => {
    return type === 'INCOME' ? 'text-green-600' : 'text-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>تراکنش‌های من</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تراکنش‌های من</CardTitle>
        <p className="text-sm text-muted-foreground">
          لیست تمام تراکنش‌های مربوط به نوبت‌های شما
        </p>
      </CardHeader>
      <CardContent>
        {/* جستجو */}
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو در تراکنش‌ها..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* لیست تراکنش‌ها */}
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'تراکنشی با این مشخصات یافت نشد' : 'هنوز تراکنشی ثبت نشده است'}
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <div className="font-medium">
                      {transaction.description}
                    </div>
                    {transaction.appointment && (
                      <div className="text-sm text-muted-foreground">
                        مشتری: {transaction.appointment?.customer?.firstName ?? ''} {transaction.appointment?.customer?.lastName ?? ''}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground flex items-center">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {formatDate(transaction.date)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getTransactionColor(transaction.type)}`}>
                    {transaction.type === 'INCOME' ? '+' : '-'}{formatNumber(transaction.amount)} تومان
                  </div>
                  {transaction.category && (
                    <div className="text-sm text-muted-foreground">
                      {transaction.category.name}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* صفحه‌بندی */}
        {totalPages > 1 && (
          <div className="flex justify-center space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              قبلی
            </Button>
            <span className="flex items-center px-4">
              صفحه {currentPage} از {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              بعدی
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 