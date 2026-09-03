import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  try {
    const res = await fetch(`${API_BASE_URL}/api/customers/me/profile`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}


