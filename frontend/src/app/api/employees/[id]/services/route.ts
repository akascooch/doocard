import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { id } = params
    
    const response = await fetch(`${API_BASE_URL}/api/employees/${id}/services`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch employee services')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching employee services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee services' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { id } = params
    const body = await request.json()
    
    const response = await fetch(`${API_BASE_URL}/api/employees/${id}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error('Failed to assign services to employee')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error assigning services to employee:', error)
    return NextResponse.json(
      { error: 'Failed to assign services to employee' },
      { status: 500 }
    )
  }
}
