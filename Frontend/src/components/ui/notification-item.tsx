import { Icon } from "./icon"
import { Notification, NotificationType } from "@/types"

interface NotificationItemProps {
  notification: Notification
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'appointment':
      return { name: 'CalendarPlus', className: 'text-green-500' }
    case 'cancellation':
      return { name: 'CalendarX', className: 'text-red-500' }
    case 'reminder':
      return { name: 'Clock', className: 'text-blue-500' }
    case 'system':
      return { name: 'Settings', className: 'text-purple-500' }
    default:
      return { name: 'Bell', className: 'text-gray-500' }
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
        <Icon name={icon.name} size={18} />
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