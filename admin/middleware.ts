import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (process.env.ALLOW_DEV_ACCESS === 'true') {
    return NextResponse.next()
  }

  const token = request.headers.get('cf-access-jwt-assertion')

  if (!token) {
    return new NextResponse('Unauthorized – Cloudflare Access token missing', { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
