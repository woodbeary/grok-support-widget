import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Buffer } from 'buffer';

export function middleware(request: NextRequest) {
  // Protect /admin and /api/admin paths
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/api/admin')) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      response.headers.set('WWW-Authenticate', 'Basic realm="Admin Area"');
      return response;
    }

    const credentials = authHeader.split(' ')[1]; // Remove 'Basic '
    if (!credentials) {
      const response = NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
      response.headers.set('WWW-Authenticate', 'Basic realm="Admin Area"');
      return response;
    }

    try {
      const decoded = Buffer.from(credentials, 'base64').toString('ascii');
      const [username, password] = decoded.split(':');
      if (username !== 'admin' || password !== process.env.ADMIN_PASSWORD) {
        console.log('Admin auth failed for user:', username);
        const response = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        response.headers.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return response;
      }
    } catch (error) {
      console.error('Auth decode error:', error);
      const response = NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
      response.headers.set('WWW-Authenticate', 'Basic realm="Admin Area"');
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