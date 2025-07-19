import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { status } = body;
  const { id } = params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/accounting/tips/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'خطا در بروزرسانی وضعیت' }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json(data);
} 