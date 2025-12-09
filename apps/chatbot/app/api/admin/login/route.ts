import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // Not used here

export const runtime = 'nodejs'; // Or edge, cookies work in both // Or edge, cookies work in both

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (username !== 'admin' || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    // Set cookie
    const cookieMaxAge = 60 * 60; // 1 hour
    response.cookies.set('admin-token', 'valid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
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
  response.cookies.set('admin-token', '', { maxAge: 0 });
  return response;
}