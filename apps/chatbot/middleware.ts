import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-session';

export async function middleware(request: NextRequest) {
  // Only protect /api/admin paths - let /admin page show its own login form
  // Exclude /api/admin/login from protection so users can actually log in
  if (request.nextUrl.pathname.startsWith('/api/admin') && !request.nextUrl.pathname.startsWith('/api/admin/login')) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;

    // The cookie must carry a valid, unexpired signature (see lib/admin-session.ts)
    if (!(await verifyAdminToken(token))) {
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
