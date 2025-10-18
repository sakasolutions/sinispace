// app/settings/page.tsx (Finale Version)
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext'; // <-- BENUTZT WIEDER DEN CONTEXT
import { sendPasswordResetEmail } from 'firebase/auth'; 

/**
 * Typ für Firestore-Daten
 */
type UserSubData = {
  subscriptionEnd?: string;
  email: string;
} | { error: string };


export default function SettingsPage() {
  
  // --- Benutzt jetzt wieder den Context ---
  const { user, signOut, loading: authLoading, auth, fetchWithAuth } = useAuth();
  const authedEmail = (user?.email ?? '').trim();

  // --- States (unverändert) ---
  const [data, setData] = useState<UserSubData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  
  const [feedbackMsg, setFeedbackMsg] = useState('');

  
  async function handleCheckRuntime() {
    if (!authedEmail) {
      setErr('E-Mail noch nicht geladen.');
      return;
    }
    
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      // Benutzt die fetchWithAuth-Funktion aus dem Context
      const r = await fetchWithAuth(`/api/user-data`, { cache: 'no-store' }); 

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Abo-Daten konnten nicht geladen werden');
      setData(d);
    } catch (e: any) {
      setErr(e.message ?? 'Abo-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }


  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await signOut?.(); // Benutzt signOut aus dem Context
    } catch (e) {
      console.error('Logout-Fehler', e);
      setLogoutBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!auth || !authedEmail) { // Benutzt auth aus dem Context
      setFeedbackMsg('Fehler: E-Mail des Nutzers noch nicht geladen.');
      return;
    }
    setPasswordBusy(true);
    setFeedbackMsg('');
    try {
      await sendPasswordResetEmail(auth, authedEmail);
      setFeedbackMsg('E-Mail zum Zurücksetzen gesendet an: ' + authedEmail);
    } catch (error: any) {
      console.error('Passwort-Reset-Fehler', error);
      setFeedbackMsg('Fehler: ' + error.message);
    } finally {
      setPasswordBusy(false);
    }
  }
  
  async function handleDeleteAccount() {
    if (confirm('Bist du sicher, dass du deinen Account unwiderruflich löschen willst?\n\nAlle deine Chats und Abo-Daten gehen verloren.')) {
      setDeleteBusy(true);
      setFeedbackMsg('Account-Löschung wird implementiert...');
      // TODO: Später /api/delete-account mit fetchWithAuth aufrufen
      setTimeout(() => {
         setDeleteBusy(false);
         setFeedbackMsg('Fehler: Lösch-Funktion noch nicht verbunden.');
      }, 2000);
    }
  }

  const mailtoLink = useMemo(() => {
    if (!authedEmail) return '#';
    const subject = `Kündigung SiniSpace Abo: ${authedEmail}`;
    const body = `Hallo SiniSpace-Team,\n\hiermit möchte ich mein Abo zum nächstmöglichen Zeitpunkt kündigen.\n\nMeine Account-E-Mail lautet: ${authedEmail}\n\nBitte bestätigt mir die Kündigung.\n\nDanke.`;
    return `mailto:hello@sinispace.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [authedEmail]);
  

  // Seite rendert sofort
  return (
    <main className="relative isolate min-h-[100dvh] text-white bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.15),transparent),linear-gradient(180deg,#0b1120_0%,#0b1120_50%,#0e1322_100%)]">
      <header className="sticky top-0 z-10 h-12 sm:h-14 flex items-center border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
        <div className="mx-auto max-w-3xl w-full px-3 sm:px-6 flex items-center gap-2">
          <Link href="/chat" className="rounded-md border border-white/15 px-2 py-1 hover:bg-white/10">← Zurück</Link>
          <h1 className="ml-2 text-sm sm:text-base font-semibold">Einstellungen</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 space-y-6">
        
        {/* SEKTION 1: ACCOUNT & ABO */}
        <section className="rounded-xl border border-white/15 bg-white/5 p-4">
          <h2 className="text-base font-medium mb-3">Mein Account & Abo</h2>
          
          <div className="space-y-2">
            <p className="text-sm text-white/70">
              E-Mail (Login): 
              {authLoading ? (
                <span className="ml-2 text-white/50">Lade...</span>
              ) : (
                <span className="font-medium text-white/90"> {authedEmail || 'Nicht angemeldet'}</span>
              )}
            </p>
            
            <div className="pt-2">
              <button
                onClick={handleCheckRuntime}
                disabled={authLoading || loading || !authedEmail}
                className="inline-block border border-white/15 bg-white/5 px-4 py-2 rounded text-sm text-center hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? 'Prüfe Abo...' : 'Abo-Status prüfen'}
              </button>
            </div>

            {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
            
            {data && !('error' in data) && (
              data.subscriptionEnd && new Date(data.subscriptionEnd) > new Date() ? (
                <p className="text-sm text-white/70 mt-3">
                  Abo-Status: <span className="font-medium text-green-400">Aktiv</span>
                  <span className="text-white/60"> (Gültig bis: {new Date(data.subscriptionEnd).toLocaleDateString()})</span>
                </p>
              ) : (
                <p className="text-sm text-white/70 mt-3">
                  Abo-Status: <span className="font-medium text-yellow-400">Kein aktives Abo</span>
                </p>
              )
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3">
             <a
              href={mailtoLink}
              aria-disabled={!authedEmail}
              onClick={(e) => !authedEmail && e.preventDefault()}
              className={(!authedEmail ? 'opacity-50 cursor-not-allowed' : '') + " inline-block border border-white/15 bg-white/5 px-4 py-2 rounded text-sm text-center hover:bg-white/10"}
            >
              Abo kündigen
            </a>
          </div>
        </section>

        {/* SEKTION 2: SICHERHEIT */}
        <section className="rounded-xl border border-white/15 bg-white/5 p-4">
          <h2 className="text-base font-medium mb-3">Sicherheit</h2>
          <p className="text-sm text-white/70 mb-4">
            Du erhältst eine E-Mail mit einem Link, um dein Passwort zurückzusetzen.
          </p> 
          <button
            onClick={handlePasswordReset}
            disabled={passwordBusy || authLoading || !authedEmail}
            className="inline-block border border-white/15 bg-white/5 px-4 py-2 rounded text-sm text-center hover:bg-white/10 disabled:opacity-50"
          >
            {passwordBusy ? 'Sende...' : 'Passwort zurücksetzen'}
          </button>
          
          {feedbackMsg && (
            <p className="text-sm text-white/80 mt-3">{feedbackMsg}</p>
          )}
        </section>

        {/* SEKTION 3: GEFAHRZONE & RECHTLICHES */}
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <h2 className="text-base font-medium text-red-300 mb-3">Gefahrzone</h2>
          <p className="text-sm text-white/70 mb-4">
            Das Löschen deines Accounts ist endgültig und kann nicht rückgängig gemacht werden.
            Alle deine Chats und Abo-Daten werden gelöscht.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteBusy || authLoading || !authedEmail}
            className="inline-block border border-red-400/30 bg-red-500/20 px-4 py-2 rounded text-sm text-red-300 text-center hover:bg-red-500/30 disabled:opacity-50"
          >
            {deleteBusy ? 'Lösche...' : 'Account endgültig löschen'}
          </button>

          <div className="mt-5 pt-4 border-t border-white/10 text-xs text-white/60 flex gap-4">
            <Link href="/impressum" target="_blank" className="underline hover:text-white">Impressum</Link>
            <Link href="/datenschutz" target="_blank" className="underline hover:text-white">Datenschutz</Link>
          </div>
        </section>

      </div>
    </main>
  );
}
