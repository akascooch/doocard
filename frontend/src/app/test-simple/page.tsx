"use client"

import { useState } from 'react'

export default function TestSimplePage() {
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">تست ساده</h1>
        
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز عبور"
            className="w-full p-3 border rounded pr-10"
          />
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1"
            onClick={() => {
              console.log('Button clicked!')
              setShowPassword(!showPassword)
            }}
          >
            {showPassword ? "👁️‍🗨️" : "👁️"}
          </button>
        </div>

        <div className="p-4 bg-white rounded border">
          <p>مقدار رمز عبور: <strong>{password || '(خالی)'}</strong></p>
          <p>نوع فیلد: <strong>{showPassword ? 'text' : 'password'}</strong></p>
        </div>

        <button
          onClick={() => setShowPassword(!showPassword)}
          className="w-full p-2 bg-blue-500 text-white rounded"
        >
          تغییر نوع فیلد
        </button>
      </div>
    </div>
  )
} 