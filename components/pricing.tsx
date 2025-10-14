// components/Pricing.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: .45 } },
};

export default function Pricing() {
  const benefits = [
    "Zugriff auf ChatGPT & Gemini über offizielle APIs",
    "Faire Nutzung ohne künstliche Limits (gemäß API-Kontingent)",
    "Datei-Upload & Bild-Analyse zur Kontextverarbeitung",
    "Schnelle, werbefreie Benutzeroberfläche",
    "Direkter Support per Mail",
    "Laufende Verbesserungen & neue Features",
  ];

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.h2 className="text-center text-3xl md:text-4xl font-semibold tracking-tight"
          initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once: true }} transition={{duration:.6}}>
          Klarer Preis. Volle Leistung.
        </motion.h2>
        <motion.p className="mt-3 text-center text-zinc-600" initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once: true }} transition={{duration:.6, delay:.05}}>
          Ein Plan – transparent, fair und flexibel. 14 Tage Geld-zurück-Garantie.
        </motion.p>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 md:grid-cols-3 gap-6">
          <motion.ul className="md:col-span-2 grid sm:grid-cols-2 gap-4"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
            transition={{ staggerChildren: 0.06 }}
          >
            {benefits.map((text) => (
              <motion.li key={text} variants={listItem} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-white text-xs">✓</span>
                <span className="text-sm">{text}</span>
              </motion.li>
            ))}
          </motion.ul>

          <motion.div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]"
            initial={{ opacity: 0, scale: .96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: .5, delay: .1 }}>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Pro</div>
            <div className="mt-2 flex items-end gap-1">
              <div className="text-4xl font-semibold">€99</div>
              <div className="text-zinc-500 mb-1">/ Jahr</div>
            </div>
            <p className="mt-2 text-sm text-zinc-600">Entspricht ca. €8,25 / Monat</p>

            <Link href="/payment" className="mt-6 block w-full rounded-lg bg-black px-6 py-3 text-center text-white font-medium hover:opacity-90">
              Jetzt sichern
            </Link>
            <p className="mt-3 text-xs text-zinc-500 text-center">14 Tage Geld-zurück-Garantie.</p>
          </motion.div>
        </div>

        <motion.p className="mt-10 text-center text-xs text-zinc-500 max-w-2xl mx-auto"
          initial={{opacity:0}} whileInView={{opacity:1}} viewport={{ once: true }} transition={{ duration: .6 }}>
          Hinweis: API-basierte Nutzung kann je nach Modell und Abfragevolumen kostenabhängig begrenzt werden…
        </motion.p>
      </div>
    </section>
  );
}
