"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "./input"
import { Button } from "./button"
import { Search, X, User } from "lucide-react"
import axios from "@/lib/axios"
import { Customer } from "@/types"

interface CustomerSearchProps {
  value: string
  onChange: (value: string) => void
  onCustomerSelect: (customer: Customer) => void
  placeholder?: string
  disabled?: boolean
}

export function CustomerSearch({
  value,
  onChange,
  onCustomerSelect,
  placeholder = "جستجوی مشتری...",
  disabled = false
}: CustomerSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Search customers when query changes
  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchQuery.trim()) {
        setCustomers([])
        setShowDropdown(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await axios.get(`/customers?search=${encodeURIComponent(searchQuery)}`)
        setCustomers(response.data)
        setShowDropdown(true)
      } catch (error) {
        console.error("Error searching customers:", error)
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchCustomers, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    onChange(newValue)
    
    // Clear selected customer if user starts typing
    if (selectedCustomer) {
      setSelectedCustomer(null)
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchQuery(customer.name)
    setShowDropdown(false)
    onChange(String(customer.id))
    onCustomerSelect(customer)
  }

  const handleClear = () => {
    setSearchQuery("")
    setSelectedCustomer(null)
    setCustomers([])
    setShowDropdown(false)
    onChange("")
  }

  const handleInputFocus = () => {
    if (customers.length > 0) {
      setShowDropdown(true)
    }
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10 pl-10"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              در حال جستجو...
            </div>
          ) : customers.length > 0 ? (
            <div className="py-1">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full px-4 py-2 text-right hover:bg-muted/50 flex items-center gap-2 transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <div className="font-medium">
                      {customer.name}
                    </div>
                    {customer.phone && (
                      <div className="text-sm text-muted-foreground">
                        {customer.phone}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              مشتری‌ای یافت نشد
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
} 