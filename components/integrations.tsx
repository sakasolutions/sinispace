// components/Integrations.tsx
"use client";
import { useState } from "react";
import { motion } from "framer-motion";

type Mode = "gpt" | "gemini" | "both";

export default function Integrations() {
  const [mode, setMode] = useState<Mode>("gpt");

  return (
    <section id="integrations" className="py-20 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              ChatGPT &amp; Gemini – flexibel nutzen
            </h2>
            <p className="mt-4 text-zinc-600">
              Wähle pro Chat das Modell oder{" "}
              <span className="font-medium">vergleiche Antworten</span>. So
              nutzt du die Stärken beider Welten: kreative Werkzeuge &amp;
              Prompting mit GPT sowie aktuelles Weltwissen &amp; Google-Ökosystem
              mit Gemini.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              <li>• Ein Login, eine Abrechnung, ein Verlauf</li>
              <li>
                • <span className="font-medium">Modellwechsel mit Gesprächsverlauf</span>{" "}
                (Kontext wird übernommen)
              </li>
              <li>• API-basierte, schnelle Kommunikation</li>
            </ul>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span className="font-medium">Ehrlich formuliert:</span> Die
              Modelle teilen keinen internen Speicher. Wir übergeben den bisherigen
              Verlauf automatisch als Kontext – nahtlos im selben Chatfenster.
            </div>
          </motion.div>

          {/* Card / Grafik */}
          <motion.div
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            {/* Header: Logos */}
            <div className="grid grid-cols-2 gap-4">
              <ProviderTile
                name="ChatGPT"
                colorClass="bg-zinc-900"
                active={mode !== "gemini"}
              />
              <ProviderTile
                name="Gemini"
                colorClass="bg-indigo-500"
                active={mode !== "gpt"}
              />
            </div>

            {/* Mode Switch */}
            <div className="mt-6">
              <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50">
                <Segment
                  label="ChatGPT"
                  selected={mode === "gpt"}
                  onClick={() => setMode("gpt")}
                />
                <Segment
                  label="Gemini"
                  selected={mode === "gemini"}
                  onClick={() => setMode("gemini")}
                />
                <Segment
                  label="Vergleich"
                  selected={mode === "both"}
                  onClick={() => setMode("both")}
                />
              </div>
            </div>

            {/* Chat Preview */}
            <div className="mt-6 rounded-xl border border-zinc-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50">
                <p className="text-xs text-zinc-500">
                  {mode === "both"
                    ? "Antworten vergleichen"
                    : `Aktives Modell: ${mode === "gpt" ? "ChatGPT" : "Gemini"}`}
                </p>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Kontext übernommen
                </span>
              </div>

              {mode === "both" ? (
                <div className="grid md:grid-cols-2">
                  <ChatColumn
                    title="ChatGPT"
                    tone="kreativ & strukturiert"
                    dotClass="bg-zinc-900"
                    bubbleClass="bg-zinc-100"
                    text="Lass uns das Ziel in 3 Schritten zerlegen: 1) Datenquellen klären, 2) Prompt-Strategie definieren, 3) Evaluationskriterien festlegen."
                  />
                  <ChatColumn
                    title="Gemini"
                    tone="wissensorientiert"
                    dotClass="bg-indigo-500"
                    bubbleClass="bg-indigo-50"
                    text="Hier sind aktuelle Best Practices aus dem Google-Ökosystem und passende API-Endpoints. Ich ergänze eine kurze Quellenliste."
                  />
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <UserBubble text="Starte mit einer kurzen Zusammenfassung und gib mir To-dos für die nächsten Schritte." />
                  {mode === "gpt" ? (
                    <AssistantBubble
                      accent="bg-zinc-900"
                      bubbleClass="bg-zinc-100"
                      text="Kurzfassung: Ziel, Scope, Risiken. To-dos: 1) Anforderungen priorisieren, 2) Prompt-Vorlagen bauen, 3) Testfälle definieren."
                      footer="Antwort von ChatGPT"
                    />
                  ) : (
                    <AssistantBubble
                      accent="bg-indigo-500"
                      bubbleClass="bg-indigo-50"
                      text="Zusammenfassung mit Fokus auf aktuelle Referenzen. To-dos: 1) API-Zugänge prüfen, 2) Policies abgleichen, 3) Monitoring einrichten."
                      footer="Antwort von Gemini"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Hint */}
            <p className="mt-4 text-xs text-zinc-500">
              Demo-Preview. In der App geschieht der Wechsel automatisch; der
              Chatverlauf wird als Kontext an das Zielmodell übergeben.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ProviderTile({
  name,
  colorClass,
  active,
}: {
  name: string;
  colorClass: string;
  active: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border p-4 text-center transition",
        active ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50 opacity-60",
      ].join(" ")}
    >
      <div className={`mx-auto h-12 w-12 rounded-lg ${colorClass}`} />
      <p className="mt-3 text-sm font-medium">{name}</p>
    </div>
  );
}

function Segment({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 text-sm rounded-lg transition",
        selected ? "bg-white shadow-sm text-zinc-900" : "text-zinc-600 hover:text-zinc-900",
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3">
      <div className="h-6 w-6 rounded-full bg-zinc-300 mt-1" />
      <div className="max-w-full rounded-2xl bg-white px-3 py-2 text-sm text-zinc-800 border border-zinc-200">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({
  text,
  footer,
  bubbleClass,
  accent,
}: {
  text: string;
  footer: string;
  bubbleClass: string;
  accent: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={`h-6 w-6 rounded-full ${accent} mt-1`} />
      <div className={`max-w-full rounded-2xl px-3 py-2 text-sm border ${bubbleClass} border-zinc-200`}>
        <p className="text-zinc-800">{text}</p>
        <div className="mt-2 text-[11px] text-zinc-500">{footer}</div>
      </div>
    </div>
  );
}

function ChatColumn({
  title,
  tone,
  text,
  bubbleClass,
  dotClass,
}: {
  title: string;
  tone: string;
  text: string;
  bubbleClass: string;
  dotClass: string;
}) {
  return (
    <div className="p-4 border-t md:border-t-0 md:border-l border-zinc-200">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-zinc-500">· {tone}</span>
      </div>
      <div className={`rounded-2xl px-3 py-2 text-sm border ${bubbleClass} border-zinc-200 text-zinc-800`}>
        {text}
      </div>
    </div>
  );
}
