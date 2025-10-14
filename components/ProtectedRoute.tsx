"use client";

import React, { useEffect } from 'react'; // KORREKTUR: useEffect hier importiert
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wenn das Laden abgeschlossen ist und kein Benutzer da ist, weiterleiten.
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Während des Ladens oder wenn der Benutzer (noch) nicht da ist, zeige einen Ladebildschirm.
  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b1120] text-white">
        <p>Authentifizierung wird geprüft...</p>
      </div>
    );
  }

  // Wenn alles gut ist, zeige die geschützte Seite an.
  return <>{children}</>;
};

export default ProtectedRoute;