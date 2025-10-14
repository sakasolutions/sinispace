// app/api/auth/session/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 Tage
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn,
      path: '/',
    });
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}

export async function DELETE() {
  cookies().delete('session');
  return NextResponse.json({ status: 'success' });
}