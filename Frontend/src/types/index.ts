import { LucideIcon } from 'lucide-react'

export type NotificationType = 'appointment' | 'cancellation' | 'reminder' | 'system'

export interface Notification {
  id: number
  text: string
  time: string
  type: NotificationType
  isRead: boolean
}

export interface User {
  id: string
  firstName: string
  lastName: string
  username: string
  role: string
}

export interface IconProps {
  name: keyof typeof import('lucide-react')
  size?: number
  className?: string
} 