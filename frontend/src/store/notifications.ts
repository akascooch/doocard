import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  roleTarget?: string;
  userIdTarget?: number;
  relatedEntity?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  isConnected: boolean;
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  removeNotification: (id: number) => void;
  setUnreadCount: (count: number) => void;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useNotifications = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,
  isConnected: false,

  setNotifications: (notifications) => {
    const unread = notifications.filter(n => !n.isRead).length;
    set({ notifications, unreadCount: unread });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt || new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  },

  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === id);
      const wasUnread = notification && !notification.isRead;
      
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  setUnreadCount: (count) => set({ unreadCount: count }),

  connectSocket: (token) => {
    const { socket } = get();
    
    // Disconnect existing socket
    if (socket) {
      socket.disconnect();
    }

    // Create new socket connection with resilience - use HTTPS in production
    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const backendUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : 'http://127.0.0.1:3001';
    
    const newSocket = io(`${backendUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
      secure: isProduction, // Force secure connection in production
      rejectUnauthorized: isProduction, // Validate SSL certificate in production
    });

    // On every reconnect attempt, use the latest access token from localStorage.
    // Access JWTs expire (~24h); the axios interceptor refreshes them into
    // localStorage via the httpOnly refresh cookie. Without this, the socket
    // would keep presenting the original expired token and stay disconnected
    // even though the user still has a valid "remembered" device session.
    newSocket.io.on('reconnect_attempt', () => {
      try {
        const latest =
          typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (latest) {
          newSocket.auth = { token: latest };
        }
      } catch {
        // ignore storage errors
      }
    });

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    newSocket.on('connect', () => {
      console.log('✅ Notifications socket connected');
      reconnectAttempts = 0;
      set({ isConnected: true });
      
      // Dispatch custom event for GlobalErrorHandler
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ws-connected'));
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Notifications socket disconnected:', reason);
      set({ isConnected: false });
      // Socket failure must NOT invalidate auth: do NOT clear token, do NOT call logout, do NOT router.refresh() or location.reload()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ws-disconnected'));
      }
    });

    newSocket.on('notification', (notification: Notification) => {
      console.log('📢 New notification received:', notification);
      get().addNotification(notification);
    });

    newSocket.on('connect_error', (error) => {
      reconnectAttempts++;
      console.error(`❌ Socket connection error (attempt ${reconnectAttempts}):`, error.message);
      set({ isConnected: false });
      // Socket failure must NOT invalidate auth: do NOT clear token, do NOT call logout, do NOT reload
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.warn('⚠️ Max reconnection attempts reached. Will keep trying in background...');
      }
    });

    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));

