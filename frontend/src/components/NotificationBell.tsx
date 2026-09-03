'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/store/notifications';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const [ping, setPing] = useState(false);

  useEffect(() => {
    if (unreadCount > 0) {
      setPing(true);
      const timer = setTimeout(() => setPing(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  const handleClick = () => {
    router.push('/dashboard/notifications');
  };

  return (
    <motion.div
      className="relative cursor-pointer"
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
    >
      <Bell
        className={cn(
          'w-6 h-6 transition-colors',
          unreadCount > 0 ? 'text-gray-500' : 'text-gray-400 dark:text-gray-500'
        )}
      />
      
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className={cn(
              'absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1',
              ping && 'animate-ping'
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated ring on new notification */}
      {ping && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-gray-500"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      )}
    </motion.div>
  );
}

