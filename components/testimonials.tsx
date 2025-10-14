// components/Testimonials.tsx
"use client";

import { motion } from "framer-motion";

export default function Testimonials() {
  const items = [
    { q: "Wir haben Prompt-Vorlagen zentralisiert – spart täglich Minuten.", a: "Marketing-Team, SaaS" },
    { q: "Research mit Gemini, Umsetzung mit GPT – beides in einem Tab.", a: "Freelance-Designer" },
    { q: "Die UI ist schnell und ohne Schnickschnack. Genau richtig.", a: "Consulting Boutique" },
  ];

  return (
    <section className="py-20 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6">
        <motion.h2 className="text-center text-3xl md:text-4xl font-semibold tracking-tight"
          initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once: true }} transition={{duration:.6}}>
          Was Nutzer sagen
        </motion.h2>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <motion.figure
              key={t.q}
              className="rounded-2xl border border-zinc-200 bg-white p-6"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: .5, delay: i * 0.08 }}
            >
              <blockquote className="text-sm leading-relaxed">“{t.q}”</blockquote>
              <figcaption className="mt-4 text-xs text-zinc-500">{t.a}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
