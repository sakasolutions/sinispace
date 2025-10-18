// context/AuthContext.tsx (oder wo auch immer deine Datei liegt)
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// WICHTIG: 'Auth' importiert, um es im Typ zu verwenden
import { getAuth, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

// 1. TYP ERWEITERT
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  auth: Auth; // <-- NEU: Für Passwort-Reset
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>; // <-- NEU
}

const authInstance = getAuth(app);

// 2. STANDARDWERT ERWEITERT
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  auth: authInstance,
  fetchWithAuth: async () => new Response(JSON.stringify({ error: 'Auth not initialized' }), { status: 500 }),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = authInstance;
  const router = useRouter();

  useEffect(() => {
    // Diese Funktion behebt das "Lade Account..."-Problem
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      // Die alte Logik mit /api/auth/sessions wurde entfernt, 
      // da wir jetzt das Token direkt senden.
    });
    return () => unsubscribe();
  }, [auth]);

  const signOut = async () => {
    await auth.signOut();
    // Du kannst den Nutzer auch per window.location.replace('/login') dorthin zwingen
    router.push('/login');
  };

  // 3. NEUE FUNKTION: fetchWithAuth
  // Dieser Wrapper hängt das Token an jede API-Anfrage an
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Nicht angemeldet. fetchWithAuth fehlgeschlagen.');
    }

    const token = await currentUser.getIdToken();

    // Headers-Objekt erstellen (entweder neu oder von 'options' übernehmen)
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json'); // Standard setzen

    return fetch(url, {
      ...options,
      headers,
    });
  };


  // 4. WERT-OBJEKT ERWEITERT
  const value = { user, loading, signOut, auth, fetchWithAuth };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);