"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import api from '@/lib/axios'
import { useRouter } from "next/navigation"
import Cookies from 'js-cookie'
import { PersianDatePicker, isValidJalali } from "@/components/ui/persian-date-picker"
import { toGregorian, toJalaali } from "jalaali-js"

// Schema for form validation
const customerSchema = z.object({
  firstName: z.string().min(2, "نام باید حداقل 2 حرف باشد"),
  lastName: z.string().min(2, "نام خانوادگی باید حداقل 2 حرف باشد"),
  phoneNumber: z.string().regex(/^09\d{9}$/, "شماره موبایل معتبر نیست"),
  email: z.string().email("ایمیل معتبر نیست").or(z.literal("")).optional().transform(val => val === "" ? undefined : val),
  birthDate: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]),
  notes: z.string().optional(),
  rating: z.coerce.number().min(1, "حداقل ۱ ستاره").max(5, "حداکثر ۵ ستاره").optional(),
  barberId: z.coerce.number().optional(),
})

type CustomerFormData = z.infer<typeof customerSchema>

interface Customer extends CustomerFormData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [sortField, setSortField] = useState<keyof Customer>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [barbers, setBarbers] = useState<{id:number,firstName:string,lastName:string}[]>([]);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      birthDate: "",
      gender: "UNSPECIFIED",
      notes: "",
      rating: 1,
      barberId: undefined,
    },
  })

  useEffect(() => {
    fetchCustomers();
    fetchBarbers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await api.get("/customers")
      setCustomers(response.data)
    } catch (error) {
      toast({
        title: "خطا",
        description: "دریافت لیست مشتریان با مشکل مواجه شد",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBarbers = async () => {
    try {
      const response = await api.get("/barbers");
      setBarbers(response.data);
    } catch (error) {
      toast({
        title: "خطا",
        description: "دریافت لیست آرایشگران با مشکل مواجه شد",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const values = form.getValues();
      if (!values.email) delete values.email;
      // اگر birthDate مقدار نداشت یا فرمتش معتبر نبود، حذفش کن
      if (!values.birthDate || !isValidJalali(values.birthDate)) {
        delete values.birthDate;
      } else {
        // اگر birthDate شمسی است، به میلادی تبدیل کن
        const [jy, jm, jd] = values.birthDate.split("/").map(Number);
        const { gy, gm, gd } = toGregorian(jy, jm, jd);
        // فرمت YYYY-MM-DD
        values.birthDate = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
      }
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, values)
        toast({
          title: "ویرایش موفق",
          description: "اطلاعات مشتری با موفقیت به‌روزرسانی شد",
        })
      } else {
        await api.post("/customers", values)
        toast({
          title: "ثبت موفق",
          description: "مشتری جدید با موفقیت اضافه شد",
        })
      }
      setIsDialogOpen(false)
      fetchCustomers()
      form.reset()
      setEditingCustomer(null)
    } catch (error: any) {
      let description = "عملیات با مشکل مواجه شد";
      let title = "خطا";
      if (error.response && error.response.data && error.response.data.message) {
        description = error.response.data.message;
        if (error.response.status === 409) {
          title = "اطلاعات تکراری";
        }
      } else if (error.message === "Network Error") {
        description = "ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.";
      }
      toast({
        title,
        description,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    // تبدیل تاریخ میلادی به شمسی برای نمایش در فرم
    let birthDateJalali = "";
    if (customer.birthDate) {
      const [gy, gm, gd] = customer.birthDate.split("-").map(Number);
      if (!isNaN(gy) && !isNaN(gm) && !isNaN(gd)) {
        const { jy, jm, jd } = toJalaali(gy, gm, gd);
        birthDateJalali = `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
      } else {
        birthDateJalali = customer.birthDate;
      }
    }
    form.reset({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phoneNumber,
      email: customer.email || "",
      birthDate: birthDateJalali,
      gender: customer.gender,
      notes: customer.notes || "",
      rating: customer.rating || 1,
      barberId: customer.barberId || undefined,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("آیا از حذف این مشتری اطمینان دارید؟")) return

    try {
      await api.delete(`/customers/${id}`)
      toast({
        title: "حذف موفق",
        description: "مشتری با موفقیت حذف شد",
      })
      fetchCustomers()
    } catch (error: any) {
      let description = "حذف مشتری با مشکل مواجه شد";
      let title = "خطا";
      
      if (error.response && error.response.data && error.response.data.message) {
        description = error.response.data.message;
        if (error.response.status === 409) {
          title = "امکان حذف وجود ندارد";
        }
      } else if (error.message === "Network Error") {
        description = "ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      })
    }
  }

  const handleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.firstName.includes(searchTerm) ||
      customer.lastName.includes(searchTerm) ||
      customer.phoneNumber.includes(searchTerm)
  )

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: number | string | undefined = a[sortField];
    let bValue: number | string | undefined = b[sortField];
    if (sortField === 'birthDate') {
      aValue = aValue ? new Date(aValue as string).getTime() : 0;
      bValue = bValue ? new Date(bValue as string).getTime() : 0;
    }
    if (sortField === 'rating') {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }
    if (aValue! < bValue!) return sortOrder === 'asc' ? -1 : 1;
    if (aValue! > bValue!) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const sortableFields: Array<keyof Customer> = [
    'firstName',
    'lastName',
    'phoneNumber',
    'birthDate',
    'gender',
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>مدیریت مشتریان</CardTitle>
            <CardDescription>لیست مشتریان آرایشگاه</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setEditingCustomer(null)
              form.reset()
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingCustomer(null)
                form.reset()
              }}>
                <UserPlusIcon className="ml-2 h-4 w-4" />
                افزودن مشتری
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? "ویرایش مشتری" : "افزودن مشتری جدید"}
                </DialogTitle>
                <DialogDescription>
                  مشخصات مشتری را وارد کنید
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={handleSubmit} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>نام</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نام خانوادگی</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>شماره موبایل</FormLabel>
                          <FormControl>
                            <Input {...field} dir="ltr" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ایمیل (اختیاری)</FormLabel>
                          <FormControl>
                            <Input {...field} dir="ltr" type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تاریخ تولد (اختیاری)</FormLabel>
                          <FormControl>
                            <PersianDatePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="انتخاب تاریخ تولد"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>جنسیت</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="جنسیت را انتخاب کنید" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MALE">مرد</SelectItem>
                              <SelectItem value="FEMALE">زن</SelectItem>
                              <SelectItem value="UNSPECIFIED">نامشخص</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>یادداشت (اختیاری)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>امتیاز (ستاره)</FormLabel>
                          <Select value={String(field.value)} onValueChange={val => field.onChange(Number(val))}>
                            <SelectTrigger>
                              <SelectValue placeholder="امتیاز را انتخاب کنید" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1,2,3,4,5].map(num => (
                                <SelectItem key={num} value={String(num)}>{'⭐'.repeat(num)} {num}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="barberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>آرایشگر</FormLabel>
                        <Select value={field.value !== undefined && field.value !== null ? String(field.value) : undefined} onValueChange={val => field.onChange(val ? Number(val) : undefined)}>
                          <SelectTrigger>
                            <SelectValue placeholder="انتخاب آرایشگر..." />
                          </SelectTrigger>
                          <SelectContent>
                            {barbers.map(barber => (
                              <SelectItem key={barber.id} value={String(barber.id)}>
                                {barber.firstName} {barber.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    {editingCustomer ? "بروزرسانی" : "افزودن"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 space-x-reverse mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="جستجو..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md"
            />
            <MagnifyingGlassIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <span onClick={() => handleSort('firstName')} className="cursor-pointer select-none">
                    نام {sortField === 'firstName' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </TableHead>
                <TableHead>
                  <span onClick={() => handleSort('lastName')} className="cursor-pointer select-none">
                    نام خانوادگی {sortField === 'lastName' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </TableHead>
                <TableHead>
                  <span onClick={() => handleSort('phoneNumber')} className="cursor-pointer select-none">
                    شماره تماس {sortField === 'phoneNumber' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </TableHead>
                <TableHead>
                  <span onClick={() => handleSort('birthDate')} className="cursor-pointer select-none">
                    تاریخ تولد {sortField === 'birthDate' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </TableHead>
                <TableHead>
                  <span onClick={() => handleSort('rating')} className="cursor-pointer select-none">
                    امتیاز {sortField === 'rating' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </TableHead>
                <TableHead>
                  <span onClick={() => handleSort('gender')} className="cursor-pointer select-none">
                    جنسیت {sortField === 'gender' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </span>
                </TableHead>
                <TableHead>آرایشگر</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    در حال بارگذاری...
                  </TableCell>
                </TableRow>
              ) : sortedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    مشتری‌ای یافت نشد
                  </TableCell>
                </TableRow>
              ) : (
                sortedCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.firstName}</TableCell>
                    <TableCell>{customer.lastName}</TableCell>
                    <TableCell>{customer.phoneNumber}</TableCell>
                    <TableCell>{customer.birthDate ? new Date(customer.birthDate).toLocaleDateString('fa-IR') : '-'}</TableCell>
                    <TableCell>{customer.rating ? '⭐'.repeat(customer.rating) + ' ' + customer.rating : '-'}</TableCell>
                    <TableCell>{customer.gender === 'MALE' ? 'مرد' : customer.gender === 'FEMALE' ? 'زن' : 'نامشخص'}</TableCell>
                    <TableCell>{customer.barber ? `${customer.barber.firstName} ${customer.barber.lastName}` : '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
} 