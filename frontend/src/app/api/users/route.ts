import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')
    
    const response = await fetch(`${API_BASE_URL}/api/users`, {
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
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')
    const raw = await request.json()
    // Map UI fields to backend DTO
    const body = {
      name: raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim(),
      phone: raw.phone || raw.phoneNumber,
      email: raw.email ?? undefined,
      password: raw.password,
      role: raw.role,
      specialty: raw.specialty,
      baseSalary: raw.baseSalary,
      commissionRate: raw.commissionRate ?? (raw.salaryPercentage !== undefined ? Number(raw.salaryPercentage) : undefined),
      birthdate: raw.birthdate,
      notes: raw.notes,
    }
    
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
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
      return NextResponse.json({ success: true, data }, { status: 201 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
