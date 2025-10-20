// components/Header.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// --- NEU: Icon-Komponenten für das Burger-Menü ---
// Wir definieren sie hier direkt, damit du nichts importieren musst.
const BurgerIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 12h16m-8 6h8"
    />
  </svg>
);

const CloseIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
// --- Ende Icon-Komponenten ---

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // <-- NEU: State für mobiles Menü

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // --- GEÄNDERT: Wrapper ---
  // Der Hintergrund wird jetzt auch aktiv, wenn das Menü offen ist,
  // damit die Links auf transparentem Grund lesbar sind.
  const wrapper =
    "sticky top-0 z-50 transition-all border-b " +
    (scrolled || isMenuOpen // <-- GEÄNDERT: Logik erweitert
      ? "backdrop-blur bg-white/80 border-zinc-200"
      : "bg-transparent border-transparent");

  const linkBase =
    "text-sm transition-colors " +
    (scrolled ? "text-zinc-700 hover:text-black" : "text-white/90 hover:text-white");

  const ctaBase =
    "text-sm px-4 py-2 rounded-lg font-medium transition-opacity " +
    (scrolled
      ? "bg-black text-white hover:opacity-90"
      : "bg-white/10 text-white hover:bg-white/15");

  // --- NEU: Styling für mobile Menü-Links ---
  // Diese Links sind immer dunkel, da das Menü immer einen Hintergrund hat.
  const mobileLinkBase =
    "block py-3 text-base font-medium text-zinc-700 hover:text-black hover:bg-zinc-100 px-4 rounded-md transition-colors";

  // --- NEU: Styling für den mobilen Haupt-CTA ---
  const mobileCtaBase =
    "block w-full text-center text-base py-3 px-4 font-medium rounded-md bg-black text-white hover:opacity-90 transition-opacity";

  // --- NEU: Handler zum Schließen des Menüs bei Klick ---
  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className={wrapper}>
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        {/* --- Logo (unverändert) --- */}
        <Link
          href="/"
          onClick={closeMenu} // <-- NEU: Schließt Menü bei Klick aufs Logo
          className={(scrolled || isMenuOpen ? "text-zinc-900" : "text-white") + " text-xl font-semibold tracking-tight"}
        >
          <span
            className={
              "inline-block rounded-md px-2 py-1 mr-2 text-xs " +
              (scrolled || isMenuOpen ? "bg-black text-white" : "bg-white text-black") // <-- GEÄNDERT: Passt sich auch an Menü-State an
            }
          >
            S
          </span>
          Sinispace
        </Link>

        {/* --- Desktop-Navigation (unverändert) --- */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className={linkBase}>Features</a>
          <a href="#integrations" className={linkBase}>Integrationen</a>
          <a href="#pricing" className={linkBase}>Preis</a>
          <a href="#faq" className={linkBase}>FAQ</a>
        </nav>

        {/* --- Desktop-CTAs (unverändert) --- */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className={linkBase + " px-3 py-2 rounded-md " + (scrolled ? "hover:bg-zinc-100" : "hover:bg-white/10")}>
            Login
          </Link>
          <Link href="/payment" className={ctaBase}>
            Kostenlos starten
          </Link>
        </div>

        {/* --- NEU: Burger-Menü-Button --- */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)} // <-- NEU: Toggle-Funktion
            aria-label="Mobiles Menü öffnen"
            className={"p-2 rounded-md transition-colors " + 
              (scrolled || isMenuOpen ? "text-black hover:bg-zinc-100" : "text-white hover:bg-white/10")
            }
          >
            {isMenuOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <BurgerIcon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* --- ENTFERNT: Alter mobiler CTA --- */}
        {/* Der "€99/Jahr" Button ist nun im mobilen Menü enthalten. */}
      </div>

      {/* --- NEU: Mobiles Menü (Dropdown) --- */}
      <div
        className={
          " md:hidden " + // Nur auf Mobile sichtbar
          (isMenuOpen ? "block" : "hidden") // Wird durch State ein- und ausgeblendet
        }
      >
        <div className="px-4 pt-2 pb-4 space-y-2">
          {/* Mobile Links */}
          <a href="#features" className={mobileLinkBase} onClick={closeMenu}>Features</a>
          <a href="#integrations" className={mobileLinkBase} onClick={closeMenu}>Integrationen</a>
          <a href="#pricing" className={mobileLinkBase} onClick={closeMenu}>Preis</a>
          <a href="#faq" className={mobileLinkBase} onClick={closeMenu}>FAQ</a>
          
          {/* Divider und mobile CTAs */}
          <div className="border-t border-zinc-200 pt-4 mt-4 space-y-3">
            <Link href="/login" className={mobileLinkBase} onClick={closeMenu}>
              Login
            </Link>
            <Link href="/payment" className={mobileCtaBase} onClick={closeMenu}>
              Kostenlos starten
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}