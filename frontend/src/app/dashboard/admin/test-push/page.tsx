"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/axios';
import { Bell, Send, Users, User, Zap } from 'lucide-react';

export default function TestPushPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState({
    title: '🧪 تست نوتیفیکیشن',
    body: 'این یک پیام تستی است',
    url: '/dashboard',
  });
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  const loadSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const response = await api.get('/push-notifications/admin/all');
      setSubscriptions(response.data.subscriptions || []);
      
      toast({
        title: 'بارگذاری موفق',
        description: `${response.data.subscriptions?.length || 0} اشتراک یافت شد`,
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'خطا در بارگذاری اشتراک‌ها',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const sendTestToMyself = async () => {
    try {
      setLoading(true);
      await api.post('/push-notifications/test');
      
      toast({
        title: 'ارسال موفق',
        description: 'نوتیفیکیشن تستی به دستگاه‌های شما ارسال شد',
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'خطا در ارسال',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendToAllAdmins = async () => {
    try {
      setLoading(true);
      const response = await api.post('/push-notifications/admin/test-role', {
        role: 'ADMIN',
        title: testData.title,
        body: testData.body,
        url: testData.url,
      });
      
      toast({
        title: 'ارسال موفق',
        description: `${response.data.sent || 0} نوتیف ارسال شد، ${response.data.failed || 0} شکست خورد`,
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'خطا در ارسال',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendBroadcast = async () => {
    try {
      setLoading(true);
      const response = await api.post('/push-notifications/admin/broadcast', {
        title: testData.title,
        body: testData.body,
        url: testData.url,
      });
      
      toast({
        title: 'پخش موفق',
        description: `${response.data.sent || 0} نوتیف ارسال شد به همه کاربران`,
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'خطا در پخش',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanupInvalid = async () => {
    try {
      setLoading(true);
      const response = await api.post('/push-notifications/admin/cleanup');
      
      toast({
        title: 'پاکسازی موفق',
        description: `${response.data.deleted || 0} اشتراک نامعتبر حذف شد`,
      });
      
      // Reload subscriptions
      await loadSubscriptions();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'خطا در پاکسازی',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🧪 تست Push Notifications</h1>
        <p className="text-muted-foreground mt-2">ابزار تست و مدیریت سیستم اعلان‌های فشاری</p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            عملیات سریع
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button onClick={sendTestToMyself} disabled={loading} variant="default">
            <User className="w-4 h-4 mr-2" />
            ارسال تست به خودم
          </Button>
          <Button onClick={sendToAllAdmins} disabled={loading} variant="outline">
            <Users className="w-4 h-4 mr-2" />
            ارسال به همه ادمین‌ها
          </Button>
          <Button onClick={loadSubscriptions} disabled={loadingSubscriptions} variant="outline">
            <Bell className="w-4 h-4 mr-2" />
            بارگذاری اشتراک‌ها ({subscriptions.length})
          </Button>
          <Button onClick={cleanupInvalid} disabled={loading} variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
            🗑️ پاکسازی اشتراک‌های نامعتبر
          </Button>
        </CardContent>
      </Card>

      {/* Custom Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            تست سفارشی
          </CardTitle>
          <CardDescription>پیام دلخواه خود را ارسال کنید</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان</Label>
            <Input
              value={testData.title}
              onChange={(e) => setTestData({ ...testData, title: e.target.value })}
              placeholder="عنوان نوتیفیکیشن"
            />
          </div>
          <div className="space-y-2">
            <Label>متن</Label>
            <Textarea
              value={testData.body}
              onChange={(e) => setTestData({ ...testData, body: e.target.value })}
              placeholder="متن نوتیفیکیشن"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>URL هدف</Label>
            <Input
              value={testData.url}
              onChange={(e) => setTestData({ ...testData, url: e.target.value })}
              placeholder="/dashboard"
            />
          </div>
          <Button onClick={sendBroadcast} disabled={loading} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            پخش به همه کاربران
          </Button>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>اشتراک‌های فعال</CardTitle>
            <CardDescription>{subscriptions.length} دستگاه</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptions.map((sub: any, idx: number) => (
                <div key={sub.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{sub?.user?.name ?? 'نام نامشخص'}</div>
                      <div className="text-sm text-muted-foreground">{sub?.user?.phone ?? '—'}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        نقش: {sub?.user?.role ?? '—'} • ایجاد: {new Date(sub.createdAt).toLocaleDateString('fa-IR')}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      sub.endpoint.includes('fcm') ? 'bg-green-100 text-green-700' :
                      sub.endpoint.includes('apple') ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {sub.endpoint.includes('fcm') ? '🤖 Android' :
                       sub.endpoint.includes('apple') ? '🍎 iOS' :
                       '🌐 Other'}
                    </div>
                  </div>
                  <div className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-hidden text-ellipsis">
                    {sub.endpoint.substring(0, 80)}...
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

