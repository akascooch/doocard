"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Calendar,
  Filter,
  Download,
  Eye,
  UserCog,
  UserCheck,
  Crown,
  Key
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import { formatToJalali } from '@/lib/date'

interface User {
  id: number
  name: string
  phone: string
  email?: string
  role: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER'
  createdAt: string
  lastLogin?: string
  isActive: boolean
  // Additional fields for employees
  specialty?: string
  baseSalary?: number
  commissionRate?: number
  // Additional fields for customers
  totalAppointments?: number
  lastAppointment?: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const { toast } = useToast()

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'CUSTOMER' as 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER',
    specialty: '',
    baseSalary: 0,
    commissionRate: 0
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری لیست کاربران',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return
    
    console.log('🔧 Editing user:', selectedUser.id);
    console.log('📝 Form data:', formData);
    
    try {
      const updateData = {
        ...(formData.name && { name: formData.name }),
        ...(formData.phone && { phone: formData.phone }),
        ...(formData.email && { email: formData.email }),
        ...(formData.role && { role: formData.role })
      };
      
      console.log('📤 Sending update data:', updateData);
      
      const response = await axios.patch(`/users/${selectedUser.id}`, updateData)
      
      console.log('✅ Update response:', response.data);
      
      toast({
        title: 'موفق',
        description: 'اطلاعات کاربر با موفقیت به‌روزرسانی شد'
      })
      setIsEditDialogOpen(false)
      resetForm()
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Update error:', error);
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی کاربر',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return
    
    try {
      await axios.delete(`/users/${userId}`)
      toast({
        title: 'موفق',
        description: 'کاربر با موفقیت حذف شد'
      })
      fetchUsers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در حذف کاربر',
        variant: 'destructive'
      })
    }
  }

  const handleChangePassword = async () => {
    if (!selectedUser) {
      console.log('❌ No selected user for password change');
      return
    }
    
    console.log('🔑 Changing password for user:', selectedUser.id, selectedUser.name);
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'خطا',
        description: 'رمز عبور و تأیید آن مطابقت ندارند',
        variant: 'destructive'
      })
      return
    }
    
    if (passwordData.newPassword.length < 6) {
      toast({
        title: 'خطا',
        description: 'رمز عبور باید حداقل 6 کاراکتر باشد',
        variant: 'destructive'
      })
      return
    }
    
    try {
      console.log('🔑 Sending password change request for user ID:', selectedUser.id);
      await axios.patch(`/users/${selectedUser.id}/password`, {
        password: passwordData.newPassword
      })
      
      toast({
        title: 'موفق',
        description: `رمز عبور ${selectedUser.name} با موفقیت تغییر کرد`
      })
      setIsPasswordDialogOpen(false)
      setPasswordData({ newPassword: '', confirmPassword: '' })
      setSelectedUser(null)
    } catch (error: any) {
      console.error('❌ Password change error:', error);
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در تغییر رمز عبور',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      role: 'CUSTOMER',
      specialty: '',
      baseSalary: 0,
      commissionRate: 0
    })
    setSelectedUser(null)
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      password: '',
      role: user.role,
      specialty: user.specialty || '',
      baseSalary: user.baseSalary || 0,
      commissionRate: user.commissionRate || 0
    })
    setIsEditDialogOpen(true)
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone.includes(searchTerm) ||
                         (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesRoleFilter = filterRole === 'all' || user.role === filterRole
    const matchesStatusFilter = filterStatus === 'all' || 
                               (filterStatus === 'active' && user.isActive) ||
                               (filterStatus === 'inactive' && !user.isActive)
    
    return matchesSearch && matchesRoleFilter && matchesStatusFilter
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><Crown className="h-3 w-3 ml-1" />مدیر</Badge>
      case 'EMPLOYEE':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><UserCog className="h-3 w-3 ml-1" />کارمند</Badge>
      case 'CUSTOMER':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><UserCheck className="h-3 w-3 ml-1" />مشتری</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Crown className="h-4 w-4 text-red-600" />
      case 'EMPLOYEE':
        return <UserCog className="h-4 w-4 text-blue-600" />
      case 'CUSTOMER':
        return <UserCheck className="h-4 w-4 text-green-600" />
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main-orange"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            مدیریت کاربران
          </h1>
          <p className="text-muted-foreground mt-2">
            مدیریت تمام کاربران سیستم شامل مشتریان، کارکنان و مدیران
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل کاربران</CardTitle>
            <Users className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشتریان</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'CUSTOMER').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کارکنان</CardTitle>
            <UserCog className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'EMPLOYEE').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مدیران</CardTitle>
            <Crown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'ADMIN').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>جستجو و فیلتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو بر اساس نام، شماره موبایل یا ایمیل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select defaultValue={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue placeholder="فیلتر بر اساس نقش" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه کاربران</SelectItem>
                  <SelectItem value="CUSTOMER">مشتریان</SelectItem>
                  <SelectItem value="EMPLOYEE">کارکنان</SelectItem>
                  <SelectItem value="ADMIN">مدیران</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select defaultValue={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="فیلتر بر اساس وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 ml-2" />
              خروجی Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>لیست کاربران</CardTitle>
          <CardDescription>
            {filteredUsers.length} کاربر از {users.length} کاربر
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>شماره موبایل</TableHead>
                  <TableHead>ایمیل</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ عضویت</TableHead>
                  <TableHead>آخرین ورود</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-light-orange rounded-full flex items-center justify-center">
                          {getRoleIcon(user.role)}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {user.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.isActive ? 'success' : 'outline'}
                      >
                        {user.isActive ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatToJalali(user.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastLogin ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatToJalali(user.lastLogin)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setIsPasswordDialogOpen(true)
                          }}
                          className="text-yellow-600 hover:text-yellow-700"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ویرایش کاربر</DialogTitle>
            <DialogDescription>
              اطلاعات کاربر را ویرایش کنید
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-name">نام و نام خانوادگی *</label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-phone">شماره موبایل *</label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="09123456789"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-email">ایمیل (اختیاری)</label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="example@email.com"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-role">نقش کاربر</label>
              <Select defaultValue={formData.role} onValueChange={(value: any) => setFormData({...formData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">مشتری</SelectItem>
                  <SelectItem value="EMPLOYEE">کارمند</SelectItem>
                  <SelectItem value="ADMIN">مدیر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleEditUser} className="bg-main-orange hover:bg-main-orange/90">
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تغییر رمز عبور</DialogTitle>
            <DialogDescription>
              رمز عبور جدید برای <strong>{selectedUser?.name}</strong> (ID: {selectedUser?.id}) وارد کنید
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="new-password">رمز عبور جدید *</label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                placeholder="رمز عبور جدید"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="confirm-password">تأیید رمز عبور *</label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                placeholder="تأیید رمز عبور"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleChangePassword} className="bg-main-orange hover:bg-main-orange/90">
              تغییر رمز عبور
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}