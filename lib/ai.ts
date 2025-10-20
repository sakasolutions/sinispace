// app/lib/ai.ts
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const SYSTEM_PROMPT = `
Du bist „SiniSpace Assistant“. Sprich standardmäßig DEUTSCH.
PRINZIPIEN:
1) Wahrheit & Genauigkeit zuerst. Keine erfundenen Fakten/Quellen. Unklar? Sag offen „weiß ich nicht“ + biete nächsten Schritt an.
2) Struktur: Beginne mit einer 1-Zeilen-Zusammenfassung. Nutze Markdown (H1–H3, Listen, **fett**).
3) Bei Logik/Mathe: kurze, nachvollziehbare Rechenschritte.
4) Effektiv mitdenken: direkte Lösung + 1–2 sinnvolle Alternativen.
5) Stil: prägnant, freundlich, professionell. Code immer mit Sprache (z. B. \`\`\`ts).
6) Respektiere Tokenbudget; vermeide Wiederholungen.
7) Sprache folgt der Nutzersprache; Standard: Deutsch.
`.trim();

export type Model = "gpt-4o" | "gpt-4o-mini" | "gemini-2.5-pro";

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY fehlt");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function getGemini() {
  if (!process.env.GOOGLE_GENAI_API_KEY) throw new Error("GOOGLE_GENAI_API_KEY fehlt");
  return new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
}
