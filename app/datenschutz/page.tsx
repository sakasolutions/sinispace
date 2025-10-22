export default function DatenschutzPage() {
    return (
      <main className="min-h-screen flex flex-col items-center justify-start px-6 py-16 text-gray-900 dark:text-gray-100 bg-transparent">
        <div className="w-full max-w-3xl leading-relaxed">
          <h1 className="text-4xl font-bold mb-8 text-center">Datenschutzerklärung</h1>
          <p className="text-center mb-8 text-sm opacity-70">Stand: 29.08.2025</p>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">1. Verantwortlicher</h2>
            <p>
              <strong>Saka Solutions – IT & Sales</strong><br />
              Inhaber: Sinan Sakacilar<br />
              Esslinger Str. 15, 89537 Giengen an der Brenz, Deutschland<br />
              E-Mail: kontakt@saka-it.de · Tel.: +49 1522 6396063
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">2. Zwecke, Datenkategorien, Rechtsgrundlagen</h2>
            <p>
              <strong>Website-Bereitstellung / Server-Logs:</strong> IP-Adresse, Datum/Uhrzeit, User-Agent u. Ä.
              zur Auslieferung und IT-Sicherheit.<br />
              <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an stabiler, sicherer Website).
            </p>
            <p>
              <strong>Kontaktaufnahme (E-Mail, Telefon, Formular):</strong> Name, E-Mail, Nachricht,
              Betreff/Serviceauswahl – zur Bearbeitung & Beantwortung von Anfragen.<br />
              <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Kommunikation) bzw. lit. f DSGVO.
            </p>
            <p>
              <strong>Einwilligungs-Management (Cookies):</strong> Speicherung & Protokoll deiner Auswahl
              (Consent-ID, Zeitstempel).<br />
              <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. c DSGVO (Nachweispflicht) i. V. m. Art. 7 DSGVO
              und Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">3. Empfänger & Drittanbieter</h2>
            <ul className="list-disc ml-5 space-y-2">
              <li><strong>Hosting / Server:</strong> Netcup GmbH, Deutschland – Betrieb, Wartung, DDoS-Schutz, Logfiles.</li>
              <li><strong>E-Mail / Formulare:</strong> Mailersend (EU/Niederlande) – Versand & Weiterleitung von Formularinhalten.</li>
              <li><strong>Einwilligungs-Tool:</strong> Cookiebot by Usercentrics – Verwaltung & Dokumentation von Einwilligungen.</li>
              <li><strong>CDN / statische Inhalte:</strong> Font Awesome (cdnjs.cloudflare.com) & Flaticon CDN – Auslieferung von Icons und Grafiken.</li>
              <li><strong>Authentifizierung:</strong> Firebase Authentication (Google Ireland Ltd.) – Login/Logout, Session-Handling. Daten: E-Mail, Passwort (verschlüsselt).</li>
              <li><strong>Zahlungsabwicklung:</strong> Stripe Payments Europe Ltd. – Verarbeitung von Zahlungsdaten (Name, E-Mail, Zahlungs-ID, Rechnungsdetails).</li>
              <li><strong>KI-Dienste:</strong> OpenAI (ChatGPT API, USA) & Google Cloud (Gemini API, EU/USA) – Verarbeitung von Texteingaben, Chatinhalten zur KI-Antwortgenerierung.</li>
              <li><strong>Hosting der App:</strong> Netcup (Deutschland) – Speicherung der Anwendungsdaten, Logfiles, und Chatverläufe in deutschen Rechenzentren.</li>
              <li><strong>Social Media & Kommunikation:</strong> WhatsApp / Meta, Instagram, Facebook – Verarbeitung nach deren eigenen Datenschutzbestimmungen.</li>
            </ul>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">4. Drittlandübermittlungen</h2>
            <p>
              Bei Diensten von OpenAI, Stripe und Google kann eine Übermittlung in Drittländer
              (z. B. USA) erfolgen. Wir stützen uns hierbei auf EU-Standardvertragsklauseln gemäß
              Art. 44 ff. DSGVO. Informationen hierzu erhältst du auf Anfrage unter
              kontakt@saka-it.de.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">5. Speicherdauer</h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>Kontaktanfragen: bis Abschluss der Bearbeitung, max. 12 Monate</li>
              <li>Server-Logs: 7–14 Tage</li>
              <li>Chatverläufe (bei eingeloggten Nutzern): bis zur aktiven Löschung oder Kontolöschung</li>
              <li>Consent-Protokolle: gemäß gesetzlicher Nachweispflichten</li>
            </ul>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">6. Pflicht zur Bereitstellung</h2>
            <p>
              Die Angabe von Basisdaten (z. B. E-Mail-Adresse) ist zur Bearbeitung deiner Anfrage
              oder Nutzung des Dienstes erforderlich. Ohne diese Angaben ist eine Nutzung ggf. nicht möglich.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">7. Cookies & Einwilligungen</h2>
            <p>
              Diese Website verwendet Cookies zur technischen Bereitstellung und optional zur Analyse.
              Du kannst deine Auswahl jederzeit ändern:{" "}
              <a href="#" className="text-blue-500 dark:text-blue-400 hover:underline">
                Einwilligungen anpassen / widerrufen
              </a>.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">8. Sicherheit / Transportverschlüsselung</h2>
            <p>
              Unsere Website nutzt TLS/HTTPS zur sicheren Übertragung deiner Daten.
              Eine 100 %ige Sicherheit im Internet kann jedoch technisch nicht gewährleistet werden.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">9. Rechte der betroffenen Personen</h2>
            <p>
              Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit sowie Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f DSGVO.
              Zudem hast du ein Beschwerderecht bei der zuständigen Datenschutzaufsichtsbehörde.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">10. Detailinformationen zu einzelnen Diensten</h2>
  
            <h3 className="font-semibold mt-4">10.1 ChatGPT & Gemini APIs</h3>
            <p>
              Bei Nutzung der Chatfunktionen werden deine eingegebenen Texte an die APIs von OpenAI
              (ChatGPT) bzw. Google (Gemini) übermittelt, um eine KI-Antwort zu generieren.
              Die Datenverarbeitung erfolgt ausschließlich zur Bereitstellung der Chatfunktion.
              Chatverläufe werden gespeichert, um dir späteren Zugriff zu ermöglichen.
              <br />
              <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </p>
  
            <h3 className="font-semibold mt-4">10.2 Firebase Authentication</h3>
            <p>
              Zur Anmeldung wird der Dienst Firebase Authentication (Google Ireland Ltd.) verwendet.
              Es werden E-Mail-Adresse, Passwort (verschlüsselt) sowie Metadaten (Loginzeitpunkte) verarbeitet.
              <br />
              <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO.
            </p>
  
            <h3 className="font-semibold mt-4">10.3 Stripe (Zahlungsdienstleister)</h3>
            <p>
              Für kostenpflichtige Abonnements nutzen wir Stripe Payments Europe Ltd. (Irland).
              Stripe verarbeitet personenbezogene Daten zur Zahlungsabwicklung, wie Name, E-Mail,
              Rechnungsadresse und Zahlungsinformationen.
              <br />
              <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und lit. f DSGVO (sichere Zahlungsabwicklung).
            </p>
  
            <h3 className="font-semibold mt-4">10.4 Mailersend</h3>
            <p>
              Über unser Kontaktformular versendete Nachrichten werden durch Mailersend verarbeitet
              und an unsere geschäftliche E-Mail-Adresse weitergeleitet. Es kann eine Drittlandübermittlung
              stattfinden (s. Abschnitt 4).
            </p>
  
            <h3 className="font-semibold mt-4">10.5 Cookiebot</h3>
            <p>
              Cookiebot (Usercentrics A/S, Dänemark) dient zur Verwaltung deiner Cookie-Einwilligungen.
              Dabei werden IP-Adresse (gekürzt), Zeitstempel und Consent-ID verarbeitet.
            </p>
  
            <h3 className="font-semibold mt-4">10.6 Externe CDNs</h3>
            <p>
              Beim Laden von Font Awesome oder Flaticon werden aus technischen Gründen IP-Adressen an
              die jeweiligen CDNs übermittelt. Dies dient der schnellen, sicheren Auslieferung der Inhalte.
            </p>
  
            <h3 className="font-semibold mt-4">10.7 Social & WhatsApp</h3>
            <p>
              Unsere Social-Links sind reine Weiterleitungen. Beim Aufruf der Plattformen (Instagram, Facebook, WhatsApp)
              gelten deren jeweiligen Datenschutzbestimmungen.
            </p>
          </section>
  
          <div className="text-center mt-10">
            <a href="/" className="text-blue-500 dark:text-blue-400 hover:underline transition">
              ← Zurück zur Startseite
            </a>
          </div>
        </div>
      </main>
    );
  }
  