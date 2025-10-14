"use client";

import Link from "next/link";
import Image from "next/image";
// 1. KORREKTUR: Wir importieren den "MotionProps"-Typ
import { motion, type MotionProps } from "framer-motion";

// 2. KORREKTUR: Wir weisen den "MotionProps"-Typ als Rückgabetyp der Funktion zu
const fadeUp = (d = 0): MotionProps => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay: d } },
});

export default function Hero() {
  return (
    <motion.section
      className="relative isolate overflow-hidden"
      initial="initial"
      animate="animate"
    >
      {/* Hintergrund */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.35),transparent),linear-gradient(180deg,#0b1220_0%,#0b1220_50%,#0e1322_100%)]"
      />
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-16 text-center">
        <motion.p
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur"
          {...fadeUp(0.05)}
        >
          Dual-KI: ChatGPT + Gemini • Ein Login • Eine Oberfläche
        </motion.p>

        <motion.h1
          className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight leading-tight text-white"
          {...fadeUp(0.15)}
        >
          Ein Zugang.{" "}
          <span className="relative">
            Beide Top-Modelle
            <span className="block h-[3px] w-full rounded-full bg-indigo-400/80 mt-2"></span>
          </span>
          .
          <br className="hidden sm:block" />
          Mehr Output – weniger Chaos.
        </motion.h1>

        <motion.p
          className="mt-6 mx-auto max-w-2xl text-base md:text-lg text-white/80"
          {...fadeUp(0.25)}
        >
          Sinispace bündelt ChatGPT & Gemini in einer schnellen, klaren UI. Wechsel
          je Aufgabe das Modell – oder nutze beides parallel. Für Teams und Solo-Macher.
        </motion.p>

        <motion.div className="mt-10 flex items-center justify-center gap-3" {...fadeUp(0.35)}>
          <Link
            href="/payment"
            className="px-6 md:px-8 py-3 md:py-4 rounded-lg bg-white text-black font-medium hover:opacity-90 shadow"
          >
            Jetzt starten – €99/Jahr
          </Link>
          <a
            href="#features"
            className="px-6 md:px-8 py-3 md:py-4 rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/15"
          >
            Features ansehen
          </a>
        </motion.div>

        {/* Mockup-Card mit echten Bildern */}
        <motion.div
          className="mt-16 mx-auto max-w-5xl rounded-2xl border border-white/10 bg-white p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]"
          {...fadeUp(0.45)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ChatGPT */}
            <motion.div
              className="rounded-xl border border-zinc-200 p-4"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 120 }}
            >
              <div className="text-xs text-zinc-500 mb-3">ChatGPT</div>
              <div className="relative h-40 w-full overflow-hidden rounded-lg">
                <Image
                  src="/chatgpt-preview.png"
                  alt="ChatGPT Preview"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                  priority
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/30 to-transparent" />
              </div>
            </motion.div>

            {/* Gemini */}
            <motion.div
              className="rounded-xl border border-zinc-200 p-4"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 120, delay: 0.05 }}
            >
              <div className="text-xs text-zinc-500 mb-3">Gemini</div>
              <div className="relative h-40 w-full overflow-hidden rounded-lg">
                <Image
                  src="/gemini-preview.png"
                  alt="Gemini Preview"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/30 to-transparent" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <motion.p className="mt-4 text-xs text-white/60" {...fadeUp(0.55)}>
          Kein Risiko: 14 Tage Geld-zurück, wenn’s nicht passt.
        </motion.p>
      </div>
    </motion.section>
  );
}

// Finaler Deploy, jetzt aber wirklich