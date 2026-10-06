import { Icon } from "./icon"
import { Notification, NotificationType } from "@/types"

interface NotificationItemProps {
  notification: Notification
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'appointment':
      return { name: 'CalendarPlus', className: 'text-foreground' }
    case 'cancellation':
      return { name: 'CalendarX', className: 'text-destructive' }
    case 'reminder':
      return { name: 'Clock', className: 'text-foreground' }
    case 'system':
      return { name: 'Settings', className: 'text-foreground' }
    default:
      return { name: 'Bell', className: 'text-foreground' }
  }
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const icon = getNotificationIcon(notification.type)
  
  return (
    <div
      className={`flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent ${
        !notification.isRead ? 'bg-accent/50' : ''
      }`}
    >
      <div className={`mt-0.5 ${icon.className}`}>
        <Icon name={icon.name as any} size={18} />
      </div>
      <div className="flex-1">
        <p className="text-sm leading-5">{notification.text}</p>
        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
      </div>
      {!notification.isRead && (
        <div className="h-2 w-2 rounded-full bg-primary mt-2" />
      )}
    </div>
  )
} 