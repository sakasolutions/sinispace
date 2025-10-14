// lib/auth.ts
import { prisma } from './prisma';

/**
 * Hier später echte Auth (NextAuth/Clerk/etc.)
 * Für jetzt: Demo-User basierend auf .env oder Fallback.
 */
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? 'demo@example.com';

export async function getCurrentUser() {
  // In Produktion: aus Session lesen
  return { email: DEMO_EMAIL };
}

/** Erstellt den User falls nicht vorhanden und gibt ihn zurück. */
export async function ensureUser() {
  const { email } = await getCurrentUser();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  return user;
}
