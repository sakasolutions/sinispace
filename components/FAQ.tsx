// components/FAQ.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";

type QA = { q: string; a: React.ReactNode };

export default function FAQ() {
  const faqs: QA[] = [
    {
      q: "Wie funktioniert der Zugriff auf ChatGPT & Gemini?",
      a: (
        <>
          Sinispace verbindet sich über <strong>offizielle APIs</strong> von OpenAI (ChatGPT) und Google
          (Gemini). Du wählst pro Chat das Modell; die Anfrage (Prompt + optional Datei-/Bildinhalte)
          wird <strong>verschlüsselt</strong> an den jeweiligen Anbieter gesendet und die Antwort in
          Sinispace angezeigt. Es findet <strong>kein Scraping</strong> und kein inoffizieller Zugriff statt.
        </>
      ),
    },
    {
      q: "Welche Daten verarbeitet Sinispace und wofür (DSGVO)?",
      a: (
        <>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Accountdaten</strong> (E-Mail, Hash-Passwort, Plan-Status): zur Vertragserfüllung
              (Art. 6 Abs. 1 lit. b DSGVO).
            </li>
            <li>
              <strong>Chat-Metadaten</strong> (Titel, Zeitstempel, Ordner): zur Bereitstellung des
              Dienstes (Art. 6 Abs. 1 lit. b).
            </li>
            <li>
              <strong>Chat-Inhalte</strong> (Text/Dateien/Bilder): nur zur gewünschten Verarbeitung
              über die gewählten Modelle; Speicherung bei uns minimal & zweckgebunden (Art. 6 Abs. 1 lit. b).
            </li>
            <li>
              <strong>Abrechnungsdaten</strong> (bei Stripe): zur Zahlungsabwicklung (Art. 6 Abs. 1 lit. b und f).
            </li>
          </ul>
        </>
      ),
    },
    {
      q: "Wo werden Daten gespeichert?",
      a: (
        <>
          Account- und App-Daten speichern wir in unserer EU-konformen Infrastruktur (z. B. Firebase/Cloud
          in EU-Regionen, sofern verfügbar). Bei der Nutzung der Modelle werden die eingegebenen Inhalte
          <strong>an OpenAI oder Google</strong> übermittelt (je nach Auswahl). Die Verarbeitung kann – je nach
          Anbieter – auch <strong>außerhalb der EU</strong> erfolgen. Wir wählen die Standard-Datenschutzoptionen
          der Anbieter (z. B. kein Training mit Kundendaten, wenn verfügbar).
        </>
      ),
    },
    {
      q: "Wer sind die Empfänger (Auftragsverarbeiter/Sub-Prozessoren)?",
      a: (
        <>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>OpenAI</strong> – Verarbeitung deiner Chat-Inhalte, wenn ChatGPT gewählt wird.
            </li>
            <li>
              <strong>Google</strong> – Verarbeitung deiner Inhalte, wenn Gemini gewählt wird.
            </li>
            <li>
              <strong>Stripe</strong> – Zahlungsabwicklung (keine Verarbeitung von Chat-Inhalten).
            </li>
            <li>
              <strong>Hosting/Cloud</strong> – Betrieb der Anwendung (App, Datenbank, Logs).
            </li>
          </ul>
          Mit allen Anbietern arbeiten wir auf Basis der jeweiligen <strong>Auftragsverarbeitungsbedingungen</strong>.
        </>
      ),
    },
    {
      q: "Werden meine Inhalte zum Training der Modelle genutzt?",
      a: (
        <>
          <p>
            Wir aktivieren standardmäßig <strong>keine</strong> Trainingsfreigabe für eingegebene Inhalte,
            sofern der jeweilige Anbieter eine solche Option bietet. Unser Ziel ist,
            <strong>keine Modellschulung mit Kundendaten</strong> zu erlauben. Beachte: Anbieter können je nach
            Konto-/API-Plan eigene Voreinstellungen haben. Wir halten unsere Einstellungen datenschutzfreundlich
            und informieren bei Änderungen.
          </p>
        </>
      ),
    },
    {
      q: "Wie lange werden Daten gespeichert (Aufbewahrung & Löschung)?",
      a: (
        <>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Chats/Dateien</strong>: du kannst sie jederzeit in der App löschen. Gelöschte Inhalte
              werden aus der produktiven Datenbank entfernt; Backups werden turnusmäßig überschrieben.
            </li>
            <li>
              <strong>Accounts</strong>: werden auf Anfrage gelöscht (inkl. personenbezogener Daten, soweit
              keine gesetzlichen Pflichten entgegenstehen).
            </li>
            <li>
              <strong>Rechnungsdaten</strong>: gesetzliche Aufbewahrungspflichten (z. B. HGB/AO) bleiben unberührt.
            </li>
          </ul>
        </>
      ),
    },
    {
      q: "Sind meine Daten verschlüsselt und wie ist die Sicherheit?",
      a: (
        <>
          Ja. Daten werden <strong>in Transit (TLS)</strong> verschlüsselt übertragen. Server- und Datenbank-
          Zugriffe sind rollenbasiert beschränkt, Logins unterstützen sichere Passwörter und optional 2FA
          (wenn aktiviert). API-Schlüssel werden sicher verwaltet. Wir setzen auf <strong>Security-Best-Practices</strong>
          und minimieren gespeicherte Inhalte.
        </>
      ),
    },
    {
      q: "Welche Rechte habe ich nach DSGVO?",
      a: (
        <>
          <p>
            Du hast u. a. das Recht auf <strong>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit</strong>
            sowie Widerspruch gegen Verarbeitungen, soweit anwendbar. Melde dich per E-Mail an{" "}
            <Link href="mailto:hello@sinispace.app" className="underline">
              hello@sinispace.app
            </Link>
            . Wir reagieren zeitnah.
          </p>
        </>
      ),
    },
    {
      q: "Kann ich die Verarbeitung einschränken oder nur lokal halten?",
      a: (
        <>
          <p>
            Da Sinispace bewusst die <strong>Stärken externer Modelle</strong> nutzt, ist eine Verarbeitung bei
            OpenAI/Google notwendig, wenn du ein Modell auswählst. Du kannst entscheiden, <strong>wann</strong> und
            <strong>welche Inhalte</strong> du sendest (z. B. sensible Daten vor dem Senden entfernen/anon).
          </p>
        </>
      ),
    },
    {
      q: "Wie läuft die Zahlung & Rechnung (bis 250 €)?",
      a: (
        <>
          <p>
            Zahlung über <strong>Stripe</strong> oder <strong>Banküberweisung</strong>. Du erhältst eine
            Kleinbetragsrechnung i. S. d. § 33 UStDV per E-Mail. Bei Überweisung senden wir dir die Bankdaten
            manuell zu; nach Zahlungseingang folgt die Freischaltung.
          </p>
        </>
      ),
    },
    {
      q: "Ich habe weitere Fragen oder ein Datenbegehren.",
      a: (
        <>
          <p>
            Schreib uns jederzeit an{" "}
            <Link href="mailto:hello@sinispace.app" className="underline">
              hello@sinispace.app
            </Link>
            . Wir helfen schnell weiter.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Hinweis: Diese Hinweise ersetzen keine Rechtsberatung. Wir halten unsere Prozesse und Texte aktuell,
            passen sie aber ggf. an geänderte Anforderungen oder Anbieterbedingungen an.
          </p>
        </>
      ),
    },
  ];

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="mx-auto max-w-3xl px-6">
        <motion.h2
          className="text-center text-3xl md:text-4xl font-semibold tracking-tight"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          FAQ & Datenschutz
        </motion.h2>

        <motion.div
          className="mt-10 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.05 }}
        >
          {faqs.map((f) => (
            <details key={f.q} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="text-sm font-medium">{f.q}</span>
                <span className="text-zinc-400 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <motion.div
                className="mt-3 text-sm text-zinc-600 space-y-2"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                {f.a}
              </motion.div>
            </details>
          ))}
        </motion.div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Stand: {new Date().toLocaleDateString("de-DE")}
        </p>
      </div>
    </section>
  );
}
