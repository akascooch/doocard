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
import api from '../../lib/axios';

interface Category {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  description: string | null;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/accounting/categories');
        if (!response.data) throw new Error('خطا در دریافت دسته‌بندی‌ها');
        const data = response.data;
        setCategories(data);
      } catch (error) {
        setCategories([]);
        alert('خطا در دریافت دسته‌بندی‌ها!');
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/accounting/categories', { name, type, description });
      if (!response.data) throw new Error('خطا در ثبت دسته‌بندی');
      setName('');
      setType('INCOME');
      setDescription('');
      // Refresh list
      const data = response.data;
      setCategories((prev) => [...prev, data]);
      alert('دسته‌بندی با موفقیت ثبت شد!');
    } catch (error) {
      alert('خطا در ثبت دسته‌بندی!');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا مطمئن هستید؟')) return;
    try {
      const response = await api.delete(`/accounting/categories/${id}`);
      if (!response.data) throw new Error('خطا در حذف دسته‌بندی');
      setCategories((prev) => prev.filter((c) => c.id !== id));
      alert('دسته‌بندی حذف شد!');
    } catch (error) {
      alert('خطا در حذف دسته‌بندی!');
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>افزودن دسته‌بندی جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">نام دسته‌بندی</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام دسته‌بندی را وارد کنید"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">نوع دسته‌بندی</Label>
              <Select onValueChange={(value) => setType(value as 'INCOME' | 'EXPENSE')}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">درآمد</SelectItem>
                  <SelectItem value="EXPENSE">هزینه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات دسته‌بندی را وارد کنید"
              />
            </div>
            <Button type="submit" className="w-full">
              افزودن دسته‌بندی
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>لیست دسته‌بندی‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام</TableHead>
                <TableHead>نوع</TableHead>
                <TableHead>توضیحات</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        category.type === 'INCOME'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {category.type === 'INCOME' ? 'درآمد' : 'هزینه'}
                    </span>
                  </TableCell>
                  <TableCell>{category.description || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                    >
                      حذف
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 