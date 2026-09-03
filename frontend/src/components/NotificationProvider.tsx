'use client';

import { useEffect, useCallback } from 'react';
import { useNotifications } from '@/store/notifications';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const {
    connectSocket,
    disconnectSocket,
    setNotifications,
    setUnreadCount,
  } = useNotifications();

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications/my?limit=20');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [setNotifications]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [setUnreadCount]);

  const bindSession = useCallback(
    (token: string) => {
      connectSocket(token);
      void loadNotifications();
      void loadUnreadCount();
    },
    [connectSocket, loadNotifications, loadUnreadCount]
  );

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      console.log('No token found, skipping notification initialization');
      return;
    }

    bindSession(token);

    return () => {
      disconnectSocket();
    };
  }, [bindSession, disconnectSocket]);

  // After access-token refresh (httpOnly refresh cookie rotated a new JWT),
  // rebind the socket and re-sync the in-app notification center. Push delivery
  // itself does not need this — only in-app / WebSocket paths do.
  useEffect(() => {
    const onTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string }>).detail;
      const token = detail?.token || localStorage.getItem('token');
      if (!token) return;
      console.log('🔄 Auth token refreshed — rebinding notification session');
      bindSession(token);
    };

    window.addEventListener('auth-token-refreshed', onTokenRefreshed);
    return () => {
      window.removeEventListener('auth-token-refreshed', onTokenRefreshed);
    };
  }, [bindSession]);

  // Subscribe to new notifications from store to show toasts
  useEffect(() => {
    const unsubscribe = useNotifications.subscribe(
      (state, prevState) => {
        if (state.notifications.length > prevState.notifications.length) {
          const newNotification = state.notifications[0];
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
        }
      }
    );

    return unsubscribe;
  }, [toast]);

  return <>{children}</>;
}
