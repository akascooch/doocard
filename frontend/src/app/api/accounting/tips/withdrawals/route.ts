import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // فقط درخواست‌های برداشت در انتظار تأیید
  const res = await fetch(`/api/accounting/tips?type=withdraw&status=pending`, {
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data);
} 