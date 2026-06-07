import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const percentage = searchParams.get('percentage')

    const params = new URLSearchParams()
    if (employeeId) params.set('employeeId', employeeId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (percentage) params.set('percentage', percentage)

    const url = `${API_BASE_URL}/api/admin/employee-salary/preview?${params.toString()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching employee salary preview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee salary preview' },
      { status: 500 }
    )
  }
}
