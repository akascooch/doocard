import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { serviceId } = params
    
    console.log(`🔍 [API Route] Fetching employees for service ${serviceId}...`)
    const response = await fetch(`${API_BASE_URL}/api/employees/by-service/${serviceId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    })

    console.log('📡 [API Route] Backend response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [API Route] Backend error:', response.status, errorText)
      throw new Error('Failed to fetch employees by service')
    }

    const data = await response.json()
    const employees = Array.isArray(data) ? data : []
    console.log('✅ [API Route] Employees loaded:', employees.length, 'items')
    return NextResponse.json(employees)
  } catch (error) {
    console.error('❌ [API Route] Error fetching employees by service:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees by service' },
      { status: 500 }
    )
  }
}
