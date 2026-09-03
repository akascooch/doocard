'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, Clock, AlertCircle } from 'lucide-react';
import { useNotifications, Notification } from '@/store/notifications';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';

export default function NotificationsPage() {
  const { toast } = useToast();
  const {
    notifications,
    setNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/my');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری نوتیفیکیشن‌ها با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/mark-read`);
      markAsRead(id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      markAllAsRead();
      toast({
        title: '✅ انجام شد',
        description: 'همه نوتیفیکیشن‌ها به عنوان خوانده شده علامت‌گذاری شدند',
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: 'خطا',
        description: 'خطا در علامت‌گذاری نوتیفیکیشن‌ها',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      removeNotification(id);
      toast({
        title: '🗑️ حذف شد',
        description: 'نوتیفیکیشن حذف شد',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف نوتیفیکیشن',
        variant: 'destructive',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_CONFIRMED':
        return '📅';
      case 'APPOINTMENT_SETTLED':
        return '💰';
      case 'APPOINTMENT_CANCELLED':
        return '❌';
      case 'DEBT_CREATED':
      case 'DEBT_SETTLED':
        return '🧾';
      case 'CUSTOMER_REGISTERED':
        return '👤';
      case 'TRANSACTION_CREATED':
      case 'PAYMENT_RECEIVED':
        return '💳';
      default:
        return '🔔';
    }
  };

  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: faIR,
      });
    } catch (error) {
      return 'اخیراً';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead);

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 md:py-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              نوتیفیکیشن‌ها
            </h1>
            <p className="text-sm text-muted-foreground">
              {unreadNotifications.length} نوتیفیکیشن خوانده نشده
            </p>
          </div>
        </div>

        {unreadNotifications.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden md:inline">خواندن همه</span>
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            نوتیفیکیشنی وجود ندارد
          </h3>
          <p className="text-sm text-muted-foreground">
            وقتی نوتیفیکیشن جدیدی دریافت کنید، اینجا نمایش داده می‌شود
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Unread Notifications */}
          {unreadNotifications.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
                جدید
              </h2>
              <AnimatePresence>
                {unreadNotifications.map((notification, index) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    index={index}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                    getIcon={getNotificationIcon}
                    getRelativeTime={getRelativeTime}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Read Notifications */}
          {readNotifications.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1 mt-6">
                قبلی
              </h2>
              <AnimatePresence>
                {readNotifications.map((notification, index) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    index={index}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                    getIcon={getNotificationIcon}
                    getRelativeTime={getRelativeTime}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Notification Card Component
function NotificationCard({
  notification,
  index,
  onMarkAsRead,
  onDelete,
  getIcon,
  getRelativeTime,
}: {
  notification: Notification;
  index: number;
  onMarkAsRead: (id: number) => void;
  onDelete: (id: number) => void;
  getIcon: (type: string) => string;
  getRelativeTime: (date: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05 }}
      className="mb-2"
    >
      <Card
        className={`p-4 transition-all hover:shadow-md ${
          !notification.isRead
            ? 'bg-primary/5 border-primary/30'
            : 'bg-white dark:bg-gray-800'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
              !notification.isRead
                ? 'bg-primary/20'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            {getIcon(notification.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">
                  {notification.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {getRelativeTime(notification.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkAsRead(notification.id)}
                    className="h-8 w-8 p-0"
                    title="خوانده شد"
                  >
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(notification.id)}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

