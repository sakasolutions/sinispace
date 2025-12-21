// app/login/page.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app as firebaseApp } from "@/lib/firebase";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { status, update: updateSession } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/chat");
    }
  }, [status, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 1) Firebase Login
      const auth = getAuth(firebaseApp);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // 2) Firebase ID Token holen
      const idToken = await userCredential.user.getIdToken();

      // 3) NextAuth Credentials-Provider mit ID Token
      const result = await signIn("credentials", { 
        idToken, 
        redirect: false,
        callbackUrl: "/chat"
      });
      
      if (result?.error) {
        throw new Error(result.error);
      }

      if (!result?.ok) {
        throw new Error("Server-Login fehlgeschlagen");
      }

      // 4) Session explizit aktualisieren und auf Authentifizierung warten
      await updateSession();
      
      // 5) Weiterleitung - useEffect wird die Session-Änderung erkennen
      router.push("/chat");
      router.refresh(); // Seite neu laden, um Session zu aktualisieren
    } catch (err: any) {
      console.error("Login Fehler:", err);
      let errorMessage = "E-Mail oder Passwort ist falsch. Bitte versuche es erneut.";
      
      // Spezifischere Fehlermeldungen
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        errorMessage = "E-Mail oder Passwort ist falsch.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Ungültige E-Mail-Adresse.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Zu viele fehlgeschlagene Versuche. Bitte versuche es später erneut.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  }

  if (status === "loading") return null;

  return (
    <main className="relative isolate min-h-[100svh] overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.25),transparent),linear-gradient(180deg,#0b1120_0%,#0b1120_50%,#0e1322_100%)]" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between text-white/80">
          <Link href="/" className="hover:underline">&larr; Zurück</Link>
          <Link href="/payment" className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/15 border border-white/20">
            Noch keinen Zugang? <span className="underline">€99/Jahr</span>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <section className="text-white">
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">Willkommen zurück.</h1>
            <p className="mt-4 text-white/80 max-w-lg">
              Logge dich ein und nutze <span className="font-medium">ChatGPT &amp; Gemini</span> in einer klaren, schnellen Oberfläche.
            </p>
            <div className="mt-8 grid gap-3 max-w-md">
              {["Dual-KI: ChatGPT & Gemini","Ordner, Verlauf & Suche","Datei-Upload & Bild-Analyse"].map(t => (
                <div key={t} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-black text-xs">✓</span>
                  <span className="text-sm text-white/90">{t}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:ml-auto w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]">
              <h2 className="text-xl font-medium text-zinc-900">Login</h2>
              <p className="mt-1 text-sm text-zinc-600">Zugangsdaten hast du per E-Mail erhalten.</p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm text-zinc-700 mb-1">E-Mail</label>
                  <input id="email" type="email" required placeholder="max@example.com"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-400"
                    autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm text-zinc-700 mb-1">Passwort</label>
                  <div className="relative">
                    <input id="password" type={showPw ? "text" : "password"} required placeholder="••••••••"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-12 outline-none focus:border-zinc-400"
                      autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} />
                    <button type="button" onClick={()=>setShowPw(v=>!v)}
                      className="absolute inset-y-0 right-0 px-3 text-sm text-zinc-500 hover:text-zinc-700"
                      aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}>
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-zinc-600">
                    <input type="checkbox" className="rounded border-zinc-300" />
                    Eingeloggt bleiben
                  </label>
                  <a href="#" className="text-sm text-zinc-700 hover:underline">Passwort vergessen?</a>
                </div>

                {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-black text-white font-medium px-4 py-2 hover:opacity-90 disabled:bg-zinc-800 disabled:cursor-not-allowed">
                  {loading ? "Logge ein..." : "Einloggen"}
                </button>

                <p className="text-xs text-zinc-500">
                  Noch kein Konto? <Link href="/payment" className="underline hover:text-zinc-700">Zugang jetzt sichern (€99/Jahr)</Link>
                </p>
              </form>
            </div>

            <p className="mt-4 text-xs text-white/60">
              Mit dem Login akzeptierst du unsere <Link href="/agb" className="underline">AGB</Link> und <Link href="/datenschutz" className="underline">Datenschutz</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
