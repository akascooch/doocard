import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  // فرض: کارمند لاگین کرده و barberId را باید از session یا توکن بگیرید. فعلاً تستی مقداردهی می‌شود.
  const barberId = 1; // TODO: مقدار واقعی از session
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/accounting/tips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // اگر نیاز به احراز هویت دارید، هدر Authorization را اضافه کنید
    },
    body: JSON.stringify({
      amount: body.amount,
      barberId,
      type: 'withdraw',
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'خطا در ثبت درخواست' }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json(data);
} 