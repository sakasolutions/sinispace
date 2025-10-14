// components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="font-medium">Sinispace</div>
            <p className="mt-3 text-zinc-600">
              Eine klare Oberfläche für die stärksten KI-Modelle. ChatGPT & Gemini – vereint.
            </p>
          </div>
          <div>
            <div className="font-medium">Produkt</div>
            <ul className="mt-3 space-y-2 text-zinc-600">
              <li><a href="#features" className="hover:text-black">Features</a></li>
              <li><a href="#integrations" className="hover:text-black">Integrationen</a></li>
              <li><a href="#pricing" className="hover:text-black">Preis</a></li>
            </ul>
          </div>
          <div>
            <div className="font-medium">Rechtliches</div>
            <ul className="mt-3 space-y-2 text-zinc-600">
              <li><Link href="/impressum" className="hover:text-black">Impressum</Link></li>
              <li><Link href="/datenschutz" className="hover:text-black">Datenschutz</Link></li>
              <li><Link href="/agb" className="hover:text-black">AGB</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-medium">Kontakt</div>
            <ul className="mt-3 space-y-2 text-zinc-600">
              <li><a href="mailto:hello@sinispace.app" className="hover:text-black">hello@sinispace.app</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} Sinispace. Alle Rechte vorbehalten.</p>
          <p>Made for creators & teams.</p>
        </div>
      </div>
    </footer>
  );
}
