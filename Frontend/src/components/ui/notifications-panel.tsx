import { Icon } from "./icon"
import { NotificationItem } from "./notification-item"
import { Notification } from "@/types"

interface NotificationsPanelProps {
  notifications: Notification[]
  onMarkAllAsRead?: () => void
}

export function NotificationsPanel({ notifications, onMarkAllAsRead }: NotificationsPanelProps) {
  return (
    <div className="absolute left-0 mt-2 w-96 rounded-md shadow-lg bg-background border">
      <div className="p-2">
        <div className="mb-2 px-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">اعلان‌ها</h3>
          {notifications.length > 0 && onMarkAllAsRead && (
            <button 
              onClick={onMarkAllAsRead}
              className="text-xs text-primary hover:text-primary/80"
            >
              علامت‌گذاری همه به‌عنوان خوانده‌شده
            </button>
          )}
        </div>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Icon name="BellOff" size={24} className="mb-2" />
              <p className="text-sm">هیچ اعلانی وجود ندارد</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 