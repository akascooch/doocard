"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CalendarIcon, ClockIcon, UserIcon, ScissorsIcon, PlusIcon, UserPlusIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import axios from "@/lib/axios"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PersianDatePicker } from '@/components/ui/persian-date-picker'
import jalaali from 'jalaali-js'
import { AppointmentForm } from "./components/appointment-form";

interface Service {
  id: number;
  name: string;
  price: number;
}

interface Appointment {
  id: number;
  customer: {
    firstName: string;
    lastName: string;
  };
  barber: {
    firstName: string;
    lastName: string;
  };
  services: Service[];
  date: string;
  status: string;
}

// کامپوننت تقویم (فعلاً ساده)
function CalendarView() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <CalendarIcon className="h-4 w-4" />
        تقویم نوبت‌ها
      </h2>
      <div className="h-96 flex items-center justify-center text-muted-foreground">
        کامپوننت تقویم اینجا قرار می‌گیرد
      </div>
    </div>
  )
}

// کامپوننت لیست نوبت‌ها
function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false)
  const [customers, setCustomers] = useState([])
  const [barbers, setBarbers] = useState([])
  const [services, setServices] = useState([])
  const [formData, setFormData] = useState({
    customerId: "",
    barberId: "",
    serviceId: "",
    date: "",
    time: "",
  })
  const [newCustomerData, setNewCustomerData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
  })
  const { toast } = useToast()
  const [settleDialog, setSettleDialog] = useState<{ open: boolean, appointmentId: number | null, appointment: Appointment | null }>({ 
    open: false, 
    appointmentId: null, 
    appointment: null 
  })
  const [settleAmount, setSettleAmount] = useState(0)
  const [tipAmount, setTipAmount] = useState(0)
  const [settleAmountText, setSettleAmountText] = useState('0')
  const [tipAmountText, setTipAmountText] = useState('0')
  const [settleLoading, setSettleLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, appointment: Appointment | null, newStatus: string }>({ open: false, appointment: null, newStatus: '' })
  const [filterBarberId, setFilterBarberId] = useState('')
  // مقدار اولیه فیلتر تاریخ به شمسی
  const today = new Date()
  const toJalaliStr = (date: Date) => {
    const { jy, jm, jd } = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`
  }
  const toGregorianDate = (jalaliStr: string) => {
    const [jy, jm, jd] = jalaliStr.split('/').map(Number)
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd)
    return new Date(gy, gm - 1, gd)
  }
  const [filterJalaliDate, setFilterJalaliDate] = useState(() => toJalaliStr(today))

  useEffect(() => {
    fetchAppointments()
    fetchCustomers()
    fetchBarbers()
    fetchServices()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await axios.get("/customers")
      setCustomers(response.data)
    } catch (error) {
      toast({
        title: "خطا در دریافت لیست مشتریان",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const fetchBarbers = async () => {
    try {
      const response = await axios.get("/barbers")
      setBarbers(response.data)
    } catch (error) {
      toast({
        title: "خطا در دریافت لیست آرایشگران",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const fetchServices = async () => {
    try {
      const response = await axios.get("/services")
      setServices(response.data)
    } catch (error) {
      toast({
        title: "خطا در دریافت لیست خدمات",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const fetchAppointments = async () => {
    try {
      const response = await axios.get("/appointments")
      setAppointments(response.data)
    } catch (error) {
      toast({
        title: "خطا در دریافت نوبت‌ها",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { date, time, ...rest } = formData
      const dateTime = new Date(`${date}T${time}:00`)
      
      await axios.post("/appointments", {
        ...rest,
        date: dateTime.toISOString(),
      })
      
      toast({
        title: "ثبت موفق",
        description: "نوبت جدید با موفقیت ثبت شد",
      })
      fetchAppointments()
      setIsDialogOpen(false)
      setFormData({
        customerId: "",
        barberId: "",
        serviceId: "",
        date: "",
        time: "",
      })
    } catch (error) {
      toast({
        title: "خطا در ثبت نوبت",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const handleNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await axios.post("/customers", newCustomerData)
      toast({
        title: "ثبت موفق",
        description: "مشتری جدید با موفقیت ثبت شد",
      })
      
      // به‌روزرسانی لیست مشتریان
      await fetchCustomers()
      
      // انتخاب مشتری جدید در فرم نوبت
      setFormData(prev => ({
        ...prev,
        customerId: response.data.id.toString()
      }))
      
      // بستن دیالوگ مشتری جدید
      setIsNewCustomerDialogOpen(false)
      
      // پاک کردن فرم مشتری جدید
      setNewCustomerData({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        email: "",
      })
    } catch (error) {
      toast({
        title: "خطا در ثبت مشتری",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const handleStatusChange = async (appointment: Appointment, newStatus: string) => {
    if (newStatus === 'COMPLETED') {
      setSettleDialog({ open: true, appointmentId: appointment.id })
      setSettleAmount(appointment.services.reduce((sum, s) => sum + s.price, 0) || 0)
      return
    }
    setConfirmDialog({ open: true, appointment, newStatus })
  }

  const handleConfirmStatusChange = async () => {
    if (!confirmDialog.appointment) return
    try {
      await axios.patch(`/appointments/${confirmDialog.appointment.id}`, { status: confirmDialog.newStatus })
      toast({ title: 'وضعیت نوبت به‌روزرسانی شد' })
      fetchAppointments()
    } catch (error) {
      toast({ title: 'خطا در تغییر وضعیت', variant: 'destructive' })
    } finally {
      setConfirmDialog({ open: false, appointment: null, newStatus: '' })
    }
  }

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'number' ? value : Number(value.replace(/,/g, ''))
    if (isNaN(num)) return ''
    return num.toLocaleString('en-US')
  }

  const handleSettleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (/^\d*$/.test(raw)) {
      setSettleAmount(Number(raw))
      setSettleAmountText(formatNumber(raw))
    }
  }
  const handleTipAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (/^\d*$/.test(raw)) {
      setTipAmount(Number(raw))
      setTipAmountText(formatNumber(raw))
    }
  }

  const handleSettle = async () => {
    if (!settleDialog.appointmentId) return
    setSettleLoading(true)
    try {
      // استفاده از endpoint جدید برای تسویه
      const response = await axios.post(`/appointments/${settleDialog.appointmentId}/settle`, {
        amount: settleAmount,
        tipAmount: tipAmount,
        paymentMethod: 'CASH'
      })
      
      toast({ 
        title: 'نوبت با موفقیت تسویه شد',
        description: `مبلغ ${formatNumber(settleAmount + tipAmount)} تومان در حسابداری ثبت شد`
      })
      
      setSettleDialog({ open: false, appointmentId: null, appointment: null })
      setSettleAmount(0)
      setTipAmount(0)
      setSettleAmountText('0')
      setTipAmountText('0')
      fetchAppointments()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'خطا در تسویه نوبت'
      toast({ 
        title: 'خطا در تسویه', 
        description: errorMessage,
        variant: 'destructive' 
      })
    } finally {
      setSettleLoading(false)
    }
  }

  const handleCancelSettled = async (appointmentId: number) => {
    setCancelLoading(true)
    try {
      await axios.post(`/appointments/${appointmentId}/cancel-settled`)
      
      toast({ 
        title: 'نوبت با موفقیت لغو شد',
        description: 'تراکنش‌های مالی مرتبط نیز حذف شدند'
      })
      
      fetchAppointments()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'خطا در لغو نوبت'
      toast({ 
        title: 'خطا در لغو نوبت', 
        description: errorMessage,
        variant: 'destructive' 
      })
    } finally {
      setCancelLoading(false)
    }
  }

  // فیلتر نهایی روی لیست نوبت‌ها
  appointments.forEach((apt) => {
    const aptDate = new Date(apt.date)
    const filterDateObj = toGregorianDate(filterJalaliDate)
    aptDate.setHours(0,0,0,0)
    filterDateObj.setHours(0,0,0,0)
    console.log('APT:', {
      aptId: apt.id,
      aptDate: aptDate,
      aptDateISOString: aptDate.toISOString(),
      filterDateObj: filterDateObj,
      filterDateISOString: filterDateObj.toISOString(),
      aptRawDate: apt.date,
      filterJalaliDate: filterJalaliDate
    })
  })
  let filteredAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.date)
    const filterDateObj = toGregorianDate(filterJalaliDate)
    // صفر کردن ساعت و دقیقه و ثانیه و میلی‌ثانیه هر دو تاریخ
    aptDate.setHours(0,0,0,0)
    filterDateObj.setHours(0,0,0,0)
    const sameDay = aptDate.getFullYear() === filterDateObj.getFullYear() &&
      aptDate.getMonth() === filterDateObj.getMonth() &&
      aptDate.getDate() === filterDateObj.getDate()
    const barberId = apt.barber?.id ?? apt.barberId
    const barberMatch = filterBarberId ? String(barberId) === filterBarberId : true
    return sameDay && barberMatch
  })
  // مرتب‌سازی وضعیت: در انتظار > تسویه > کنسل شده
  const statusOrder = { PENDING: 0, COMPLETED: 1, CANCELLED: 2 }
  filteredAppointments = filteredAppointments.sort((a, b) => {
    const aOrder = statusOrder[a.status] ?? 99
    const bOrder = statusOrder[b.status] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    // اگر وضعیت برابر بود، بر اساس تاریخ نزولی
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
  console.log('appointments:', appointments)
  console.log('filteredAppointments:', filteredAppointments)

  // هندل تغییر روز شمسی
  const handlePrevDay = () => {
    const [jy, jm, jd] = filterJalaliDate.split('/').map(Number)
    const g = jalaali.toGregorian(jy, jm, jd)
    const d = new Date(g.gy, g.gm - 1, g.gd)
    d.setDate(d.getDate() - 1)
    setFilterJalaliDate(toJalaliStr(d))
  }
  const handleNextDay = () => {
    const [jy, jm, jd] = filterJalaliDate.split('/').map(Number)
    const g = jalaali.toGregorian(jy, jm, jd)
    const d = new Date(g.gy, g.gm - 1, g.gd)
    d.setDate(d.getDate() + 1)
    setFilterJalaliDate(toJalaliStr(d))
  }
  const handleToday = () => {
    setFilterJalaliDate(toJalaliStr(new Date()))
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="p-6 border-b border-border flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-bold">لیست نوبت‌ها</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="p-2 border border-border rounded-md min-w-[120px]"
            value={filterBarberId}
            onChange={e => setFilterBarberId(e.target.value)}
          >
            <option value="">همه آرایشگران</option>
            {barbers.map((barber: any) => (
              <option key={barber.id} value={barber.id}>
                {barber.firstName} {barber.lastName}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrevDay} title="روز قبل">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
            <PersianDatePicker
              value={filterJalaliDate}
              onChange={setFilterJalaliDate}
              className="w-[120px] text-left border-primary focus:ring-primary"
              placeholder="تاریخ (مثلاً 1403/04/20)"
            />
            <Button variant="outline" size="sm" onClick={handleToday}>
              امروز
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextDay} title="روز بعد">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="ml-2 h-4 w-4" />
              نوبت جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ثبت نوبت جدید</DialogTitle>
              <DialogDescription>
                لطفاً اطلاعات نوبت جدید را وارد کنید
              </DialogDescription>
            </DialogHeader>
            <AppointmentForm onSuccess={() => {
              setIsDialogOpen(false);
              fetchAppointments();
            }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin">
              <svg className="h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            هیچ نوبتی برای این فیلتر یافت نشد
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAppointments.map((appointment) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{`${appointment.customer.firstName} ${appointment.customer.lastName}`}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {new Date(appointment.date).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {new Date(appointment.date).toLocaleDateString('fa-IR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <ScissorsIcon className="h-4 w-4" />
                          {appointment.services && appointment.services.length > 0 ? (
                            <span>
                              {appointment.services.map((s, idx) => (
                                <span key={s.id}>
                                  {s.name}
                                  {idx < appointment.services.length - 1 && ', '}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-4 w-4" />
                          آرایشگر: {appointment.barber.firstName} {appointment.barber.lastName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {appointment.status === 'PENDING' && (
                      <>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-yellow-700">
                            در انتظار
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(appointment, 'CANCELLED')}
                        >
                          کنسل
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettleDialog({ 
                            open: true, 
                            appointmentId: appointment.id,
                            appointment: appointment 
                          })}
                        >
                          تسویه
                        </Button>
                      </>
                    )}
                    {appointment.status === 'COMPLETED' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelSettled(appointment.id)}
                          disabled={cancelLoading}
                        >
                          لغو نوبت
                        </Button>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-green-700">
                            تسویه شده
                          </span>
                        </div>
                      </>
                    )}
                    {appointment.status === 'CANCELLED' && (
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium text-red-700">
                        کنسل شده
                      </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            <Dialog open={settleDialog.open} onOpenChange={open => setSettleDialog(s => ({ ...s, open }))}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>تسویه نوبت</DialogTitle>
                  <DialogDescription>مبالغ را وارد کنید:</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>خدمات این نوبت</Label>
                    <ul className="border rounded p-2 bg-muted/30 text-sm">
                      {settleDialog.appointment?.services?.map((s) => (
                        <li key={s.id} className="flex justify-between border-b last:border-b-0 py-1">
                          <span>{s.name}</span>
                          <span>{s.price.toLocaleString()} تومان</span>
                        </li>
                      ))}
                      <li className="flex justify-between font-bold pt-2 border-t mt-2">
                        <span>جمع کل خدمات</span>
                        <span>{settleDialog.appointment?.services?.reduce((sum, s) => sum + s.price, 0).toLocaleString()} تومان</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <Label>مبلغ کل (قابل ویرایش)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={settleAmountText}
                      onChange={handleSettleAmountChange}
                      className="text-left"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>مبلغ تیپ</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={tipAmountText}
                      onChange={handleTipAmountChange}
                      className="text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setSettleDialog({ open: false, appointmentId: null })} disabled={settleLoading}>انصراف</Button>
                  <Button onClick={handleSettle} disabled={settleAmount <= 0 || settleLoading}>
                    {settleLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        در حال ثبت...
                      </span>
                    ) : (
                      'تایید و تسویه'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={confirmDialog.open} onOpenChange={open => setConfirmDialog(s => ({ ...s, open }))}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>تغییر وضعیت نوبت</DialogTitle>
                  <DialogDescription>
                    آیا مطمئن هستید که می‌خواهید وضعیت نوبت را به
                    {confirmDialog.newStatus === 'PENDING' && ' «در انتظار» '}
                    {confirmDialog.newStatus === 'CANCELLED' && ' «کنسل شده» '}
                    {confirmDialog.newStatus === 'COMPLETED' && ' «تسویه» '}
                    تغییر دهید؟
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setConfirmDialog({ open: false, appointment: null, newStatus: '' })}>انصراف</Button>
                  <Button onClick={handleConfirmStatusChange}>تایید</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  )
}

function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مدیریت نوبت‌ها</h1>
      </div>
      <div>
        <AppointmentsList />
      </div>
    </div>
  )
}

export default AppointmentsPage;