// components/CTA.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function CTA() {
  return (
    <motion.section
      className="relative isolate py-24 text-center text-white overflow-hidden"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: .6 }}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#0c1222_0%,#0b1120_50%,#0a101c_100%),radial-gradient(50%_80%_at_50%_-10%,rgba(99,102,241,0.3),transparent)]"
      />

      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Zwei Modelle. Ein Preis. Ein Fokus: <span className="text-indigo-400">Output.</span>
        </h2>
        <p className="mt-4 text-white/80 max-w-xl mx-auto">
          Starte heute. Wenn’s nicht passt, Geld zurück – ohne Wenn und Aber.
        </p>

        <motion.div className="mt-10 flex items-center justify-center gap-4 flex-wrap" initial={{opacity:0,y:8}} whileInView={{opacity:1,y:0}} viewport={{ once: true }} transition={{ duration:.5, delay:.05 }}>
          <Link href="/payment" className="px-8 py-3 rounded-lg bg-white text-black font-medium hover:opacity-90 shadow-lg transition">
            Für €99/Jahr starten
          </Link>
          <a href="#features" className="px-8 py-3 rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/15 transition">
            Erst ansehen
          </a>
        </motion.div>

        <p className="mt-8 text-xs text-white/60">Kein Risiko: 14 Tage Geld-zurück-Garantie.</p>
      </div>

      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[200px] w-[600px] bg-gradient-to-t from-indigo-500/20 to-transparent blur-3xl" />
    </motion.section>
  );
}
