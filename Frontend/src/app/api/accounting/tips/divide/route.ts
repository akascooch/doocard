import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  // فرض: ادمین تقسیم تیپ را انجام می‌دهد
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/accounting/tips/divide`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // اگر نیاز به احراز هویت دارید، هدر Authorization را اضافه کنید
    },
    body: JSON.stringify({
      amount: body.amount,
      barberIds: body.barberIds,
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'خطا در تقسیم تیپ' }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json(data);
} 