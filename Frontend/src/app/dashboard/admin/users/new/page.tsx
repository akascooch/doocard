"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import axios from "@/lib/axios"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

const roles = [
  { value: "ADMIN", label: "ادمین" },
  { value: "BARBER", label: "آرایشگر" },
  { value: "CUSTOMER", label: "مشتری" },
]

export default function CreateUserPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    role: "CUSTOMER",
    password: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await axios.post("/users", formData)
      router.push("/dashboard/admin/users")
    } catch (err: any) {
      setError(err?.response?.data?.message || "خطا در ثبت کاربر")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative max-w-md mx-auto">
      <button
        type="button"
        className="absolute top-2 left-2 text-gray-500 hover:text-red-600 text-2xl font-bold focus:outline-none"
        onClick={() => router.push("/dashboard/admin/users")}
        aria-label="بستن"
      >
        ×
      </button>
      <Card>
        <CardHeader>
          <CardTitle>ثبت کاربر جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto" onReset={() => setFormData({
            firstName: "",
            lastName: "",
            email: "",
            phoneNumber: "",
            role: "CUSTOMER",
            password: "",
          })}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && <div className="text-red-600 md:col-span-2">{error}</div>}
              <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="نام" className="border p-2 w-full" required />
              <input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="نام خانوادگی" className="border p-2 w-full" required />
              <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="ایمیل" className="border p-2 w-full" required />
              <input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="شماره موبایل" className="border p-2 w-full" required />
              <select name="role" value={formData.role} onChange={handleChange} className="border p-2 w-full">
                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="رمز عبور" className="border p-2 w-full" required />
            </div>
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded w-full" disabled={loading}>
              {loading ? "در حال ثبت..." : "ثبت"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}