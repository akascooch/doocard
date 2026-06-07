"use client"

import { useState } from 'react'
import { PasswordInput } from '@/components/ui/password-input'
import { SimplePasswordInput } from '@/components/ui/simple-password-input'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function TestPasswordPage() {
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [email, setEmail] = useState('')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background rtl p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center mb-6">تست کامپوننت رمز عبور</h1>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-right block">ایمیل</label>
          <Input
            type="email"
            placeholder="ایمیل خود را وارد کنید"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-right block">رمز عبور (کامپوننت اصلی)</label>
          <PasswordInput
            placeholder="رمز عبور خود را وارد کنید"
            value={password1}
            onChange={(e) => setPassword1(e.target.value)}
          />
          <p className="text-xs text-gray-500">مقدار: {password1 || '(خالی)'}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-right block">رمز عبور (کامپوننت ساده)</label>
          <SimplePasswordInput
            placeholder="رمز عبور خود را وارد کنید"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
          <p className="text-xs text-gray-500">مقدار: {password2 || '(خالی)'}</p>
        </div>

        <Button className="w-full" onClick={() => {
          console.log('Password 1:', password1)
          console.log('Password 2:', password2)
          alert(`رمز عبور 1: ${password1}\nرمز عبور 2: ${password2}`)
        }}>
          تست
        </Button>

        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <p className="text-sm">
            <strong>مقدار رمز عبور 1:</strong> {password1 || '(خالی)'}
          </p>
          <p className="text-sm">
            <strong>مقدار رمز عبور 2:</strong> {password2 || '(خالی)'}
          </p>
        </div>
      </div>
    </div>
  )
} 