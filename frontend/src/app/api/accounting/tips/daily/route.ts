import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // تاریخ امروز به فرمت YYYY-MM-DD
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // فراخوانی بک‌اند برای مجموع تیپ روزانه
  const sumRes = await fetch(`/api/accounting/tips/sum?date=${dateStr}`, {
    headers: {
      'Content-Type': 'application/json',
      // اگر نیاز به احراز هویت دارید، هدر Authorization را اضافه کنید
    },
    cache: 'no-store',
  });
  const sumData = await sumRes.json() as { sum?: number };

  // فراخوانی بک‌اند برای لیست تراکنش‌های تیپ امروز
  const tranRes = await fetch(`/api/accounting/tips?date=${dateStr}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const tranData = await tranRes.json() as any[];

  return NextResponse.json({
    sum: sumData.sum || 0,
    transactions: Array.isArray(tranData) ? tranData : [],
  });
} 