import { NextResponse } from 'next/server'

// اینجا باید دیتابیس واقعی، فایل JSON یا آرایه رو آپدیت کنی
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const userId = params.id

  // فرض کن دیتابیس نداری و فعلاً فقط پیام می‌دی
  console.log("Deleting user with id:", userId)

  return NextResponse.json({ message: `User ${userId} deleted` }, { status: 200 })
}
