// next-auth.d.ts

import 'next-auth';
import { DefaultSession } from 'next-auth';

// Wir erweitern das 'next-auth'-Modul
declare module 'next-auth' {

  /**
   * Erweitert das Standard-Session-Objekt.
   * Jetzt weiß TypeScript, dass 'session.user.id' existiert.
   */
  interface Session {
    user?: {
      id: string; // Das fügen wir hinzu
    } & DefaultSession['user']; // Das erbt name, email, image
  }

  /**
   * Erweitert das Standard-User-Objekt (gute Praxis).
   */
  interface User {
    id: string;
  }
}

// Wir erweitern auch das 'jwt'-Modul, da wir die ID im Token speichern
declare module 'next-auth/jwt' {
  /**
   * Erweitert den JWT-Typ.
   */
  interface JWT {
    id: string;
  }
}