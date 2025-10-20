// lib/auth.ts
import { prisma } from './prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options'; // <-- Korrekter Import
import { User } from '@prisma/client';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getPrismaUserFromSession(): Promise<User> {
  // ... (dein Code hier) ...
  const session = await getSession();
  if (!session?.user?.id) throw new Error('Nicht autorisiert');
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error('User nicht gefunden');
  return user;
}

// Der Alias für die alten Stripe-Routen
export const ensureUser = getPrismaUserFromSession;