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
import { Plus, Edit, Trash2, BookOpen, FileText, Archive, ArchiveRestore } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/axios'
import MoneyInput from '@/components/ui/MoneyInput'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { formatRials } from '@/lib/money'
import { formatToJalali, jalaliToISO, getCurrentJalaliDate } from '@/lib/date'
import {
  type EmployeeListItem,
  getEmployeeDisplayName,
  normalizeEmployeeList,
} from '@/lib/employee'

type ChequeLeafStatus = 'BLANK' | 'ISSUED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED'
type ChequeLeafCategory = 'NORMAL' | 'GUARANTEE'
type ChequePayeeKind = 'STAFF_SALARY' | 'SUPPLIER' | 'RENT' | 'UTILITIES' | 'OTHER'

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
  category?: ChequeLeafCategory
  amount: number | null
  payee: string | null
  payeeKind?: ChequePayeeKind | null
  employeeId?: number | null
  employee?: { id: number; user?: { name?: string | null } | null } | null
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

const CATEGORY_LABELS: Record<ChequeLeafCategory, string> = {
  NORMAL: 'عادی',
  GUARANTEE: 'ضمانت',
}

const PAYEE_KIND_LABELS: Record<ChequePayeeKind, string> = {
  STAFF_SALARY: 'واریز حقوق / مساعده پرسنل',
  SUPPLIER: 'تأمین‌کننده / خرید متریال',
  RENT: 'اجاره و شارژ سالن',
  UTILITIES: 'قبوض و خدمات عمومی',
  OTHER: 'سایر / متفرقه',
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
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Chequebook | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Chequebook | null>(null)
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false)
  const [isLeafDialogOpen, setIsLeafDialogOpen] = useState(false)
  const [editingLeaf, setEditingLeaf] = useState<ChequeLeaf | null>(null)
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [employeeQuery, setEmployeeQuery] = useState('')

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
    category: 'NORMAL' as ChequeLeafCategory,
    payeeKind: '' as ChequePayeeKind | '',
    employeeId: 0,
  })

  const fetchChequebooks = useCallback(async () => {
    try {
      setLoadingBooks(true)
      const response = await api.get('/accounting/chequebooks', {
        params: { archived: showArchived ? 'true' : 'false' },
      })
      setChequebooks(response.data || [])
    } catch (error) {
      console.error('Error fetching chequebooks:', error)
      toast({ title: 'خطا', description: 'خطا در دریافت دسته‌چک‌ها', variant: 'destructive' })
    } finally {
      setLoadingBooks(false)
    }
  }, [toast, showArchived])

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

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.get('/employees')
      const list = normalizeEmployeeList(response.data).filter((e) => e.isActive !== false)
      setEmployees(list)
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }, [])

  useEffect(() => {
    fetchChequebooks()
    fetchEmployees()
  }, [fetchChequebooks, fetchEmployees])

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
      category: 'NORMAL',
      payeeKind: '',
      employeeId: 0,
    })
    setEmployeeQuery('')
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

  const handleArchiveChequebook = async (book: Chequebook) => {
    try {
      const res = await api.patch(`/accounting/chequebooks/${book.id}/archive`)
      toast({
        title: 'آرشیو شد',
        description: res.data?.warning || 'دسته‌چک به آرشیو منتقل شد',
      })
      if (selectedBookId === book.id) setSelectedBookId(null)
      setArchiveTarget(null)
      fetchChequebooks()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در آرشیو دسته‌چک',
        variant: 'destructive',
      })
    }
  }

  const handleRestoreChequebook = async (book: Chequebook) => {
    try {
      await api.patch(`/accounting/chequebooks/${book.id}/restore`)
      toast({ title: 'بازگردانی شد', description: 'دسته‌چک دوباره در فهرست فعال قرار گرفت' })
      setRestoreTarget(null)
      fetchChequebooks()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در بازگردانی دسته‌چک',
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
      category: leaf.category === 'GUARANTEE' ? 'GUARANTEE' : 'NORMAL',
      payeeKind: leaf.payeeKind || '',
      employeeId: leaf.employeeId || 0,
    })
    setEmployeeQuery('')
    setIsLeafDialogOpen(true)
  }

  const handleUpdateLeaf = async () => {
    if (!editingLeaf) return

    if (leafForm.category === 'GUARANTEE' && leafForm.payeeKind === 'STAFF_SALARY') {
      toast({
        title: 'خطا',
        description: 'چک ضمانت نمی‌تواند به‌عنوان حقوق پرسنل ثبت شود',
        variant: 'destructive',
      })
      return
    }

    if (leafForm.payeeKind === 'STAFF_SALARY' && !leafForm.employeeId) {
      toast({
        title: 'خطا',
        description: 'برای واریز حقوق پرسنل، کارمند را انتخاب کنید',
        variant: 'destructive',
      })
      return
    }

    try {
      const selectedEmployee = employees.find((e) => e.id === leafForm.employeeId)
      const staffName = selectedEmployee ? getEmployeeDisplayName(selectedEmployee) : ''
      const payload: Record<string, unknown> = {
        amount: leafForm.amount > 0 ? leafForm.amount : undefined,
        payee:
          leafForm.payeeKind === 'STAFF_SALARY'
            ? staffName || leafForm.payee || undefined
            : leafForm.payee || undefined,
        description: leafForm.description || undefined,
        status: leafForm.status,
        category: leafForm.category,
        dueDate: leafForm.dueDate ? jalaliToISO(leafForm.dueDate) : undefined,
        issuedAt: leafForm.issuedAt ? jalaliToISO(leafForm.issuedAt) : undefined,
      }

      if (leafForm.payeeKind) {
        payload.payeeKind = leafForm.payeeKind
        payload.employeeId =
          leafForm.payeeKind === 'STAFF_SALARY' ? leafForm.employeeId : null
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
  const employeeQueryNormalized = employeeQuery.trim().toLowerCase()
  const filteredEmployees = employees.filter((emp) => {
    if (!employeeQueryNormalized) return true
    const name = getEmployeeDisplayName(emp).toLowerCase()
    const phone = (emp.phone || '').toLowerCase()
    return name.includes(employeeQueryNormalized) || phone.includes(employeeQueryNormalized)
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-main-orange" />
              دسته‌های چک
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                value={showArchived ? 'archived' : 'active'}
                onValueChange={(v) => {
                  setShowArchived(v === 'archived')
                  setSelectedBookId(null)
                }}
              >
                <TabsList>
                  <TabsTrigger value="active">فعال</TabsTrigger>
                  <TabsTrigger value="archived">آرشیو</TabsTrigger>
                </TabsList>
              </Tabs>
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
              <p>{showArchived ? 'دسته‌چک آرشیو‌شده‌ای وجود ندارد' : 'هنوز دسته چکی ثبت نشده است'}</p>
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
                      {showArchived ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRestoreTarget(book)
                          }}
                        >
                          <ArchiveRestore className="h-4 w-4 ml-1" />
                          بازگردانی
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setArchiveTarget(book)
                          }}
                        >
                          <Archive className="h-4 w-4 ml-1" />
                          آرشیو
                        </Button>
                      )}
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
                    <TableHead>نوع</TableHead>
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
                      <TableCell>
                        {CATEGORY_LABELS[leaf.category === 'GUARANTEE' ? 'GUARANTEE' : 'NORMAL']}
                      </TableCell>
                      <TableCell>{leaf.amount ? formatRials(leaf.amount) : '—'}</TableCell>
                      <TableCell>
                        {leaf.payeeKind
                          ? `${PAYEE_KIND_LABELS[leaf.payeeKind]}${leaf.payee ? ` — ${leaf.payee}` : ''}`
                          : (leaf.payee || '—')}
                      </TableCell>
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
                onValueChange={(val) =>
                  setLeafForm((prev) => ({
                    ...prev,
                    status: val as ChequeLeafStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editingLeaf &&
                    (
                      [editingLeaf.status, ...(NEXT_STATUS_OPTIONS[editingLeaf.status] || [])] as ChequeLeafStatus[]
                    )
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع چک</Label>
              <Select
                value={leafForm.category}
                onValueChange={(val) => {
                  const category = val as ChequeLeafCategory
                  setLeafForm((prev) => ({
                    ...prev,
                    category,
                    payeeKind:
                      category === 'GUARANTEE' && prev.payeeKind === 'STAFF_SALARY'
                        ? ''
                        : prev.payeeKind,
                    employeeId:
                      category === 'GUARANTEE' && prev.payeeKind === 'STAFF_SALARY'
                        ? 0
                        : prev.employeeId,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as ChequeLeafCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
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
              <Label>نوع در وجه / ذینفع</Label>
              <Select
                value={leafForm.payeeKind || undefined}
                onValueChange={(val) => {
                  const payeeKind = val as ChequePayeeKind
                  const selected = employees.find((e) => e.id === leafForm.employeeId)
                  setLeafForm((prev) => ({
                    ...prev,
                    payeeKind,
                    employeeId: payeeKind === 'STAFF_SALARY' ? prev.employeeId : 0,
                    payee:
                      payeeKind === 'STAFF_SALARY' && selected
                        ? getEmployeeDisplayName(selected)
                        : prev.payee,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نوع ذینفع (اختیاری برای چک‌های قدیمی)" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYEE_KIND_LABELS) as ChequePayeeKind[])
                    .filter(
                      (kind) =>
                        !(kind === 'STAFF_SALARY' && leafForm.category === 'GUARANTEE'),
                    )
                    .map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {PAYEE_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {leafForm.category === 'GUARANTEE' && (
                <p className="text-xs text-muted-foreground mt-1">
                  چک ضمانت نمی‌تواند به‌عنوان حقوق پرسنل ثبت شود
                </p>
              )}
            </div>
            {leafForm.payeeKind === 'STAFF_SALARY' ? (
              <div className="space-y-2">
                <Label>کارمند *</Label>
                <Input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  placeholder="جستجوی نام یا شماره تماس"
                />
                <Select
                  value={leafForm.employeeId ? String(leafForm.employeeId) : undefined}
                  onValueChange={(val) => {
                    const employeeId = parseInt(val, 10)
                    const selected = employees.find((e) => e.id === employeeId)
                    setLeafForm((prev) => ({
                      ...prev,
                      employeeId,
                      payee: selected ? getEmployeeDisplayName(selected) : prev.payee,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کارمند" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {getEmployeeDisplayName(emp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  این چک به‌صورت خودکار از حقوق پرسنل کسر می‌شود.
                </p>
              </div>
            ) : (
              <div>
                <Label>در وجه</Label>
                <Input
                  value={leafForm.payee}
                  onChange={(e) => setLeafForm({ ...leafForm, payee: e.target.value })}
                />
              </div>
            )}
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

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>آرشیو دسته‌چک</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از آرشیو این دسته‌چک مطمئن هستید؟ دسته‌چک‌های آرشیو‌شده در فهرست فعال نمایش داده نمی‌شوند. اگر برگه باز داشته باشد، آرشیو انجام می‌شود و یک هشدار نمایش داده خواهد شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveTarget && handleArchiveChequebook(archiveTarget)}
            >
              آرشیو
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>بازگردانی دسته‌چک</AlertDialogTitle>
            <AlertDialogDescription>
              این دسته‌چک دوباره در فهرست فعال نمایش داده می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTarget && handleRestoreChequebook(restoreTarget)}
            >
              بازگردانی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
