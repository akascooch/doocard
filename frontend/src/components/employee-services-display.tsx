"use client"

import { Badge } from "@/components/ui/badge"
import { Scissors } from "lucide-react"

interface Service {
  id: number
  name: string
  description?: string | null
  price: number
  durationMinutes?: number
}

interface EmployeeServicesDisplayProps {
  services?: Service[]
  maxDisplay?: number
}

export function EmployeeServicesDisplay({ 
  services, 
  maxDisplay = 2 
}: EmployeeServicesDisplayProps) {
  if (!services || services.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Scissors className="h-4 w-4" />
        <span>خدماتی هنوز وصل نشده</span>
      </div>
    )
  }

  const displayedServices = services.slice(0, maxDisplay)
  const remainingCount = services.length - maxDisplay

  return (
    <div className="flex flex-wrap gap-1">
      {displayedServices.map((service) => (
        <Badge 
          key={service.id}
          variant="secondary" 
          className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200"
          title={`${service.name} - ${service.price.toLocaleString('fa-IR')} تومان`}
        >
          {service.name}
        </Badge>
      ))}
      
      {remainingCount > 0 && (
        <Badge 
          variant="outline" 
          className="text-xs"
          title={`سایر خدمات: ${services.slice(maxDisplay).map(s => s.name).join(', ')}`}
        >
          +{remainingCount} دیگر
        </Badge>
      )}
    </div>
  )
}
