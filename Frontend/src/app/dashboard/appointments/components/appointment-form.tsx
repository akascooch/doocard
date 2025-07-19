"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { api } from "@/lib/axios"
import { Customer } from "@/types/customer"
import { Service } from "@/types/service"
import { Barber } from "@/types/barber"
import { DialogClose } from "@radix-ui/react-dialog"
import { DialogFooter } from "@/components/ui/dialog"
import { PersianDatePicker } from "@/components/ui/persian-date-picker"
import dayjs from "dayjs"
import jalaliday from "jalaliday"
import jalaali from 'jalaali-js'
dayjs.extend(jalaliday)

const formSchema = z.object({
  customerId: z.string({
    required_error: "لطفا مشتری را انتخاب کنید",
  }),
  services: z.array(z.object({
    serviceId: z.string(),
    price: z.number(),
  })).min(1, {
    message: "لطفا حداقل یک سرویس را انتخاب کنید",
  }),
  barberId: z.string({
    required_error: "لطفا آرایشگر را انتخاب کنید",
  }),
  date: z.string({
    required_error: "لطفا تاریخ را وارد کنید",
  }),
  time: z.string({
    required_error: "لطفا ساعت را وارد کنید",
  }),
})

export function AppointmentForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  // مقدار پیش‌فرض تاریخ و ساعت
  const getNowJalali = () => {
    const now = dayjs().calendar('jalali')
    return {
      date: now.format('YYYY/MM/DD'),
      time: now.format('HH:mm'),
    }
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: "",
      barberId: "",
      date: getNowJalali().date,
      time: getNowJalali().time,
      services: [],
    },
  })

  // هر بار که فرم باز می‌شود، تاریخ و ساعت را به امروز ریست کن
  useEffect(() => {
    if (dialogOpen) {
      const now = getNowJalali()
      form.reset({
        customerId: "",
        barberId: "",
        date: now.date,
        time: now.time,
        services: [],
      })
      setSelectedServices([])
    }
  }, [dialogOpen])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [customersRes, servicesRes, barbersRes] = await Promise.all([
          api.get("/customers"),
          api.get("/services"),
          api.get("/barbers"),
        ])
        setCustomers(customersRes.data)
        setServices(servicesRes.data)
        setBarbers(barbersRes.data)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "دریافت اطلاعات با مشکل مواجه شد",
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [toast])

  // مجموع مبلغ خدمات انتخاب‌شده
  const totalPrice = form.watch("services").reduce((sum, s) => sum + s.price, 0)

  // هندل انتخاب سرویس‌ها (چندتایی)
  function handleServiceSelect(selectedIds: string[]) {
    setSelectedServices(selectedIds)
    const selected = services.filter(s => selectedIds.includes(String(s.id)))
    form.setValue("services", selected.map(s => ({ serviceId: String(s.id), price: s.price })))
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // تبدیل تاریخ جلالی به میلادی برای ارسال به سرور
      const [jy, jm, jd] = values.date.split('/').map(Number)
      const [hour, minute] = values.time.split(':').map(Number)
      const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd)
      const dateTime = new Date(gy, gm - 1, gd, hour, minute)
      await api.post("/appointments", {
        customerId: Number(values.customerId),
        barberId: Number(values.barberId),
        date: dateTime.toISOString(),
        services: values.services.map(s => ({
          serviceId: Number(s.serviceId),
          price: s.price,
        })),
      })
      toast({
        title: "موفق",
        description: "نوبت با موفقیت ثبت شد",
      })
      onSuccess()
      form.reset()
      setSelectedServices([])
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "ثبت نوبت با مشکل مواجه شد",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin">
          <svg className="h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>مشتری</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="انتخاب مشتری..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={String(customer.id)}>
                          {customer.firstName} {customer.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="barberId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>آرایشگر</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="انتخاب آرایشگر..." />
                    </SelectTrigger>
                    <SelectContent>
                      {barbers.map((barber) => (
                        <SelectItem key={barber.id} value={String(barber.id)}>
                          {barber.firstName} {barber.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="services"
          render={() => (
            <FormItem>
              <FormLabel>سرویس‌ها</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                    {services.map((service) => (
                      <label key={service.id} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${selectedServices.includes(String(service.id)) ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={selectedServices.includes(String(service.id))}
                          onChange={e => {
                            let newSelected: string[]
                            if (e.target.checked) {
                              newSelected = [...selectedServices, String(service.id)]
                            } else {
                              newSelected = selectedServices.filter(id => id !== String(service.id))
                            }
                            handleServiceSelect(newSelected)
                          }}
                        />
                        <span>{service.name}</span>
                        <span className="text-xs text-muted-foreground">{service.price.toLocaleString()} تومان</span>
                      </label>
                    ))}
                  </div>
                  {selectedServices.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {services.filter(s => selectedServices.includes(String(s.id))).map((s) => (
                        <li key={s.id} className="flex justify-between border-b pb-1">
                          <span>{s.name}</span>
                          <span className="text-muted-foreground">{s.price.toLocaleString()} تومان</span>
                        </li>
                      ))}
                      <li className="flex justify-between font-bold pt-2 border-t mt-2">
                        <span>جمع کل</span>
                        <span>{totalPrice.toLocaleString()} تومان</span>
                      </li>
                    </ul>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>تاریخ</FormLabel>
                <FormControl>
                  <PersianDatePicker value={field.value} onChange={field.onChange} placeholder="تاریخ نوبت (مثلاً 1403/04/25)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ساعت</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <DialogClose asChild>
            <Button variant="outline" type="button">انصراف</Button>
          </DialogClose>
          <Button type="submit">ثبت نوبت</Button>
        </DialogFooter>
      </form>
    </Form>
  )
} 