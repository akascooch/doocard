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
  name: string
  phone: string
  email?: string
  role: string
}

export interface Customer {
  id: number
  name: string
  phone: string
  email?: string
  birthdate?: string
  notes?: string
  user?: {
    id: number
    name: string
    phone: string
  }
}

export interface Service {
  id: number
  name: string
  description?: string
  duration: number
  price: number
  isActive: boolean
}

export interface Employee {
  id: number
  userId?: number
  name: string
  phone: string
  email?: string | null
  specialty?: string | null
  baseSalary: number
  commissionRate: number
  isActive?: boolean
  status?: 'active' | 'inactive'
  services?: Array<{
    id: number
    name: string
    description?: string | null
    price: number
    durationMinutes?: number
  }>
  user: {
    id: number
    name: string
    phone: string
    email?: string | null
  }
  employeeServices?: Array<{
    id: number
    serviceId: number
    service: { id: number; name: string; price?: number } | null
  }>
}

export interface IconProps {
  name: string
  size?: number
  className?: string
} 