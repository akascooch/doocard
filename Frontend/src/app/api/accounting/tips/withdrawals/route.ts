import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // فقط درخواست‌های برداشت در انتظار تأیید
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/accounting/tips?type=withdraw&status=pending`, {
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data);
} 