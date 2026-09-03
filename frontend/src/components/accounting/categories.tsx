'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, Search, Filter } from 'lucide-react';
import api from '../../lib/axios';

interface Category {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  
  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [description, setDescription] = useState('');
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    filterCategories();
  }, [categories, searchTerm, typeFilter]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/accounting/categories');
      if (!response.data) throw new Error('خطا در دریافت دسته‌بندی‌ها');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCategories = () => {
    let filtered = categories;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(category => category.type === typeFilter);
    }

    setFilteredCategories(filtered);
  };

  const resetForm = () => {
    setName('');
    setType('INCOME');
    setDescription('');
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('لطفاً نام دسته‌بندی را وارد کنید');
      return;
    }

    try {
      const response = await api.post('/accounting/categories', { 
        name: name.trim(), 
        type, 
        description: description.trim() || null 
      });
      
      if (!response.data) throw new Error('خطا در ثبت دسته‌بندی');
      
      setCategories(prev => [...prev, response.data]);
      resetForm();
      setIsAddDialogOpen(false);
      alert('دسته‌بندی با موفقیت ثبت شد!');
    } catch (error: any) {
      console.error('Error creating category:', error);
      alert(error.response?.data?.message || 'خطا در ثبت دسته‌بندی!');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditType(category.type);
    setEditDescription(category.description || '');
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) {
      alert('لطفاً نام دسته‌بندی را وارد کنید');
      return;
    }

    try {
      const response = await api.put(`/accounting/categories/${editingCategory.id}`, {
        name: editName.trim(),
        type: editType,
        description: editDescription.trim() || null
      });

      if (!response.data) throw new Error('خطا در بروزرسانی دسته‌بندی');

      setCategories(prev => 
        prev.map(cat => cat.id === editingCategory.id ? response.data : cat)
      );
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      alert('دسته‌بندی با موفقیت بروزرسانی شد!');
    } catch (error: any) {
      console.error('Error updating category:', error);
      alert(error.response?.data?.message || 'خطا در بروزرسانی دسته‌بندی!');
    }
  };

  const handleDelete = async (category: Category) => {
    try {
      await api.delete(`/accounting/categories/${category.id}`);
      setCategories(prev => prev.filter(cat => cat.id !== category.id));
      alert('دسته‌بندی با موفقیت حذف شد!');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.response?.data?.message || 'خطا در حذف دسته‌بندی!');
    }
  };

  const getTypeBadge = (type: 'INCOME' | 'EXPENSE') => {
    return (
      <Badge variant={type === 'INCOME' ? 'default' : 'destructive'}>
        {type === 'INCOME' ? 'درآمد' : 'هزینه'}
      </Badge>
    );
  };

  const stats = {
    total: categories.length,
    income: categories.filter(c => c.type === 'INCOME').length,
    expense: categories.filter(c => c.type === 'EXPENSE').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">در حال بارگذاری...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل دسته‌بندی‌ها</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">دسته‌بندی‌های درآمد</CardTitle>
            <Badge variant="default" className="text-xs">درآمد</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.income}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">دسته‌بندی‌های هزینه</CardTitle>
            <Badge variant="destructive" className="text-xs">هزینه</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expense}</div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Search and Add Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="جستجو در دسته‌بندی‌ها..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select onValueChange={(value) => setTypeFilter(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={typeFilter === 'ALL' ? 'همه' : typeFilter === 'INCOME' ? 'درآمد' : 'هزینه'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه</SelectItem>
                <SelectItem value="INCOME">درآمد</SelectItem>
                <SelectItem value="EXPENSE">هزینه</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              افزودن دسته‌بندی
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن دسته‌بندی جدید</DialogTitle>
              <DialogDescription>
                اطلاعات دسته‌بندی جدید را وارد کنید
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">نام دسته‌بندی *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="نام دسته‌بندی را وارد کنید"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">نوع دسته‌بندی *</Label>
                <Select onValueChange={(value) => setType(value as 'INCOME' | 'EXPENSE')}>
                  <SelectTrigger>
                    <SelectValue placeholder={type === 'INCOME' ? 'درآمد' : 'هزینه'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">درآمد</SelectItem>
                    <SelectItem value="EXPENSE">هزینه</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">توضیحات</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات دسته‌بندی را وارد کنید"
                  rows={3}
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit">افزودن</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>لیست دسته‌بندی‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || typeFilter !== 'ALL' ? 'دسته‌بندی‌ای یافت نشد' : 'هیچ دسته‌بندی‌ای وجود ندارد'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام دسته‌بندی</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>توضیحات</TableHead>
                  <TableHead className="text-right">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{getTypeBadge(category.type)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>ویرایش دسته‌بندی</DialogTitle>
                              <DialogDescription>
                                اطلاعات دسته‌بندی را ویرایش کنید
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-name">نام دسته‌بندی *</Label>
                                <Input
                                  id="edit-name"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="نام دسته‌بندی را وارد کنید"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-type">نوع دسته‌بندی *</Label>
                                <Select onValueChange={(value) => setEditType(value as 'INCOME' | 'EXPENSE')}>
                                  <SelectTrigger>
                                    <SelectValue placeholder={editType === 'INCOME' ? 'درآمد' : 'هزینه'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="INCOME">درآمد</SelectItem>
                                    <SelectItem value="EXPENSE">هزینه</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-description">توضیحات</Label>
                                <Textarea
                                  id="edit-description"
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  placeholder="توضیحات دسته‌بندی را وارد کنید"
                                  rows={3}
                                />
                              </div>
                              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                  انصراف
                                </Button>
                                <Button type="submit">بروزرسانی</Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف دسته‌بندی</AlertDialogTitle>
                              <AlertDialogDescription>
                                آیا مطمئن هستید که می‌خواهید دسته‌بندی "{category.name}" را حذف کنید؟
                                این عملیات غیرقابل بازگشت است.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>انصراف</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(category)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 