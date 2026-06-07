'use client';

import { useEffect } from 'react';
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
    addNotification,
  } = useNotifications();

  useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, skipping notification initialization');
      return;
    }

    // Connect WebSocket
    connectSocket(token);

    // Load initial notifications
    loadNotifications();

    // Load unread count
    loadUnreadCount();

    // Cleanup on unmount
    return () => {
      disconnectSocket();
    };
  }, []);

  // Subscribe to new notifications from store to show toasts
  useEffect(() => {
    const unsubscribe = useNotifications.subscribe(
      (state, prevState) => {
        // Check if a new notification was added
        if (state.notifications.length > prevState.notifications.length) {
          const newNotification = state.notifications[0];
          
          // Show toast for new notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
        }
      }
    );

    return unsubscribe;
  }, [toast]);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications/my?limit=20');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  return <>{children}</>;
}

