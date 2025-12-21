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
        if (!idToken) {
          console.error("❌ [NextAuth] Kein ID Token erhalten");
          return null;
        }

        try {
          // Verwende die zentrale Firebase Admin Initialisierung
          console.log("🔍 [NextAuth] Initialisiere Firebase Admin...");
          const adminAuth = getAdminAuth();
          
          console.log("🔍 [NextAuth] Verifiziere ID Token...");
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          console.log('✅ [NextAuth] Token verifiziert für E-Mail:', decodedToken.email);

          if (!decodedToken || !decodedToken.email) {
            console.error("❌ [NextAuth] Token enthält keine E-Mail");
            return null;
          }

          // Erstelle oder aktualisiere den User in der Datenbank
          console.log("🔍 [NextAuth] Erstelle/Aktualisiere User in Datenbank...");
          
          // Versuche zuerst, den User zu finden
          let user = await prisma.user.findUnique({
            where: { email: decodedToken.email },
          });

          if (user) {
            // User existiert, aktualisiere nur wenn Felder vorhanden sind
            const updateData: any = {};
            if (decodedToken.name) updateData.name = decodedToken.name;
            if (decodedToken.picture) updateData.image = decodedToken.picture;
            
            if (Object.keys(updateData).length > 0) {
              user = await prisma.user.update({
                where: { email: decodedToken.email },
                data: updateData,
              });
            }
          } else {
            // User existiert nicht, erstelle neuen
            const createData: any = { email: decodedToken.email };
            if (decodedToken.name) createData.name = decodedToken.name;
            if (decodedToken.picture) createData.image = decodedToken.picture;
            
            user = await prisma.user.create({
              data: createData,
            });
          }
          
          console.log("✅ [NextAuth] User erfolgreich erstellt/aktualisiert:", user.id);
          return user;
        } catch (error: any) {
          console.error("🔥 [NextAuth] FEHLER in authorize:");
          console.error("Fehler-Typ:", error?.constructor?.name);
          console.error("Fehler-Message:", error?.message);
          console.error("Fehler-Stack:", error?.stack);
          
          // Spezifische Fehlerbehandlung
          if (error?.message?.includes("GCP_SA_B64")) {
            console.error("❌ Firebase Admin Credentials fehlen (GCP_SA_B64)");
          } else if (error?.message?.includes("verifyIdToken")) {
            console.error("❌ Token-Verifizierung fehlgeschlagen");
          } else if (error?.code === "P2002") {
            console.error("❌ Datenbank-Constraint-Fehler (E-Mail bereits vorhanden)");
          } else if (error?.code?.startsWith("P")) {
            console.error("❌ Prisma-Fehler:", error.code);
          }
          
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