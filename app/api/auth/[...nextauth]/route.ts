// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

// Firebase Admin SDK initialisieren
const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
const fileContents = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(fileContents);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Firebase',
      credentials: {},
      async authorize(credentials: any) {
        const idToken = credentials.idToken;
        if (!idToken) return null;

        try {
          const decodedToken = await getAuth().verifyIdToken(idToken);
          
          // ===================================================================
          // DAS IST DIE NEUE ZEILE FÜR UNSEREN TEST
          console.log('✅ [NextAuth Authorize] Token verifiziert für E-Mail:', decodedToken.email);
          // ===================================================================

          if (!decodedToken || !decodedToken.email) return null;

          const user = await prisma.user.upsert({
            where: { email: decodedToken.email },
            update: { name: decodedToken.name, image: decodedToken.picture },
            create: {
              email: decodedToken.email,
              name: decodedToken.name,
              image: decodedToken.picture,
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };