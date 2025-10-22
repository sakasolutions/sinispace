export default function AGBPage() {
    return (
      <main className="min-h-screen flex flex-col items-center justify-start px-6 py-16 text-gray-900 dark:text-gray-100 bg-transparent">
        <div className="w-full max-w-3xl leading-relaxed">
          <h1 className="text-4xl font-bold mb-8 text-center">Allgemeine Geschäftsbedingungen (AGB)</h1>
          <p className="text-center mb-8 text-sm opacity-70">Stand: 29.08.2025</p>
  
          <p className="mb-6 text-center">
            <strong>Saka Solutions – IT & Sales</strong> · Inhaber: Sinan Sakacilar<br />
            Esslinger Str. 15, 89537 Giengen an der Brenz
          </p>
  
          <section className="space-y-4 mb-10">
            <h2 className="text-xl font-semibold">1. Geltungsbereich</h2>
            <p>
              Diese AGB gelten für alle Angebote, Lieferungen und Leistungen von Saka Solutions
              gegenüber Verbrauchern (§ 13 BGB) und Unternehmern (§ 14 BGB), einschließlich digitaler
              Dienste wie <strong>SiniSpace</strong>. Abweichende Bedingungen des Kunden gelten nur,
              wenn sie ausdrücklich in Textform bestätigt wurden.
            </p>
  
            <h2 className="text-xl font-semibold">2. Vertragsabschluss</h2>
            <p>
              Ein Vertrag kommt durch Annahme eines individuellen Angebots oder durch Registrierung
              bzw. Abschluss eines Abonnements über Stripe zustande. Mit Anlage eines Benutzerkontos
              erklärt der Nutzer die Annahme dieser AGB und der Datenschutzerklärung.
            </p>
  
            <h2 className="text-xl font-semibold">3. Leistungen & Mitwirkungspflichten</h2>
            <p>
              Leistungsarten: Web- und Softwareentwicklung, IT-Support, digitale Tools
              (z.&nbsp;B. SiniSpace), Beratung und Hosting. Der Kunde stellt notwendige Inhalte und
              Zugänge vollständig bereit. Bei Werkleistungen erfolgt eine Abnahme; Mängel sind binnen
              7 Tagen zu melden. SiniSpace verwendet KI-Schnittstellen von OpenAI und Google Gemini.
              Die Verantwortung für die Nutzung und Bewertung der Ergebnisse liegt beim Nutzer.
            </p>
  
            <h2 className="text-xl font-semibold">4. Digitale Dienste (SiniSpace / KI-Funktionen)</h2>
            <p>
              Die durch KI generierten Inhalte (ChatGPT / Gemini) erfolgen automatisiert. Eine Haftung
              für deren Richtigkeit, Vollständigkeit oder rechtliche Zulässigkeit ist ausgeschlossen,
              soweit gesetzlich zulässig. Chatverläufe werden gespeichert, um Nutzern Verlauf und
              Wiederherstellung zu ermöglichen. Der Nutzer verpflichtet sich, keine rechtswidrigen
              Inhalte einzugeben oder zu verbreiten.
            </p>
  
            <h2 className="text-xl font-semibold">5. Preise / Zahlung / Abonnements</h2>
            <p>
              Preise verstehen sich inkl. gesetzlicher USt. (sofern anwendbar). Zahlungen erfolgen
              über Stripe Payments Europe Ltd. (Irland). Abonnements verlängern sich automatisch, wenn
              sie nicht fristgerecht gekündigt werden. Der Zugang bleibt bis zum Ende der bezahlten
              Laufzeit bestehen.
            </p>
  
            <h2 className="text-xl font-semibold">6. Nutzungsrechte & Urheberrecht</h2>
            <p>
              Alle Leistungen bleiben bis zur vollständigen Zahlung Eigentum von Saka Solutions. Nach
              Zahlung erhält der Kunde ein einfaches, nicht übertragbares Nutzungsrecht. KI-generierte
              Inhalte dürfen privat und geschäftlich verwendet, jedoch nicht als eigene KI-Leistung
              weiterverkauft werden. Saka Solutions darf Projekte als Referenzen nennen, sofern kein
              Widerspruch erfolgt.
            </p>
  
            <h2 className="text-xl font-semibold">7. Drittanbieter & Hosting</h2>
            <p>
              Für Hosting und Infrastruktur werden Dienste wie Netcup (Deutschland), Firebase (Auth),
              OpenAI / Google Gemini (KI), Stripe (Zahlungen), Mailersend (E-Mail) und Cookiebot
              (Einwilligungen) eingesetzt. Die Datenverarbeitung erfolgt DSGVO-konform. Saka Solutions
              haftet nicht für Ausfälle oder Datenverluste dieser Drittanbieter, sofern kein Vorsatz
              oder grobe Fahrlässigkeit vorliegt.
            </p>
  
            <h2 className="text-xl font-semibold">8. Haftung</h2>
            <p>
              Saka Solutions haftet nur für Vorsatz und grobe Fahrlässigkeit. Bei leichter Fahrlässigkeit
              nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und beschränkt auf
              den typischen, vorhersehbaren Schaden. Keine Haftung besteht für Datenverluste ohne
              Backup, entgangenen Gewinn oder fehlerhafte KI-Ausgaben. Bei Diensten Dritter (OpenAI,
              Google, Stripe usw.) wird keine Haftung für deren Verfügbarkeit übernommen.
            </p>
  
            <h2 className="text-xl font-semibold">9. Gewährleistung</h2>
            <p>
              Es gelten die gesetzlichen Gewährleistungsrechte. Für Browser- oder Geräteabweichungen
              sowie Fremdänderungen übernimmt Saka Solutions keine Gewähr.
            </p>
  
            <h2 className="text-xl font-semibold">10. Widerruf / Kündigung digitaler Leistungen</h2>
            <p>
              Verbrauchern steht ein 14-tägiges Widerrufsrecht zu. Dieses erlischt bei vollständig
              erbrachten digitalen Leistungen (z.&nbsp;B. SiniSpace-Zugang), wenn der Nutzer zuvor
              zugestimmt und Kenntnis vom Erlöschen bestätigt hat. Abos können jederzeit zum Ende des
              Abrechnungszeitraums über das Stripe-Kundenportal oder schriftlich gekündigt werden.
            </p>
  
            <h2 className="text-xl font-semibold">11. Datenschutz / DSGVO</h2>
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt gemäß der{" "}
              <a href="/datenschutz" className="text-blue-500 dark:text-blue-400 hover:underline">
                Datenschutzerklärung
              </a>
              . Verantwortlicher i.S.d. DSGVO ist Sinan Sakacilar. Es werden geeignete technische und
              organisatorische Maßnahmen (TOMs) zum Schutz der Daten getroffen.
            </p>
  
            <h2 className="text-xl font-semibold">12. Gerichtsstand / Schlussbestimmungen</h2>
            <p>
              Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Erfüllungsort und Gerichtsstand
              ist, soweit zulässig, Giengen an der Brenz. Sollte eine Bestimmung dieser AGB unwirksam
              sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.
            </p>
          </section>
  
          <div className="text-center mt-10">
            <a
              href="/"
              className="text-blue-500 dark:text-blue-400 hover:underline transition"
            >
              ← Zurück zur Startseite
            </a>
          </div>
        </div>
      </main>
    );
  }
  