// components/Features.tsx
"use client";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function Features() {
  const items = [
    { title: "Dual-KI-Zugriff", text: "Greife mit einem Abo auf ChatGPT & Gemini zu. Wechsle je nach Aufgabe das stärkere Modell.", icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h7v12H3zM14 6h7v12h-7z"/></svg>) },
    { title: "Kontext & Verlauf", text: "Projekte, Chat-Ordner, Suche. Finde alles schneller wieder als im Standard-UI.", icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h10M4 18h7"/></svg>) },
    { title: "Smarte Prompts", text: "Wiederverwendbare Prompt-Snippets, Variablen & Platzhalter. Team-Vorlagen inklusive.", icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v18M3 8h18M8 21l8-18"/></svg>) },
    { title: "Dateien & Bilder", text: "Anhänge reinziehen, analysieren lassen, zusammenfassen, konvertieren – direkt im Chat.", icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 3H6a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V7z"/></svg>) },
    { title: "Schnell & Sicher", text: "EU-freundliche Speicherung der Metadaten, 2FA-Login, verschlüsselte Verbindung.", icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l7 4v5c0 5-4 8-7 9-3-1-7-4-7-9V7z"/></svg>) },
    { title: "Teamfähig", text: "Sitzungen teilen, Rollenrechte, zentrale Abrechnung – optional, wenn ihr wachst.", icon: (<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm10 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 21a6 6 0 0 1 8-5.5M21 21a5 5 0 0 0-6-4.8"/></svg>) },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.h2 className="text-center text-3xl md:text-4xl font-semibold tracking-tight" initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once: true }} transition={{duration:.6}}>
          Alles, was du täglich brauchst – ohne Ballast
        </motion.h2>
        <motion.p className="mt-4 text-center text-zinc-600 max-w-2xl mx-auto" initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once: true }} transition={{duration:.6, delay:.05}}>
          Ein aufgeräumtes Interface, schnelle Workflows, starke Ergebnisse. Fokus auf Produktivität.
        </motion.p>

        <motion.div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {items.map((f) => (
            <motion.div key={f.title} variants={item} className="rounded-2xl border border-zinc-200 bg-white p-6 hover:shadow-lg transition-shadow">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
