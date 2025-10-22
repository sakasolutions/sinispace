export default function ImpressumPage() {
    return (
      <main className="min-h-screen flex flex-col items-center justify-start px-6 py-16 text-gray-900 dark:text-gray-100 bg-transparent">
        <div className="w-full max-w-2xl leading-relaxed">
          <h1 className="text-4xl font-bold mb-8 text-center">Impressum</h1>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">Angaben gemäß § 5 TMG</h2>
            <p>
              <strong>Saka Solutions – IT & Sales</strong><br />
              Inhaber: Sinan Sakacilar<br />
              Esslinger Str. 15<br />
              89537 Giengen an der Brenz<br />
              Deutschland
            </p>
            <p>
              <strong>Telefon:</strong> +49 1522 6396063<br />
              <strong>E-Mail:</strong> kontakt@saka-it.de
            </p>
            <p>
              <strong>Umsatzsteuer-ID:</strong> DE456172594
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">Verantwortlich i. S. d. § 18 Abs. 2 MStV</h2>
            <p>
              Sinan Sakacilar<br />
              Esslinger Str. 15<br />
              89537 Giengen an der Brenz
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">Haftung für Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den
              allgemeinen Gesetzen verantwortlich. Wir übernehmen keine Gewähr für die
              Vollständigkeit, Richtigkeit und Aktualität der bereitgestellten Informationen.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">Haftung für Links</h2>
            <p>
              Unsere Seiten enthalten Links zu externen Websites, auf deren Inhalte wir keinen
              Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
              Anbieter oder Betreiber verantwortlich.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">Urheberrecht</h2>
            <p>
              Alle Inhalte dieser Website (Texte, Bilder, Grafiken, Layouts) unterliegen dem
              deutschen Urheberrecht. Jede Verwertung außerhalb der Grenzen des Urheberrechts
              bedarf der Zustimmung des Rechteinhabers. Marken und Logos Dritter sind Eigentum
              der jeweiligen Rechteinhaber.
            </p>
          </section>
  
          <section className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold">Online-Streitbeilegung & Verbraucherschlichtung</h2>
            <p>
              Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor
              einer Verbraucherschlichtungsstelle teilzunehmen.
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
  