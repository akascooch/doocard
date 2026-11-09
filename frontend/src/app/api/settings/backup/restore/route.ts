import { NextRequest, NextResponse } from 'next/server'
import { getBackendOrigin } from '@/lib/backend-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Self-hosted / Vercel ceiling for long offline restores (~2–3+ minutes typical). */
export const maxDuration = 900

const UPSTREAM_TIMEOUT_MS = 900_000
/** Align with Nest MaxFileSizeValidator / settings UI (F-RST-06 server-side). */
const MAX_BACKUP_PROXY_BYTES = 300 * 1024 * 1024

/**
 * Dedicated streaming/buffering proxy for backup restore.
 * Next.js catch-all rewrites time out (~120s) on large multipart restores;
 * this App Router handler takes precedence over rewrites and keeps the
 * browser on same-origin `/api/...` (CSP connect-src 'self').
 */
export async function POST(request: NextRequest) {
  const upstreamUrl = `${getBackendOrigin()}/api/settings/backup/restore`

  try {
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        {
          status: 400,
          message: 'Content-Type باید multipart/form-data باشد',
          message_fa: 'Content-Type باید multipart/form-data باشد',
        },
        { status: 400 },
      )
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_BACKUP_PROXY_BYTES) {
      return NextResponse.json(
        {
          status: 413,
          message: 'حجم فایل پشتیبان بیش از حد مجاز است (۳۰۰ مگابایت)',
          message_fa: 'حجم فایل پشتیبان بیش از حد مجاز است (۳۰۰ مگابایت)',
        },
        { status: 413 },
      )
    }

    // Buffer once so Windows/undici does not require duplex streaming quirks.
    // ~150MB offline backups are acceptable for this dedicated path.
    const body = Buffer.from(await request.arrayBuffer())
    if (!body.length) {
      return NextResponse.json(
        {
          status: 400,
          message: 'بدنه درخواست خالی است',
          message_fa: 'بدنه درخواست خالی است',
        },
        { status: 400 },
      )
    }
    if (body.length > MAX_BACKUP_PROXY_BYTES) {
      return NextResponse.json(
        {
          status: 413,
          message: 'حجم فایل پشتیبان بیش از حد مجاز است (۳۰۰ مگابایت)',
          message_fa: 'حجم فایل پشتیبان بیش از حد مجاز است (۳۰۰ مگابایت)',
        },
        { status: 413 },
      )
    }

    const headers = new Headers()
    headers.set('content-type', contentType)
    const authorization = request.headers.get('authorization')
    if (authorization) headers.set('authorization', authorization)
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    const requestId = request.headers.get('x-request-id')
    if (requestId) headers.set('x-request-id', requestId)
    const correlationId = request.headers.get('x-correlation-id')
    if (correlationId) headers.set('x-correlation-id', correlationId)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    let upstream: Response
    try {
      upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        cache: 'no-store',
      })
    } finally {
      clearTimeout(timer)
    }

    const responseHeaders = new Headers()
    const passthrough = ['content-type', 'x-correlation-id', 'x-request-id']
    for (const key of passthrough) {
      const value = upstream.headers.get(key)
      if (value) responseHeaders.set(key, value)
    }

    const responseBody = Buffer.from(await upstream.arrayBuffer())
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error: any) {
    const aborted = error?.name === 'AbortError'
    console.error('[API Route] POST /api/settings/backup/restore proxy failed:', error)
    return NextResponse.json(
      {
        status: aborted ? 504 : 502,
        message: aborted
          ? 'زمان پروکسی بازیابی به پایان رسید'
          : 'خطا در پروکسی بازیابی پشتیبان',
        message_fa: aborted
          ? 'زمان پروکسی بازیابی به پایان رسید'
          : 'خطا در پروکسی بازیابی پشتیبان',
      },
      { status: aborted ? 504 : 502 },
    )
  }
}
