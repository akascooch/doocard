"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Building2,
  FileText,
  RefreshCcw,
  Search
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/axios'
import MoneyInput from '@/components/ui/MoneyInput'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { toThousandTomans, formatRials } from '@/lib/money'
import { formatToJalali, parseFromJalali, getCurrentJalaliDate, jalaliToISO } from '@/lib/date'
import { Chequebooks } from '@/components/accounting/chequebooks'

const jalaliToISOEndOfDay = (jalaliDate: string): string | null => {
  const date = parseFromJalali(jalaliDate)
  if (!date) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T23:59:59.999Z`
}

interface Transaction {
  id: number
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  amount: string
  description: string
  categoryId: number
  category: { id: number; name: string; type: string } | null
  accountId: number
  account: { id: number; name: string } | null
  destinationAccountId: number
  destinationAccount: { id: number; name: string } | null
  sourceType: string
  sourceId: number
  paymentMethod: string
  occurredAt: string
  createdAt: string
  meta: any
}

interface Category {
  id: number
  name: string
  type: 'INCOME' | 'EXPENSE'
  description: string
  isActive: boolean
  _count: { transactions: number }
}

interface BankAccount {
  id: number
  name: string
  provider: string
  accountNo: string
  isDefault: boolean
  isActive: boolean
  balance: string
  _count: { transactions: number }
}

export default function AccountingPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('transactions')
  
  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(true)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  
  // Categories state
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  // Accounts state
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)

  // Forms
  const [transactionForm, setTransactionForm] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    amount: 0,
    description: '',
    categoryId: 0,
    accountId: 0,
    sourceType: 'MANUAL',
    paymentMethod: 'CASH',
    occurredAt: getCurrentJalaliDate() // تاریخ امروز به شمسی
  })

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    description: ''
  })

  const [accountForm, setAccountForm] = useState({
    name: '',
    provider: '',
    accountNo: '',
    description: ''
  })

  const [transferForm, setTransferForm] = useState({
    fromAccountId: 0,
    toAccountId: 0,
    amount: 0,
    description: '',
    occurredAt: getCurrentJalaliDate()
  })

  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchCategories()
    fetchAccounts()
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [filterType, filterCategoryId, startDate, endDate])

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions
    const term = searchTerm.trim().toLowerCase()
    return transactions.filter((t) => {
      const description = (t.description || '').toLowerCase()
      const accountName = (t.account?.name || '').toLowerCase()
      const destinationAccountName = (t.destinationAccount?.name || '').toLowerCase()
      return (
        description.includes(term) ||
        accountName.includes(term) ||
        destinationAccountName.includes(term)
      )
    })
  }, [transactions, searchTerm])

  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
    [filteredTransactions]
  )

  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true)
      const dateParams: Record<string, string> = {}
      if (startDate) {
        const from = jalaliToISO(startDate)
        if (from) dateParams.from = from
      }
      if (endDate) {
        const to = jalaliToISOEndOfDay(endDate)
        if (to) dateParams.to = to
      }
      const response = await api.get('/accounting/transactions', {
        params: {
          ...(filterType ? { type: filterType } : {}),
          ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
          ...dateParams
        }
      })
      setTransactions(response.data.data || [])
    } catch (error: any) {
      console.error('❌ Error fetching transactions:', error)
      toast({
        title: 'خطا',
        description: 'خطا در دریافت تراکنش‌ها',
        variant: 'destructive'
      })
    } finally {
      setTransactionsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/accounting/categories')
      setCategories(response.data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounting/accounts')
      setAccounts(response.data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setAccountsLoading(false)
    }
  }

  // Transaction handlers
  const handleCreateTransaction = async () => {
    try {
      // Validate form
      if (!transactionForm.amount || transactionForm.amount <= 0) {
        toast({
          title: 'خطا',
          description: 'لطفاً مبلغ را وارد کنید',
          variant: 'destructive'
        })
        return
      }

      // Convert Persian date to Gregorian ISO
      const occurredAtISO = jalaliToISO(transactionForm.occurredAt) || new Date().toISOString()

      const payload = {
        ...transactionForm,
        occurredAt: occurredAtISO
      }

      console.log('📅 Persian date:', transactionForm.occurredAt, '→ ISO:', occurredAtISO)
      
      await api.post('/accounting/transactions', payload)
      
      toast({ title: 'موفق', description: 'تراکنش با موفقیت ثبت شد' })
      setIsTransactionDialogOpen(false)
      resetTransactionForm()
      
      // Refresh data
      fetchTransactions()
      fetchAccounts()
    } catch (error: any) {
      console.error('❌ Error creating transaction:', error)
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در ثبت تراکنش',
        variant: 'destructive'
      })
    }
  }

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return
    try {
      // Convert Persian date to Gregorian ISO
      const occurredAtISO = jalaliToISO(transactionForm.occurredAt) || new Date().toISOString()

      const payload = {
        ...transactionForm,
        occurredAt: occurredAtISO
      }

      console.log('📅 Update - Persian date:', transactionForm.occurredAt, '→ ISO:', occurredAtISO)

      await api.patch(`/accounting/transactions/${editingTransaction.id}`, payload)
      toast({ title: 'موفق', description: 'تراکنش به‌روزرسانی شد' })
      setIsTransactionDialogOpen(false)
      setEditingTransaction(null)
      resetTransactionForm()
      fetchTransactions()
      fetchAccounts()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('آیا مطمئن هستید؟ این عملیات قابل بازگشت نیست.')) return
    try {
      await api.delete(`/accounting/transactions/${id}`)
      toast({ title: 'موفق', description: 'تراکنش حذف شد' })
      fetchTransactions()
      fetchAccounts()
    } catch (error: any) {
      toast({ title: 'خطا', description: 'خطا در حذف تراکنش', variant: 'destructive' })
    }
  }

  // Category handlers
  const handleCreateCategory = async () => {
    try {
      await api.post('/accounting/categories', categoryForm)
      toast({ title: 'موفق', description: 'دسته‌بندی ایجاد شد' })
      setIsCategoryDialogOpen(false)
      resetCategoryForm()
      fetchCategories()
    } catch (error: any) {
      toast({ title: 'خطا', description: 'خطا در ایجاد دسته‌بندی', variant: 'destructive' })
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory) return
    try {
      await api.patch(`/accounting/categories/${editingCategory.id}`, categoryForm)
      toast({ title: 'موفق', description: 'دسته‌بندی به‌روزرسانی شد' })
      setIsCategoryDialogOpen(false)
      setEditingCategory(null)
      resetCategoryForm()
      fetchCategories()
    } catch (error: any) {
      toast({ title: 'خطا', description: 'خطا در به‌روزرسانی', variant: 'destructive' })
    }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('آیا مطمئن هستید؟')) return
    try {
      await api.delete(`/accounting/categories/${id}`)
      toast({ title: 'موفق', description: 'دسته‌بندی حذف شد' })
      fetchCategories()
    } catch (error: any) {
      toast({ title: 'خطا', description: error.response?.data?.message || 'خطا در حذف', variant: 'destructive' })
    }
  }

  // Account handlers
  const handleCreateAccount = async () => {
    try {
      await api.post('/accounting/accounts', accountForm)
      toast({ title: 'موفق', description: 'حساب بانکی ایجاد شد' })
      setIsAccountDialogOpen(false)
      resetAccountForm()
      fetchAccounts()
    } catch (error: any) {
      toast({ title: 'خطا', description: 'خطا در ایجاد حساب', variant: 'destructive' })
    }
  }

  const handleSetDefaultAccount = async (id: number) => {
    try {
      await api.patch(`/accounting/accounts/${id}/set-default`)
      toast({ title: 'موفق', description: 'حساب پیش‌فرض تنظیم شد' })
      fetchAccounts()
    } catch (error: any) {
      toast({ title: 'خطا', description: 'خطا در تنظیم حساب پیش‌فرض', variant: 'destructive' })
    }
  }

  // Transfer handlers
  const handleCreateTransfer = async () => {
    try {
      // Validate
      if (!transferForm.fromAccountId || transferForm.fromAccountId === 0) {
        toast({ title: 'خطا', description: 'لطفاً حساب مبدا را انتخاب کنید', variant: 'destructive' })
        return
      }
      if (!transferForm.toAccountId || transferForm.toAccountId === 0) {
        toast({ title: 'خطا', description: 'لطفاً حساب مقصد را انتخاب کنید', variant: 'destructive' })
        return
      }
      if (transferForm.fromAccountId === transferForm.toAccountId) {
        toast({ title: 'خطا', description: 'حساب مبدا و مقصد نمی‌توانند یکسان باشند', variant: 'destructive' })
        return
      }
      if (!transferForm.amount || transferForm.amount <= 0) {
        toast({ title: 'خطا', description: 'لطفاً مبلغ را وارد کنید', variant: 'destructive' })
        return
      }

      // Convert date
      const occurredAtISO = jalaliToISO(transferForm.occurredAt) || new Date().toISOString()

      const payload = {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: transferForm.amount,
        description: transferForm.description,
        occurredAt: occurredAtISO
      }

      await api.post('/accounting/transfers', payload)
      
      toast({ title: 'موفق', description: 'انتقال بین حساب‌ها با موفقیت انجام شد' })
      setIsTransferDialogOpen(false)
      resetTransferForm()
      
      // Refresh data
      fetchTransactions()
      fetchAccounts()
    } catch (error: any) {
      console.error('❌ Error creating transfer:', error)
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در انتقال وجه',
        variant: 'destructive'
      })
    }
  }

  const resetTransactionForm = () => {
    setTransactionForm({
      type: 'INCOME',
      amount: 0,
      description: '',
      categoryId: 0,
      accountId: 0,
      sourceType: 'MANUAL',
      paymentMethod: 'CASH',
      occurredAt: getCurrentJalaliDate()
    })
  }

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', type: 'INCOME', description: '' })
  }

  const resetAccountForm = () => {
    setAccountForm({ name: '', provider: '', accountNo: '', description: '' })
  }

  const resetTransferForm = () => {
    setTransferForm({
      fromAccountId: 0,
      toAccountId: 0,
      amount: 0,
      description: '',
      occurredAt: getCurrentJalaliDate()
    })
  }

  const startEditTransaction = (transaction: Transaction) => {
    // Cannot edit TRANSFER transactions
    if (transaction.type === 'TRANSFER') {
      toast({
        title: '⚠️ غیرقابل ویرایش',
        description: 'تراکنش‌های انتقالی قابل ویرایش نیستند',
        variant: 'destructive',
      })
      return
    }

    setEditingTransaction(transaction)
    setTransactionForm({
      type: transaction.type as 'INCOME' | 'EXPENSE',
      amount: Number(transaction.amount),
      description: transaction.description || '',
      categoryId: transaction.categoryId || 0,
      accountId: transaction.accountId || 0,
      sourceType: transaction.sourceType || 'MANUAL',
      paymentMethod: transaction.paymentMethod || 'CASH',
      occurredAt: formatToJalali(transaction.occurredAt)
    })
    setIsTransactionDialogOpen(true)
  }

  const startEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      type: category.type,
      description: category.description || ''
    })
    setIsCategoryDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">حسابداری</h1>
        <p className="text-muted-foreground mt-2">مدیریت تراکنش‌ها، حساب‌ها و گزارشات مالی</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
          <TabsTrigger value="categories">دسته‌بندی‌ها</TabsTrigger>
          <TabsTrigger value="accounts">حساب‌های بانکی</TabsTrigger>
          <TabsTrigger value="chequebooks">دسته چک</TabsTrigger>
          <TabsTrigger value="reports">گزارشات</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle>لیست تراکنش‌ها</CardTitle>
                  <div className="flex gap-2">
                  <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" onClick={resetTransferForm}>
                        <RefreshCcw className="h-4 w-4 ml-2" />
                        جابه‌جایی بین حساب‌ها
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>جابه‌جایی بین حساب‌های بانکی</DialogTitle>
                        <DialogDescription>انتقال وجه از یک حساب به حساب دیگر</DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>از حساب *</Label>
                            <Select value={String(transferForm.fromAccountId || '')} onValueChange={(val) => setTransferForm({...transferForm, fromAccountId: parseInt(val)})}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب حساب مبدا" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.filter(a => a.id !== transferForm.toAccountId).map(acc => (
                                  <SelectItem key={acc.id} value={String(acc.id)}>
                                    {acc.name} ({toThousandTomans(Number(acc.balance))})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>به حساب *</Label>
                            <Select value={String(transferForm.toAccountId || '')} onValueChange={(val) => setTransferForm({...transferForm, toAccountId: parseInt(val)})}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب حساب مقصد" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.filter(a => a.id !== transferForm.fromAccountId).map(acc => (
                                  <SelectItem key={acc.id} value={String(acc.id)}>
                                    {acc.name} ({toThousandTomans(Number(acc.balance))})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <MoneyInput
                          value={transferForm.amount}
                          onChange={(amount) => setTransferForm({...transferForm, amount})}
                          label="مبلغ انتقال *"
                          placeholder="مثال: 500,000"
                          required
                        />

                        <div>
                          <Label>توضیحات (اختیاری)</Label>
                          <Input
                            value={transferForm.description}
                            onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                            placeholder="دلیل انتقال وجه"
                          />
                        </div>

                        <PersianDatePicker
                          value={transferForm.occurredAt}
                          onChange={(date) => setTransferForm({...transferForm, occurredAt: date})}
                          label="تاریخ انتقال"
                          placeholder="مثال: ۱۴۰۳/۰۷/۲۱"
                          maxDate={getCurrentJalaliDate()}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                          انصراف
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateTransfer}>
                          <RefreshCcw className="h-4 w-4 ml-2" />
                          انجام انتقال
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-main-orange hover:bg-main-orange/90" onClick={() => {
                        setEditingTransaction(null)
                        resetTransactionForm()
                      }}>
                        <Plus className="h-4 w-4 ml-2" />
                        تراکنش جدید
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>{editingTransaction ? 'ویرایش تراکنش' : 'ثبت تراکنش جدید'}</DialogTitle>
                        <DialogDescription>اطلاعات تراکنش را وارد کنید</DialogDescription>
                      </DialogHeader>
                      
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>نوع تراکنش *</Label>
                            <Select value={transactionForm.type} onValueChange={(val: any) => setTransactionForm({...transactionForm, type: val})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INCOME">درآمد</SelectItem>
                                <SelectItem value="EXPENSE">هزینه</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <MoneyInput
                              value={transactionForm.amount}
                              onChange={(amount) => setTransactionForm({...transactionForm, amount})}
                              label="مبلغ *"
                              placeholder="مثال: 125,000"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <Label>توضیحات</Label>
                          <Input
                            value={transactionForm.description}
                            onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                            placeholder="توضیحات تراکنش"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>دسته‌بندی</Label>
                            <Select value={String(transactionForm.categoryId || '')} onValueChange={(val) => setTransactionForm({...transactionForm, categoryId: parseInt(val)})}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب دسته‌بندی" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories
                                  .filter(c => c.type === transactionForm.type)
                                  .map(cat => (
                                    <SelectItem key={cat.id} value={String(cat.id)}>
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>حساب بانکی</Label>
                            <Select value={String(transactionForm.accountId || '')} onValueChange={(val) => setTransactionForm({...transactionForm, accountId: parseInt(val)})}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب حساب" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map(acc => (
                                  <SelectItem key={acc.id} value={String(acc.id)}>
                                    {acc.name} {acc.isDefault && '(پیش‌فرض)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <PersianDatePicker
                            value={transactionForm.occurredAt}
                            onChange={(date) => {
                              console.log('📅 Date changed to:', date)
                              setTransactionForm({...transactionForm, occurredAt: date})
                            }}
                            label="تاریخ تراکنش"
                            placeholder="مثال: ۱۴۰۳/۰۷/۲۱"
                            maxDate={getCurrentJalaliDate()}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            تاریخ انتخاب شده: {transactionForm.occurredAt}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => {
                          setIsTransactionDialogOpen(false)
                          setEditingTransaction(null)
                        }}>
                          انصراف
                        </Button>
                        <Button className="bg-main-orange hover:bg-main-orange/90" onClick={editingTransaction ? handleUpdateTransaction : handleCreateTransaction}>
                          {editingTransaction ? 'به‌روزرسانی' : 'ثبت تراکنش'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                </div>
                <Badge
                  variant="secondary"
                  className="w-fit bg-muted/50 text-foreground border border-border font-normal px-3 py-1.5 text-sm"
                >
                  مجموع تراکنش‌های این لیست: {formatRials(totalAmount)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col xl:flex-row flex-wrap items-stretch xl:items-end gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">متن جستجو</Label>
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="جستجو در توضیحات یا نام حساب..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pr-10 bg-background border-input text-foreground"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-[140px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">نوع</Label>
                    <Select
                      value={filterType ?? 'ALL'}
                      onValueChange={(v) => setFilterType(v === 'ALL' ? null : v)}
                    >
                      <SelectTrigger className="w-full bg-background border-input text-foreground">
                        <SelectValue placeholder="نوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">همه</SelectItem>
                        <SelectItem value="INCOME">درآمد</SelectItem>
                        <SelectItem value="EXPENSE">هزینه</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-[180px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">دسته‌بندی</Label>
                    <Select
                      value={filterCategoryId === null ? 'ALL' : String(filterCategoryId)}
                      onValueChange={(v) => setFilterCategoryId(v === 'ALL' ? null : Number(v))}
                    >
                      <SelectTrigger className="w-full bg-background border-input text-foreground">
                        <SelectValue placeholder="دسته‌بندی" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">همه</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-[160px]">
                    <PersianDatePicker
                      value={startDate}
                      onChange={setStartDate}
                      label="از تاریخ"
                      placeholder="۱۴۰۳/۰۱/۰۱"
                      maxDate={endDate || getCurrentJalaliDate()}
                    />
                  </div>
                  <div className="w-full sm:w-[160px]">
                    <PersianDatePicker
                      value={endDate}
                      onChange={setEndDate}
                      label="تا تاریخ"
                      placeholder="۱۴۰۳/۱۲/۲۹"
                      minDate={startDate || undefined}
                      maxDate={getCurrentJalaliDate()}
                    />
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setStartDate('')
                        setEndDate('')
                      }}
                    >
                      پاک کردن تاریخ
                    </Button>
                  )}
                </div>
              </div>
              {transactionsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاریخ</TableHead>
                      <TableHead>نوع</TableHead>
                      <TableHead>مبلغ</TableHead>
                      <TableHead>دسته‌بندی</TableHead>
                      <TableHead>حساب</TableHead>
                      <TableHead>توضیحات</TableHead>
                      <TableHead>عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
                            <p>هنوز تراکنشی ثبت نشده است</p>
                            <p className="text-sm">با کلیک روی "تراکنش جدید" اولین تراکنش خود را ثبت کنید</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatToJalali(transaction.occurredAt)}</TableCell>
                          <TableCell>
                            {transaction.type === 'INCOME' ? (
                              <Badge className="bg-green-100 text-green-800">درآمد</Badge>
                            ) : transaction.type === 'EXPENSE' ? (
                              <Badge className="bg-red-100 text-red-800">هزینه</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800">انتقال</Badge>
                            )}
                          </TableCell>
                          <TableCell className={
                            transaction.type === 'INCOME' ? 'text-green-600 font-bold' : 
                            transaction.type === 'EXPENSE' ? 'text-red-600 font-bold' : 
                            'text-blue-600 font-bold'
                          }>
                            {toThousandTomans(Number(transaction.amount))}
                          </TableCell>
                          <TableCell>{transaction.category?.name || '-'}</TableCell>
                          <TableCell>
                            {transaction.type === 'TRANSFER' ? (
                              <div className="text-sm">
                                <div className="flex items-center gap-1">
                                  <span className="text-red-600">{transaction.account?.name}</span>
                                  <span>←</span>
                                  <span className="text-green-600">{transaction.destinationAccount?.name}</span>
                                </div>
                              </div>
                            ) : (
                              transaction.account?.name || '-'
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{transaction.description || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {transaction.type !== 'TRANSFER' && (
                                <Button variant="outline" size="sm" onClick={() => startEditTransaction(transaction)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => handleDeleteTransaction(transaction.id)} className="text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>دسته‌بندی‌ها</CardTitle>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-main-orange hover:bg-main-orange/90" onClick={() => {
                      setEditingCategory(null)
                      resetCategoryForm()
                    }}>
                      <Plus className="h-4 w-4 ml-2" />
                      دسته‌بندی جدید
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingCategory ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label>نام *</Label>
                        <Input value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
                      </div>
                      <div>
                        <Label>نوع *</Label>
                        <Select value={categoryForm.type} onValueChange={(val: any) => setCategoryForm({...categoryForm, type: val})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCOME">درآمد</SelectItem>
                            <SelectItem value="EXPENSE">هزینه</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>توضیحات</Label>
                        <Input value={categoryForm.description} onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>انصراف</Button>
                      <Button className="bg-main-orange hover:bg-main-orange/90" onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}>
                        {editingCategory ? 'به‌روزرسانی' : 'ایجاد'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-green-600 mb-3">دسته‌بندی‌های درآمد</h3>
                  {categories.filter(c => c.type === 'INCOME').map((cat) => (
                    <Card key={cat.id} className="mb-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{cat.name}</div>
                            <div className="text-xs text-muted-foreground">{cat._count.transactions} تراکنش</div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => startEditCategory(cat)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)} className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div>
                  <h3 className="font-medium text-red-600 mb-3">دسته‌بندی‌های هزینه</h3>
                  {categories.filter(c => c.type === 'EXPENSE').map((cat) => (
                    <Card key={cat.id} className="mb-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{cat.name}</div>
                            <div className="text-xs text-muted-foreground">{cat._count.transactions} تراکنش</div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => startEditCategory(cat)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)} className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>حساب‌های بانکی</CardTitle>
                <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-main-orange hover:bg-main-orange/90" onClick={resetAccountForm}>
                      <Plus className="h-4 w-4 ml-2" />
                      حساب جدید
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>حساب بانکی جدید</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label>نام حساب *</Label>
                        <Input value={accountForm.name} onChange={(e) => setAccountForm({...accountForm, name: e.target.value})} placeholder="مثال: حساب اصلی بانک ملی" />
                      </div>
                      <div>
                        <Label>نام بانک</Label>
                        <Input value={accountForm.provider} onChange={(e) => setAccountForm({...accountForm, provider: e.target.value})} placeholder="مثال: بانک ملی" />
                      </div>
                      <div>
                        <Label>شماره حساب</Label>
                        <Input value={accountForm.accountNo} onChange={(e) => setAccountForm({...accountForm, accountNo: e.target.value})} placeholder="XXXX-XXXX-XXXX-XXXX" />
                      </div>
                      <div>
                        <Label>توضیحات</Label>
                        <Input value={accountForm.description} onChange={(e) => setAccountForm({...accountForm, description: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>انصراف</Button>
                      <Button className="bg-main-orange hover:bg-main-orange/90" onClick={handleCreateAccount}>ایجاد حساب</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                  <Card key={account.id} className={account.isDefault ? 'border-main-orange' : ''}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-main-orange" />
                            <span className="font-medium">{account.name}</span>
                          </div>
                          {account.isDefault && (
                            <Badge className="bg-main-orange text-white">پیش‌فرض</Badge>
                          )}
                        </div>
                        
                        {account.provider && (
                          <div className="text-sm text-muted-foreground">
                            بانک: {account.provider}
                          </div>
                        )}
                        
                        <div className="text-lg font-bold text-blue-600">
                          موجودی: {toThousandTomans(Number(account.balance))}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {account._count.transactions} تراکنش
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          {!account.isDefault && (
                            <Button variant="outline" size="sm" onClick={() => handleSetDefaultAccount(account.id)} className="flex-1">
                              پیش‌فرض
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chequebooks Tab */}
        <TabsContent value="chequebooks" className="space-y-4">
          <Chequebooks accounts={accounts} />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>گزارشات مالی</CardTitle>
              <CardDescription>گزارش‌های خلاصه و تحلیل مالی</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">گزارشات تفصیلی به زودی...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

