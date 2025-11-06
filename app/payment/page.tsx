// app/payment/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/bJe3cw3jKcYpenq7Upawo06";
const OWNER_EMAIL = "kontakt@sinispace.app"; // <-- deine Empfangsadresse

export default function PaymentPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // mailto-Link für Banküberweisung
  const mailtoHref = useMemo(() => {
    const subject = `Sinispace Bestellung (Banküberweisung) – €99/Jahr`;
    const body = [
      "Hallo Sinispace Team,",
      "",
      "ich möchte den Pro-Plan (€99,90/Jahr) per Banküberweisung bestellen.",
      "",
      `Name: ${name || "—"}`,
      `E-Mail: ${email || "—"}`,
      "",
      "Bitte sendet mir die Bankdaten und reserviert mir den Zugang. Danke!",
      "",
      "— automatisch vorbefüllt von sinispace.app —",
    ].join("\n");

    return `mailto:${encodeURIComponent(OWNER_EMAIL)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [name, email]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Zurück zur Startseite
      </Link>

      <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
        Bezahlen & Zugang erhalten
      </h1>
      <p className="mt-2 text-zinc-600">
        Du bekommst deine Zugangsdaten und die Rechnung per E-Mail. Aktuell erfolgt die Freischaltung manuell (meist innerhalb weniger Stunden).
      </p>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stripe-Card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium">Schnell bezahlen mit Stripe</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Kreditkarte, Apple Pay, Google Pay. Nach Zahlung erhältst du zeitnah Zugangsdaten + Rechnung per E-Mail.
          </p>

          <a
            href={STRIPE_CHECKOUT_URL}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-black px-5 py-3 text-white font-medium hover:opacity-90"
          >
            Jetzt mit Stripe bezahlen – €99,90/Jahr
          </a>

          <p className="mt-3 text-xs text-zinc-500">
            Hinweis: Der Checkout öffnet in einem neuen Tab. Bei Fragen antworte einfach auf die Bestätigungs-Mail.
          </p>
        </section>

        {/* Banküberweisung-Card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium">Per Banküberweisung bestellen</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Formular ausfüllen → Es öffnet sich eine vorbefüllte E-Mail an uns. Du erhältst die Bankdaten und nach Zahlung Zugang + Rechnung.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Öffnet das Standard-Mailprogramm
              window.location.href = mailtoHref;
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-400"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-400"
                placeholder="max@example.com"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-5 py-3 font-medium hover:bg-zinc-50"
            >
              Email versenden
            </button>

            <p className="text-xs text-zinc-500">
              Tipp: Falls kein Mailprogramm geöffnet wird, kannst du uns auch direkt an{" "}
              <a className="underline hover:text-zinc-800" href={`mailto:${OWNER_EMAIL}`}>
                {OWNER_EMAIL}
              </a>{" "}
              schreiben – bitte mit Name & E-Mail.
            </p>
          </form>
        </section>
      </div>

      {/* Recht & Transparenz */}
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-xs text-zinc-500">
          Hinweis: Die Nutzung erfolgt über offizielle APIs von OpenAI und Google (Gemini). Es gelten faire
          Nutzungsgrenzen gemäß Kontingent. Rechnungen bis 250 € als Kleinbetragsrechnung i.S.d. §33 UStDV.
          Bei Banküberweisung beginnen wir mit der Bearbeitung nach Eingang deiner E-Mail.
        </p>
      </div>
    </main>
  );
}
