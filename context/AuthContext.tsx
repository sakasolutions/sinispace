"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

// 1. KORREKTUR: "logout" zu "signOut" im Typ umbenannt
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>; 
}

// 2. KORREKTUR: "logout" zu "signOut" im Standardwert umbenannt
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        await fetch('/api/auth/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } else {
        await fetch('/api/auth/sessions', { method: 'DELETE' });
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // 3. KORREKTUR: Die Funktion selbst umbenannt
  const signOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  // 4. KORREKTUR: Die Eigenschaft im Wert-Objekt umbenannt
  const value = { user, loading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);