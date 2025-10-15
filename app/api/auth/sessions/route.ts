// DER GENERALSCHLÜSSEL. DIE LETZTE ZEILE CODE, DIE DU ÄNDERN WIRST.
export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const adminAuth = getAdminAuth();
    
    const { idToken } = await request.json();
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
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