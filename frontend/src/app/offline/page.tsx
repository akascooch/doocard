'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Home, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const checkOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    // Check initial status
    checkOnlineStatus();

    // Listen for online/offline events
    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);

    // Get last sync time from localStorage
    const storedLastSync = localStorage.getItem('lastSync');
    if (storedLastSync) {
      setLastSync(storedLastSync);
    }

    return () => {
      window.removeEventListener('online', checkOnlineStatus);
      window.removeEventListener('offline', checkOnlineStatus);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleRetryConnection = async () => {
    try {
      // Try to fetch a simple endpoint to test connection
      const response = await fetch('/api/health');
      if (response.ok) {
        setIsOnline(true);
        localStorage.setItem('lastSync', new Date().toISOString());
        setLastSync(new Date().toISOString());
        
        // Redirect to dashboard after successful connection
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      }
    } catch (error) {
      console.log('Connection test failed:', error);
    }
  };

  if (isOnline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <WifiOff className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-800">اتصال برقرار شد!</CardTitle>
            <CardDescription className="text-green-600">
              اتصال اینترنت شما برقرار شده است
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGoHome} className="w-full">
              <Home className="w-4 h-4 ml-2" />
              بازگشت به صفحه اصلی
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Card */}
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <WifiOff className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-red-800 text-xl">حالت آفلاین</CardTitle>
            <CardDescription className="text-red-600">
              اتصال اینترنت شما قطع شده است
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">وضعیت اتصال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">وضعیت:</span>
              <Badge variant="destructive">آفلاین</Badge>
            </div>
            
            {lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">آخرین همگام‌سازی:</span>
                <span className="text-sm text-gray-500">
                  {new Date(lastSync).toLocaleString('fa-IR')}
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">زمان:</span>
              <span className="text-sm text-gray-500">
                {new Date().toLocaleString('fa-IR')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">اقدامات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleRetryConnection} 
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              تلاش مجدد برای اتصال
            </Button>
            
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              بارگذاری مجدد صفحه
            </Button>
            
            <Button 
              onClick={handleGoHome} 
              variant="ghost" 
              className="w-full"
            >
              <Home className="w-4 h-4 ml-2" />
              بازگشت به صفحه اصلی
            </Button>
          </CardContent>
        </Card>

        {/* Offline Features Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">قابلیت‌های آفلاین</CardTitle>
            <CardDescription>
              این موارد در حالت آفلاین در دسترس هستند
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-600">مشاهده نوبت‌های ذخیره شده</span>
            </div>
            
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Phone className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-600">مشاهده اطلاعات مشتریان</span>
            </div>
            
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-600">همگام‌سازی خودکار پس از اتصال</span>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 text-lg">راهنمایی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-blue-700">
              • بررسی کنید که Wi-Fi یا داده موبایل شما فعال باشد
            </p>
            <p className="text-sm text-blue-700">
              • مودم خود را ریست کنید
            </p>
            <p className="text-sm text-blue-700">
              • در صورت مشکل، با پشتیبانی تماس بگیرید
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
