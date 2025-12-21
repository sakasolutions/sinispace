// lib/auth-options.ts
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { getAdminAuth } from '@/lib/firebase-admin';
import { AuthOptions } from 'next-auth'; // Wichtig für Typsicherheit

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Firebase',
      credentials: {},
      async authorize(credentials: any) {
        const idToken = credentials.idToken;
        if (!idToken) return null;

        try {
          // Verwende die zentrale Firebase Admin Initialisierung
          const adminAuth = getAdminAuth();
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          console.log('✅ [NextAuth Authorize] Token verifiziert für E-Mail:', decodedToken.email);

          if (!decodedToken || !decodedToken.email) return null;

          // ===================================================================
          // HIER IST DIE KORREKTUR: Dynamische Erstellung der Daten
          // ===================================================================
          
          // Erstelle oder aktualisiere den User in der Datenbank
          const user = await prisma.user.upsert({
            where: { email: decodedToken.email },
            update: {
              name: decodedToken.name || undefined,
              image: decodedToken.picture || undefined,
            },
            create: {
              email: decodedToken.email,
              name: decodedToken.name || undefined,
              image: decodedToken.picture || undefined,
            },
          });
          
          return user;
        } catch (error) {
          console.error("🔥 Firebase ID Token Verifizierungs-Fehler:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session?.user) session.user.id = token.id;
      return session;
    },
  },
};