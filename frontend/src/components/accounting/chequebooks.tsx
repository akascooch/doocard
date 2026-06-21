'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, Edit, Trash2, BookOpen, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/axios'
import MoneyInput from '@/components/ui/MoneyInput'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { formatRials } from '@/lib/money'
import { formatToJalali, jalaliToISO, getCurrentJalaliDate } from '@/lib/date'

type ChequeLeafStatus = 'BLANK' | 'ISSUED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED'

interface BankAccountOption {
  id: number
  name: string
  provider?: string
}

interface Chequebook {
  id: number
  bankAccountId: number
  serialNumber: string | null
  startNumber: number
  endNumber: number
  leafCount: number
  issuedAt: string | null
  isActive: boolean
  description: string | null
  bankAccount: { id: number; name: string; provider?: string | null }
  _count?: { leaves: number }
}

interface ChequeLeaf {
  id: number
  chequebookId: number
  leafNumber: number
  status: ChequeLeafStatus
  amount: number | null
  payee: string | null
  dueDate: string | null
  issuedAt: string | null
  clearedAt: string | null
  description: string | null
  transactionId: number | null
  chequebook?: {
    id: number
    serialNumber: string | null
    bankAccount: { id: number; name: string }
  }
}

const STATUS_LABELS: Record<ChequeLeafStatus, string> = {
  BLANK: 'سفید',
  ISSUED: 'صادر شده',
  CLEARED: 'وصول شده',
  BOUNCED: 'برگشتی',
  CANCELLED: 'باطل شده',
}

const STATUS_BADGE_CLASS: Record<ChequeLeafStatus, string> = {
  BLANK: 'bg-muted text-muted-foreground',
  ISSUED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  CLEARED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  BOUNCED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const NEXT_STATUS_OPTIONS: Partial<Record<ChequeLeafStatus, ChequeLeafStatus[]>> = {
  BLANK: ['ISSUED', 'CANCELLED'],
  ISSUED: ['CLEARED', 'BOUNCED', 'CANCELLED'],
}

interface ChequebooksProps {
  accounts: BankAccountOption[]
}

export function Chequebooks({ accounts }: ChequebooksProps) {
  const { toast } = useToast()
  const [chequebooks, setChequebooks] = useState<Chequebook[]>([])
  const [leaves, setLeaves] = useState<ChequeLeaf[]>([])
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [loadingLeaves, setLoadingLeaves] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null)
  const [leafStatusFilter, setLeafStatusFilter] = useState<string>('ALL')
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false)
  const [isLeafDialogOpen, setIsLeafDialogOpen] = useState(false)
  const [editingLeaf, setEditingLeaf] = useState<ChequeLeaf | null>(null)

  const [bookForm, setBookForm] = useState({
    bankAccountId: 0,
    serialNumber: '',
    startNumber: '',
    endNumber: '',
    issuedAt: '',
    description: '',
  })

  const [leafForm, setLeafForm] = useState({
    amount: 0,
    payee: '',
    dueDate: '',
    issuedAt: getCurrentJalaliDate(),
    description: '',
    status: 'ISSUED' as ChequeLeafStatus,
  })

  const fetchChequebooks = useCallback(async () => {
    try {
      setLoadingBooks(true)
      const response = await api.get('/accounting/chequebooks')
      setChequebooks(response.data || [])
    } catch (error) {
      console.error('Error fetching chequebooks:', error)
      toast({ title: 'خطا', description: 'خطا در دریافت دسته‌چک‌ها', variant: 'destructive' })
    } finally {
      setLoadingBooks(false)
    }
  }, [toast])

  const fetchLeaves = useCallback(async (chequebookId: number, status?: string) => {
    try {
      setLoadingLeaves(true)
      const response = await api.get(`/accounting/chequebooks/${chequebookId}/leaves`, {
        params: {
          ...(status && status !== 'ALL' ? { status } : {}),
          take: 500,
        },
      })
      setLeaves(response.data?.data || [])
    } catch (error) {
      console.error('Error fetching cheque leaves:', error)
      toast({ title: 'خطا', description: 'خطا در دریافت برگه‌های چک', variant: 'destructive' })
    } finally {
      setLoadingLeaves(false)
    }
  }, [toast])

  useEffect(() => {
    fetchChequebooks()
  }, [fetchChequebooks])

  useEffect(() => {
    if (selectedBookId) {
      fetchLeaves(selectedBookId, leafStatusFilter)
    } else {
      setLeaves([])
    }
  }, [selectedBookId, leafStatusFilter, fetchLeaves])

  const resetBookForm = () => {
    setBookForm({
      bankAccountId: accounts[0]?.id || 0,
      serialNumber: '',
      startNumber: '',
      endNumber: '',
      issuedAt: '',
      description: '',
    })
  }

  const resetLeafForm = () => {
    setLeafForm({
      amount: 0,
      payee: '',
      dueDate: '',
      issuedAt: getCurrentJalaliDate(),
      description: '',
      status: 'ISSUED',
    })
  }

  const handleCreateChequebook = async () => {
    const startNumber = parseInt(bookForm.startNumber, 10)
    const endNumber = parseInt(bookForm.endNumber, 10)

    if (!bookForm.bankAccountId) {
      toast({ title: 'خطا', description: 'حساب بانکی را انتخاب کنید', variant: 'destructive' })
      return
    }
    if (!startNumber || !endNumber || startNumber > endNumber) {
      toast({ title: 'خطا', description: 'محدوده شماره برگه‌ها نامعتبر است', variant: 'destructive' })
      return
    }

    try {
      await api.post('/accounting/chequebooks', {
        bankAccountId: bookForm.bankAccountId,
        serialNumber: bookForm.serialNumber || undefined,
        startNumber,
        endNumber,
        issuedAt: bookForm.issuedAt ? jalaliToISO(bookForm.issuedAt) : undefined,
        description: bookForm.description || undefined,
      })
      toast({ title: 'موفق', description: 'دسته چک با موفقیت ایجاد شد' })
      setIsBookDialogOpen(false)
      resetBookForm()
      fetchChequebooks()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در ایجاد دسته چک',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteChequebook = async (id: number) => {
    if (!confirm('آیا از حذف این دسته چک مطمئن هستید؟')) return
    try {
      await api.delete(`/accounting/chequebooks/${id}`)
      toast({ title: 'موفق', description: 'دسته چک حذف شد' })
      if (selectedBookId === id) setSelectedBookId(null)
      fetchChequebooks()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در حذف دسته چک',
        variant: 'destructive',
      })
    }
  }

  const openEditLeaf = (leaf: ChequeLeaf) => {
    setEditingLeaf(leaf)
    setLeafForm({
      amount: leaf.amount || 0,
      payee: leaf.payee || '',
      dueDate: leaf.dueDate ? formatToJalali(leaf.dueDate) : '',
      issuedAt: leaf.issuedAt ? formatToJalali(leaf.issuedAt) : getCurrentJalaliDate(),
      description: leaf.description || '',
      status: leaf.status === 'BLANK' ? 'ISSUED' : leaf.status,
    })
    setIsLeafDialogOpen(true)
  }

  const handleUpdateLeaf = async () => {
    if (!editingLeaf) return

    try {
      const payload: Record<string, unknown> = {
        amount: leafForm.amount > 0 ? leafForm.amount : undefined,
        payee: leafForm.payee || undefined,
        description: leafForm.description || undefined,
        status: leafForm.status,
        dueDate: leafForm.dueDate ? jalaliToISO(leafForm.dueDate) : undefined,
        issuedAt: leafForm.issuedAt ? jalaliToISO(leafForm.issuedAt) : undefined,
      }

      await api.patch(`/accounting/cheque-leaves/${editingLeaf.id}`, payload)
      toast({ title: 'موفق', description: 'برگه چک به‌روزرسانی شد' })
      setIsLeafDialogOpen(false)
      setEditingLeaf(null)
      resetLeafForm()
      if (selectedBookId) fetchLeaves(selectedBookId, leafStatusFilter)
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی برگه چک',
        variant: 'destructive',
      })
    }
  }

  const handleQuickStatusChange = async (leaf: ChequeLeaf, status: ChequeLeafStatus) => {
    try {
      await api.patch(`/accounting/cheque-leaves/${leaf.id}`, { status })
      toast({ title: 'موفق', description: `وضعیت به «${STATUS_LABELS[status]}» تغییر کرد` })
      if (selectedBookId) fetchLeaves(selectedBookId, leafStatusFilter)
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در تغییر وضعیت',
        variant: 'destructive',
      })
    }
  }

  const selectedBook = chequebooks.find((b) => b.id === selectedBookId)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-main-orange" />
              دسته‌های چک
            </CardTitle>
            <Dialog open={isBookDialogOpen} onOpenChange={setIsBookDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-main-orange hover:bg-main-orange/90"
                  onClick={() => {
                    resetBookForm()
                  }}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  دسته چک جدید
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>ثبت دسته چک جدید</DialogTitle>
                  <DialogDescription>
                    برگه‌های چک به‌صورت خودکار برای محدوده شماره وارد شده ایجاد می‌شوند
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>حساب بانکی *</Label>
                    <Select
                      value={String(bookForm.bankAccountId || '')}
                      onValueChange={(val) => setBookForm({ ...bookForm, bankAccountId: parseInt(val, 10) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب حساب" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={String(acc.id)}>
                            {acc.name} {acc.provider ? `(${acc.provider})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>سریال دسته چک</Label>
                    <Input
                      value={bookForm.serialNumber}
                      onChange={(e) => setBookForm({ ...bookForm, serialNumber: e.target.value })}
                      placeholder="مثال: ۱۲۳۴۵۶"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>شماره شروع *</Label>
                      <Input
                        type="number"
                        value={bookForm.startNumber}
                        onChange={(e) => setBookForm({ ...bookForm, startNumber: e.target.value })}
                        placeholder="مثال: 10001"
                      />
                    </div>
                    <div>
                      <Label>شماره پایان *</Label>
                      <Input
                        type="number"
                        value={bookForm.endNumber}
                        onChange={(e) => setBookForm({ ...bookForm, endNumber: e.target.value })}
                        placeholder="مثال: 10050"
                      />
                    </div>
                  </div>
                  <PersianDatePicker
                    value={bookForm.issuedAt}
                    onChange={(date) => setBookForm({ ...bookForm, issuedAt: date })}
                    label="تاریخ دریافت دسته چک"
                    placeholder="۱۴۰۳/۰۱/۰۱"
                    maxDate={getCurrentJalaliDate()}
                  />
                  <div>
                    <Label>توضیحات</Label>
                    <Input
                      value={bookForm.description}
                      onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsBookDialogOpen(false)}>انصراف</Button>
                  <Button className="bg-main-orange hover:bg-main-orange/90" onClick={handleCreateChequebook}>
                    ایجاد دسته چک
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBooks ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange" />
            </div>
          ) : chequebooks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>هنوز دسته چکی ثبت نشده است</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chequebooks.map((book) => (
                <Card
                  key={book.id}
                  className={`cursor-pointer transition-colors ${
                    selectedBookId === book.id ? 'border-main-orange ring-1 ring-main-orange/40' : ''
                  }`}
                  onClick={() => setSelectedBookId(book.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{book.bankAccount.name}</div>
                        {book.serialNumber && (
                          <div className="text-xs text-muted-foreground">سریال: {book.serialNumber}</div>
                        )}
                      </div>
                      {!book.isActive && (
                        <Badge variant="secondary">غیرفعال</Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      برگه‌ها: {book.startNumber} — {book.endNumber}
                      <span className="text-muted-foreground"> ({book.leafCount} برگه)</span>
                    </div>
                    {book.issuedAt && (
                      <div className="text-xs text-muted-foreground">
                        تاریخ دریافت: {formatToJalali(book.issuedAt)}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedBookId(book.id)
                        }}
                      >
                        مشاهده برگه‌ها
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteChequebook(book.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedBook && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>
                برگه‌های چک — {selectedBook.bankAccount.name}
                {selectedBook.serialNumber ? ` (${selectedBook.serialNumber})` : ''}
              </CardTitle>
              <Select value={leafStatusFilter} onValueChange={setLeafStatusFilter}>
                <SelectTrigger className="w-[160px] bg-background border-input">
                  <SelectValue placeholder="وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه</SelectItem>
                  {(Object.keys(STATUS_LABELS) as ChequeLeafStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLeaves ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange" />
              </div>
            ) : leaves.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">برگه‌ای یافت نشد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شماره برگه</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>در وجه</TableHead>
                    <TableHead>سررسید</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leaf) => (
                    <TableRow key={leaf.id}>
                      <TableCell className="font-mono">{leaf.leafNumber}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE_CLASS[leaf.status]}>
                          {STATUS_LABELS[leaf.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{leaf.amount ? formatRials(leaf.amount) : '—'}</TableCell>
                      <TableCell>{leaf.payee || '—'}</TableCell>
                      <TableCell>{leaf.dueDate ? formatToJalali(leaf.dueDate) : '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="outline" size="sm" onClick={() => openEditLeaf(leaf)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {(NEXT_STATUS_OPTIONS[leaf.status] || []).map((status) => (
                            <Button
                              key={status}
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleQuickStatusChange(leaf, status)}
                            >
                              {STATUS_LABELS[status]}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isLeafDialogOpen} onOpenChange={setIsLeafDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingLeaf ? `ویرایش برگه ${editingLeaf.leafNumber}` : 'ویرایش برگه چک'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>وضعیت</Label>
              <Select
                value={leafForm.status}
                onValueChange={(val: ChequeLeafStatus) => setLeafForm({ ...leafForm, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editingLeaf &&
                    [editingLeaf.status, ...(NEXT_STATUS_OPTIONS[editingLeaf.status] || [])].filter(
                      (v, i, arr) => arr.indexOf(v) === i
                    ).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <MoneyInput
              value={leafForm.amount}
              onChange={(amount) => setLeafForm({ ...leafForm, amount })}
              label="مبلغ (ریال)"
              placeholder="مثال: 50000000"
            />
            <div>
              <Label>در وجه</Label>
              <Input
                value={leafForm.payee}
                onChange={(e) => setLeafForm({ ...leafForm, payee: e.target.value })}
              />
            </div>
            <PersianDatePicker
              value={leafForm.issuedAt}
              onChange={(date) => setLeafForm({ ...leafForm, issuedAt: date })}
              label="تاریخ صدور"
              maxDate={getCurrentJalaliDate()}
            />
            <PersianDatePicker
              value={leafForm.dueDate}
              onChange={(date) => setLeafForm({ ...leafForm, dueDate: date })}
              label="تاریخ سررسید"
            />
            <div>
              <Label>توضیحات</Label>
              <Input
                value={leafForm.description}
                onChange={(e) => setLeafForm({ ...leafForm, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsLeafDialogOpen(false); setEditingLeaf(null) }}>
              انصراف
            </Button>
            <Button className="bg-main-orange hover:bg-main-orange/90" onClick={handleUpdateLeaf}>
              ذخیره
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
