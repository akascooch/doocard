"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import axios from "@/lib/axios"

const roles = [
  { value: "ADMIN", label: "ادمین" },
  { value: "BARBER", label: "آرایشگر" },
  { value: "CUSTOMER", label: "مشتری" },
]

export default function EditUserPage() {
  const { id } = useParams()
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    role: "CUSTOMER",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    axios.get(`/users/${id}`).then(res => {
      setFormData(res.data)
    })
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await axios.patch(`/users/${id}`, formData)
      router.push("/dashboard/admin/users")
    } catch (err: any) {
      setError(err?.response?.data?.message || "خطا در ویرایش کاربر")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-md mx-auto max-h-[70vh] overflow-y-auto" onReset={() => setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      role: "CUSTOMER",
    })}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <h2 className="text-xl font-bold md:col-span-2">ویرایش کاربر</h2>
      {error && <div className="text-red-600 md:col-span-2">{error}</div>}
      <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="نام" className="border p-2 w-full" required />
      <input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="نام خانوادگی" className="border p-2 w-full" required />
      <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="ایمیل" className="border p-2 w-full" required />
      <input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="شماره موبایل" className="border p-2 w-full" required />
      <select name="role" value={formData.role} onChange={handleChange} className="border p-2 w-full">
        {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full" disabled={loading}>
        {loading ? "در حال ذخیره..." : "ذخیره"}
      </button>
    </form>
  )
}