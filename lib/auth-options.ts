// lib/auth-options.ts
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';
import { AuthOptions } from 'next-auth'; // Wichtig für Typsicherheit

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Firebase',
      credentials: {},
      async authorize(credentials: any) {
        
        // ===================================================================
        // FIREBASE-INITIALISIERUNG (Server-sicher)
        // ===================================================================
        if (!getApps().length) {
          const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
          const fileContents = fs.readFileSync(serviceAccountPath, 'utf8');
          const serviceAccount = JSON.parse(fileContents);
          initializeApp({
            credential: cert(serviceAccount),
          });
        }
        
        const idToken = credentials.idToken;
        if (!idToken) return null;

        try {
          const decodedToken = await getAuth().verifyIdToken(idToken);
          console.log('✅ [NextAuth Authorize] Token verifiziert für E-Mail:', decodedToken.email);

          if (!decodedToken || !decodedToken.email) return null;

          // ===================================================================
          // HIER IST DIE KORREKTUR: Dynamische Erstellung der Daten
          // ===================================================================
          
          // 1. Definiere die Daten, die in JEDEM Fall erstellt werden
          const createData: { email: string; name?: string; image?: string } = {
            email: decodedToken.email,
          };

          // 2. Definiere die Daten, die in JEDEM Fall aktualisiert werden
          const updateData: { name?: string; image?: string } = {};

          // 3. Füge 'name' und 'image' nur hinzu, wenn sie existieren
          if (decodedToken.name) {
            createData.name = decodedToken.name;
            updateData.name = decodedToken.name;
          }
          if (decodedToken.picture) {
            createData.image = decodedToken.picture;
            updateData.image = decodedToken.picture;
          }

          const user = await prisma.user.upsert({
            where: { email: decodedToken.email },
            update: updateData, // <-- Nutzt das sichere updateData-Objekt
            create: createData, // <-- Nutzt das sichere createData-Objekt
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