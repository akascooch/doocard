import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

export const dynamic = 'force-dynamic'

function authHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const authorization = request.headers.get('authorization')
  if (authorization) {
    headers.Authorization = authorization
  }
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.Cookie = cookie
  }
  return headers
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')

    // Authenticated dashboard calls need the full NestJS list (includes user + services).
    if (authorization) {
      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: 'GET',
        headers: authHeaders(request),
        cache: 'no-store',
      })

      const text = await response.text()
      if (!response.ok) {
        console.error('[API Route] GET /employees auth proxy failed:', response.status, text)
        return NextResponse.json([], { status: response.status })
      }

      return NextResponse.json(JSON.parse(text))
    }

    // Unauthenticated callers (legacy) → minimal public list for booking widgets.
    const response = await fetch(`${API_BASE_URL}/api/employees/public/active`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    const text = await response.text()
    if (!response.ok) {
      console.error('[API Route] GET /employees public/active failed:', response.status, text)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(JSON.parse(text))
  } catch (error) {
    console.error('[API Route] Error fetching employees:', error)
    return NextResponse.json([], { status: 200 })
  }
}
