import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; serviceId: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { id, serviceId } = params
    
    const response = await fetch(`${API_BASE_URL}/api/employees/${id}/services/${serviceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    })

    if (!response.ok) {
      throw new Error('Failed to remove service from employee')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error removing service from employee:', error)
    return NextResponse.json(
      { error: 'Failed to remove service from employee' },
      { status: 500 }
    )
  }
}
