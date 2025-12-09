import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Buffer } from 'buffer';

export function middleware(request: NextRequest) {
  // Protect /admin and /api/admin paths
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/api/admin')) {
    const authHeader = request.headers.get('authorization');
    const token = request.cookies.get('admin-token')?.value;

    let isAuthenticated = false;

    // Check cookie
    if (token === 'valid') {
      isAuthenticated = true;
    }

    // Or check basic auth header
    if (!isAuthenticated && authHeader?.startsWith('Basic ')) {
      const credentials = authHeader.split(' ')[1];
      try {
        const decoded = Buffer.from(credentials, 'base64').toString('ascii');
        const [username, password] = decoded.split(':');
        if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
          isAuthenticated = true;
        }
      } catch (error) {
        console.error('Auth decode error:', error);
      }
    }

    if (!isAuthenticated) {
      console.log('Admin access denied for path:', request.nextUrl.pathname);
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      response.headers.set('WWW-Authenticate', 'Basic realm="Admin Area"'); // Still support basic for curl/etc
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*'
  ]
};