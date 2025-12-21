// app/api/debug/auth/route.ts
// Debug-Route zum Testen der Firebase Admin Initialisierung
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      hasGcpSaB64: !!process.env.GCP_SA_B64,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL,
    },
    firebaseAdmin: {
      initialized: false,
      error: null,
    },
    database: {
      connected: false,
      error: null,
    },
  };

  // Test Firebase Admin
  try {
    const { getAdminAuth } = await import('@/lib/firebase-admin');
    const adminAuth = getAdminAuth();
    checks.firebaseAdmin.initialized = true;
    checks.firebaseAdmin.authAvailable = !!adminAuth;
  } catch (error: any) {
    checks.firebaseAdmin.error = {
      message: error.message,
      stack: error.stack,
    };
  }

  // Test Database
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$connect();
    checks.database.connected = true;
    await prisma.$disconnect();
  } catch (error: any) {
    checks.database.error = {
      message: error.message,
      stack: error.stack,
    };
  }

  return NextResponse.json(checks, { status: 200 });
}

