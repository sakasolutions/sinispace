// lib/auth.ts
import { prisma } from './prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { User } from '@prisma/client';

/**
 * Holt die aktuelle NextAuth-Session.
 * DIES IST DIE QUELLE ALLEN ÜBELS. Wir rufen sie jetzt direkt in der API-Route auf.
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Holt den eingeloggten Prisma-User-Datensatz basierend auf der Session.
 * Wirft einen Fehler, wenn niemand eingeloggt ist.
 */
export async function getPrismaUserFromSession(): Promise<User> {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new Error('Nicht autorisiert: Keine Session gefunden');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    throw new Error('Nicht autorisiert: User nicht in DB gefunden');
  }

  return user;
}