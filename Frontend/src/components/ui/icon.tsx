"use client"

import * as React from "react"
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  CalendarIcon,
  UsersIcon,
  ScissorsIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Squares2X2Icon,
  BellIcon,
  UserIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  SwatchIcon,
  CircleStackIcon,
  ChatBubbleLeftIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { IconProps } from "@/types"
import * as LucideIcons from "lucide-react"

const icons = {
  Plus: PlusIcon,
  Search: MagnifyingGlassIcon,
  Edit: PencilIcon,
  Trash2: TrashIcon,
  UserPlus: UserPlusIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  Check: CheckIcon,
  Calendar: CalendarIcon,
  Users: UsersIcon,
  Scissors: ScissorsIcon,
  Settings: Cog6ToothIcon,
  Menu: Bars3Icon,
  X: XMarkIcon,
  LogOut: ArrowRightOnRectangleIcon,
  Sun: SunIcon,
  Moon: MoonIcon,
  LayoutDashboard: Squares2X2Icon,
  Bell: BellIcon,
  User: UserIcon,
  Save: ArrowDownTrayIcon,
  Upload: ArrowUpTrayIcon,
  Shield: ShieldCheckIcon,
  Palette: SwatchIcon,
  Database: CircleStackIcon,
  MessageSquare: ChatBubbleLeftIcon,
  Loader: ArrowPathIcon,
}

export type IconName = keyof typeof icons

export function Icon({ name, size = 24, className }: IconProps) {
  const IconComponent = LucideIcons[name as keyof typeof LucideIcons]
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`)
    return null
  }
  
  return <IconComponent size={size} className={className} />
} 