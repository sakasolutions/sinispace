// components/Header.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const wrapper =
    "sticky top-0 z-50 transition-all border-b " +
    (scrolled
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

  return (
    <header className={wrapper}>
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className={(scrolled ? "text-zinc-900" : "text-white") + " text-xl font-semibold tracking-tight"}
        >
          <span
            className={
              "inline-block rounded-md px-2 py-1 mr-2 text-xs " +
              (scrolled ? "bg-black text-white" : "bg-white text-black")
            }
          >
            S
          </span>
          Sinispace
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className={linkBase}>Features</a>
          <a href="#integrations" className={linkBase}>Integrationen</a>
          <a href="#pricing" className={linkBase}>Preis</a>
          <a href="#faq" className={linkBase}>FAQ</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className={linkBase + " px-3 py-2 rounded-md " + (scrolled ? "hover:bg-zinc-100" : "hover:bg-white/10")}>
            Login
          </Link>
          <Link href="/payment" className={ctaBase}>
            Kostenlos starten
          </Link>
        </div>

        <a href="#pricing" className={"md:hidden px-3 py-2 rounded-lg " + (scrolled ? "bg-black text-white" : "bg-white/15 text-white")}>
          €99/Jahr
        </a>
      </div>
    </header>
  );
}
