// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const runtime = 'nodejs'; // Wichtig für Firebase Admin

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };