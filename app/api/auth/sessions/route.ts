export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
// Wir importieren jetzt die FUNKTION, nicht das Objekt
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // Der Elektriker holt sich das Werkzeug erst jetzt!
    const adminAuth = getAdminAuth();
    
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
    console.error("Session creation failed:", error);
    return new NextResponse('Unauthorized', { status: 401 });
  }
}