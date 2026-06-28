import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API Route] Fetching public services from backend...')
    console.log('🔗 [API Route] Backend URL:', `${API_BASE_URL}/api/services/public`)
    
    const response = await fetch(`${API_BASE_URL}/api/services/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for development
    })

    console.log('📡 [API Route] Backend response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [API Route] Backend error:', response.status, errorText)
      throw new Error('Failed to fetch public services')
    }

    const data = await response.json()
    console.log('🔍 [API Route] Raw data received:', data)
    console.log('🔍 [API Route] Data is array?', Array.isArray(data))
    console.log('🔍 [API Route] Data type:', typeof data)
    
    const services = Array.isArray(data) ? data : []
    console.log('✅ [API Route] Services to return:', services.length, 'items')
    
    if (services.length > 0) {
      console.log('📋 [API Route] First service:', services[0].name)
    }
    
    return NextResponse.json(services)
  } catch (error: any) {
    console.error('❌ [API Route] Error fetching public services:', error.message)
    console.error('❌ [API Route] Stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to fetch public services' },
      { status: 500 }
    )
  }
}
