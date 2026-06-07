import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const { date } = params
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const response = await fetch(`${API_BASE_URL}/api/day-closing/${date}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to close day')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error closing day:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close day' },
      { status: 500 }
    )
  }
}
