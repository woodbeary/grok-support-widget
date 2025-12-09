import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect /api/admin paths - let /admin page show its own login form
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('admin-token')?.value;

    // Check cookie for authentication
    if (token !== 'valid') {
      // Return 401 without WWW-Authenticate header (no browser dialog)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/:path*'  // Only protect API routes, not the admin page
  ]
};