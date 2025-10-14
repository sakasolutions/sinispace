// app/settings/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type SubscriptionInfo =
  | { hasSubscription: false; reason?: string; emailUsed?: string }
  | {
      hasSubscription: true;
      status: string;
      currentPeriodEnd: string | Date;
      cancelAtPeriodEnd: boolean;
      emailUsed?: string;
    }
  | { error: string };

const PAYMENT_LINK_BASE = 'https://buy.stripe.com/6oU6oI6vW2jLfrudeJawo04';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const authedEmail = (user?.email ?? '').trim();

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const paymentLink = useMemo(() => {
    if (!PAYMENT_LINK_BASE) return '';
    const url = new URL(PAYMENT_LINK_BASE);
    if (authedEmail) url.searchParams.set('prefilled_email', authedEmail);
    return url.toString();
  }, [authedEmail]);

  useEffect(() => {
    if (!authedEmail) return;
    void checkRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedEmail]);

  async function checkRuntime() {
    if (!authedEmail) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/subscription?email=${encodeURIComponent(authedEmail)}`, { cache: 'no-store' });
      const d = await r.json();
      setInfo(d);
    } catch {
      setErr('Abo-Status konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const daysLeft = useMemo(() => {
    if (!info || !('hasSubscription' in info) || !info.hasSubscription) return null;
    const end = new Date(info.currentPeriodEnd);
    const ms = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [info]);

  async function openPortal() {
    setBusy(true);
    try {
      const r = await fetch('/api/stripe/customer-portal', { method: 'POST' });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else alert(d.error || 'Kundenportal konnte nicht geöffnet werden.');
    } catch {
      alert('Kundenportal konnte nicht geöffnet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include', // <- Safari braucht das oft
      });
      await signOut?.(); // dein AuthContext / Firebase etc.
    } catch (e) {
      console.error('Logout-Fehler', e);
    } finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
        // @ts-ignore – optional für Firebase
        indexedDB?.deleteDatabase?.('firebaseLocalStorageDb');
      } catch {}
      // Voller Reload verhindert stale Seiten/Redirects
      window.location.replace('/login?logged_out=1');
    }
  }
  
  
  

  return (
    <main className="relative isolate min-h-[100dvh] text-white bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.15),transparent),linear-gradient(180deg,#0b1120_0%,#0b1120_50%,#0e1322_100%)]">
      <header className="sticky top-0 z-10 h-12 sm:h-14 flex items-center border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5">
        <div className="mx-auto max-w-3xl w-full px-3 sm:px-6 flex items-center gap-2">
          <Link href="/chat" className="rounded-md border border-white/15 px-2 py-1 hover:bg-white/10">← Zurück</Link>
          <h1 className="ml-2 text-sm sm:text-base font-semibold">Einstellungen</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 space-y-6">
        <section className="rounded-xl border border-white/15 bg-white/5 p-4">
          <h2 className="text-base font-medium mb-3">Abo-Status</h2>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1">
              <label className="block text-xs text-white/60 mb-1">Rechnungs-E-Mail</label>
              <input
                value={authedEmail || ''}
                readOnly
                disabled
                className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 cursor-not-allowed"
              />
            </div>
            <button
              onClick={checkRuntime}
              disabled={!authedEmail || loading}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? 'Prüfe…' : 'Laufzeit prüfen'}
            </button>
          </div>

          <div className="mt-4">
            {err && <p className="text-red-400 text-sm">{err}</p>}

            {!err && info && 'error' in info && (
              <p className="text-red-400 text-sm">{info.error}</p>
            )}

            {!err && info && !('error' in info) && (
              info.hasSubscription ? (
                <div className="text-sm text-white/80">
                  Status: <span className="font-medium">{info.status}</span><br />
                  Laufzeit bis{' '}
                  {info.currentPeriodEnd
                    ? new Date(info.currentPeriodEnd).toLocaleDateString()
                    : '—'}
                  {typeof daysLeft === 'number' && (
                    <> &nbsp;•&nbsp; <span className="text-white/70">{daysLeft} Tag{daysLeft === 1 ? '' : 'e'} übrig</span></>
                  )}
                  {info.cancelAtPeriodEnd && (
                    <p className="text-xs text-yellow-400 mt-1">
                      Das Abo endet automatisch am Laufzeitende.
                    </p>
                  )}
                  <div className="mt-3">
                    <button
                      onClick={openPortal}
                      disabled={busy}
                      className="border border-white/15 bg-white/5 px-3 py-2 rounded hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      Abo verwalten (Kundenportal)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/80">
                  Kein aktives Abo gefunden.
                  <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                    <button
                      onClick={() => window.open(paymentLink, '_blank')}
                      className="border border-white/15 bg-white text-black px-4 py-2 rounded hover:opacity-90 text-sm"
                    >
                      Abo abschließen (1 Jahr)
                    </button>
                    {authedEmail && (
                      <div className="text-xs text-white/60">
                        Tipp: Der Payment Link wird mit <span className="text-white/80 font-medium">{authedEmail}</span> vorbefüllt.
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section className="rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
          <h2 className="text-base font-medium">Account</h2>
          <p className="text-sm text-white/70">
            E-Mail (Login): <span className="font-medium">{authedEmail || '—'}</span>
          </p>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutBusy}
            className="mt-2 w-full sm:w-auto border border-white/15 bg-red-600/80 hover:bg-red-600 px-4 py-2 rounded text-sm font-medium disabled:opacity-60"
          >
            {logoutBusy ? 'Logout…' : 'Logout'}
          </button>
        </section>
      </div>
    </main>
  );
}
