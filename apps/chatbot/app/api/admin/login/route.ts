import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminToken, passwordMatches } from '@/lib/admin-session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // No default password: the dashboard stays locked until one is configured
    return NextResponse.json({ error: 'Admin is disabled. Set ADMIN_PASSWORD to enable it.' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (typeof password !== 'string' || !(await passwordMatches(password, adminPassword))) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = await createAdminToken();
    if (!token) {
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });

    // Signed, expiring session cookie
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ADMIN_SESSION_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE() {
  // Logout
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
