// app/api/auth/sessions/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // dynamischer Import -> verhindert Top-Level-Init im Edge-Bundle
    const { getAdminAuth } = await import('@/lib/firebase-admin');
    const adminAuth = getAdminAuth();

    const { idToken } = await request.json();
    if (!idToken) return new NextResponse('Missing idToken', { status: 400 });

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 Tage
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn / 1000, // Next erwartet Sekunden
      path: '/',
      sameSite: 'lax',
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session creation failed:', error);
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
