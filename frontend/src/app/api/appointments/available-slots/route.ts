import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = 'http://localhost:3001'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const employeeId = searchParams.get('employeeId')
    
    if (!date || !employeeId) {
      return NextResponse.json(
        { error: 'Date and employeeId are required' },
        { status: 400 }
      )
    }
    
    const response = await fetch(`${API_BASE_URL}/api/appointments/slots?date=${date}&employeeId=${employeeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching available slots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available slots' },
      { status: 500 }
    )
  }
}