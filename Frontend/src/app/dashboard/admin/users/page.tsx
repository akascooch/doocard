"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "@/lib/axios"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from '@/components/ui/use-toast'

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  role: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{ [userId: string]: boolean }>({})
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const isConfirmed = confirm("آیا مطمئنی می‌خوای این کاربر رو حذف کنی؟")
    if (!isConfirmed) return

    try {
      await axios.delete(`/users/${id}`)
      setUsers(prev => prev.filter(user => user.id !== id))
    } catch (error) {
      alert("حذف کاربر با خطا مواجه شد.")
    }
  }

  const handleImportAll = async () => {
    setImporting(true)
    try {
      const response = await axios.get('/users')
      const users = response.data
      for (const user of users) {
        if (user.role === 'CUSTOMER' || user.role === 'BARBER') {
          const checkRes = await axios.get(`/users/sync-role/check?userId=${user.id}&role=${user.role}`)
          if (!checkRes.data.exists) {
            await axios.post('/users/sync-role', { userId: user.id, role: user.role })
          }
        }
      }
      toast({
        title: 'ایمپورت موفق',
        description: 'ایمپورت دیتا با موفقیت انجام شد!',
        variant: 'default',
      })
    } catch (e) {
      toast({
        title: 'خطا',
        description: 'خطا در ایمپورت دیتا!',
        variant: 'destructive',
      })
      console.error(e)
    } finally {
      setImporting(false)
    }
  }

  // تابع بررسی وضعیت ایمپورت هر کاربر
  const checkImportStatus = async (user: User) => {
    if (user.role === 'CUSTOMER' || user.role === 'BARBER') {
      try {
        const res = await axios.get(`/users/sync-role/check?userId=${user.id}&role=${user.role}`)
        return !!res.data.exists
      } catch {
        return false
      }
    }
    return true // برای admin و نقش‌های دیگر همیشه true
  }

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('/users')
        setUsers(response.data)
        // وضعیت ایمپورت را برای هر کاربر بگیر
        const statusObj: { [userId: string]: boolean } = {}
        await Promise.all(response.data.map(async (user: User) => {
          statusObj[user.id] = await checkImportStatus(user)
        }))
        setImportStatus(statusObj)
      } catch (err) {
        // handle error
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [importing])

  if (loading) return <div>در حال بارگذاری کاربران...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>لیست کاربران</CardTitle>
        <div className="flex justify-center mt-4">
          <Button onClick={handleImportAll} disabled={importing} size="lg" className="text-lg font-bold">
            {importing ? 'در حال ایمپورت...' : 'ایمپورت همه کاربران به جداول نقش‌ها'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button variant="primary" onClick={() => router.push('/dashboard/admin/users/new')}>
            ثبت کاربر جدید
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>نام خانوادگی</TableHead>
              <TableHead>ایمیل</TableHead>
              <TableHead>شماره موبایل</TableHead>
              <TableHead>نقش</TableHead>
              <TableHead>ایمپورت</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: any) => (
              <TableRow key={user.id}>
                <TableCell>{user.firstName}</TableCell>
                <TableCell>{user.lastName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phoneNumber}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'primary' : 'secondary'}>{user.role}</Badge>
                </TableCell>
                <TableCell>
                  {importStatus[user.id] === undefined ? '...' : importStatus[user.id] ? 'ایمپورت شده' : 'ایمپورت نشده'}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/admin/users/${user.id}/edit`)}>
                    ویرایش
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/admin/permissions?userId=${user.id}`)}>
                    دسترسی‌ها
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                    🗑️ حذف
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}