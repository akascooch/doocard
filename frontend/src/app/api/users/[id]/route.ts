import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { id } = params

    const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    })

    if (!response.ok) {
      const err = await response.json().catch(async () => ({ message: await response.text().catch(() => 'Unknown error') }))
      return NextResponse.json(err, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { id } = params
    const body = await request.json()

    const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.json().catch(async () => ({ message: await response.text().catch(() => 'Unknown error') }))
      return NextResponse.json(err, { status: response.status })
    }

    const data = await response.json()
    // Ensure consistent response format
    if (data && typeof data === 'object' && !data.success) {
      return NextResponse.json({ success: true, data }, { status: 200 })
    }
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')
    const { id } = params

    const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    })

    if (!response.ok) {
      const err = await response.json().catch(async () => ({ message: await response.text().catch(() => 'Unknown error') }))
      return NextResponse.json(err, { status: response.status })
    }

    const data = await response.json().catch(() => ({ success: true, message: 'User deleted successfully' }))
    // Ensure consistent response format
    if (data && typeof data === 'object' && !data.success) {
      return NextResponse.json({ success: true, data }, { status: 200 })
    }
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}