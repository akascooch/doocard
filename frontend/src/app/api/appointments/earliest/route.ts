import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = 'http://localhost:3001'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const serviceId = searchParams.get('serviceId')

    if (!employeeId || !serviceId) {
      return NextResponse.json(
        { error: 'employeeId and serviceId are required' },
        { status: 400 }
      )
    }

    const url = `${API_BASE_URL}/api/appointments/earliest?employeeId=${employeeId}&serviceId=${serviceId}`
    const response = await fetch(url, { method: 'GET' })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return NextResponse.json(data, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching earliest slot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch earliest slot' },
      { status: 500 }
    )
  }
}
