// app/api/chats/[id]/messages/stream/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrismaUserFromSession } from '@/lib/auth';
import OpenAI from 'openai';
import { VertexAI, Part } from '@google-cloud/vertexai';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/** ---------- System-Prompt (Premium-Qualität & Stil) ---------- */
const SYSTEM_PROMPT = `
Du bist „SiniSpace Assistant“. Sprich standardmäßig DEUTSCH.

DEINE AUFGABE:
Du bist ein hochintelligenter, professioneller KI-Berater mit dem Ziel,
dem Nutzer den **größtmöglichen praktischen Mehrwert** zu liefern — durch tiefes Verständnis, präzise Argumentation und greifbare Umsetzungsvorschläge.

PRINZIPIEN:
1) **Wahrheit & Genauigkeit zuerst.** Keine erfundenen Fakten/Quellen. Wenn du etwas nicht weißt, sag „weiß ich nicht“ und schlage den nächsten sinnvollen Schritt vor.
2) **Mehrwert & Kontext:** Liefere nicht nur Aufzählungen, sondern erkläre *warum* etwas wichtig ist und *wie* es praktisch umgesetzt werden kann.
3) **Struktur & Stil:**
   - Beginne mit einer **Kurzfassung** (2–4 Sätze).
   - Nutze Markdown (H1–H3, Listen, **fett**, Tabellen wo sinnvoll).
   - Nutze natürliche, lebendige Sprache statt Bulletpoint-Monotonie.
   - Füge – wo passend – konkrete Beispiele, Formulierungsbeispiele oder kleine Vorlagen hinzu.
4) **Denke intern in drei Schritten:** *Verstehen → Plan → Antwort*. Gib nur die finale Antwort aus, nicht deine Notizen.
5) **Bei Logik/Mathe/Code:** Zeige nachvollziehbare Schritte; Code sauber mit korrektem Fence (\`\`\`ts, \`\`\`bash\`\`\`).
6) **Stimme:** Freundlich, professionell, inspirierend – wie ein erfahrener Mentor oder Senior Consultant.
7) **Zielniveau:** Liefere Antworten mit dem Tiefgang und Stil von ChatGPT-4o bzw. Gemini 2.5 Pro.
8) **Abschluss (Situativ):** **NUR WENN** der Nutzer nach einem Plan, einer Strategie oder professionellem Rat fragt (z. B. Business, Marketing, Content-Planung), beende die Antwort mit einem Abschnitt **„Mein Vorschlag – Ultimatives Setup“**.
   - Bei informellen oder kreativen Anfragen (z. B. Witze, Gedichte, allgemeine Fragen) lasse diesen Abschnitt weg und schließe natürlich.
   - Wenn du den Setup-Abschnitt nutzt: 6–10 konkrete Punkte + kurze CTA-Frage.
`.trim(); // GEÄNDERT: Punkt 8 ist jetzt situativ.

/** ---------- Qualitäts-Defaults (zentral) ---------- */
const OPENAI_GEN = {
  temperature: 0.45,
  top_p: 0.9,
  max_tokens: 12288,          // ggf. auf 8192/4096 senken, falls Limits greifen
  presence_penalty: 0.3,
  frequency_penalty: 0.25,
} as const;

const GEMINI_GEN = {
  temperature: 0.45,
  topP: 0.9,
  topK: 64,
  maxOutputTokens: 12288,     // ggf. reduzieren, falls Limits greifen
  // responseMimeType: 'text/markdown', // aktivieren, wenn in deiner Vertex-Version unterstützt
} as const;

/** ---------- Optional: 2. Pass zur Mini-Verfeinerung ---------- */
const DO_REFINE = false;        // auf true setzen, wenn nach dem Stream eine kurze Politur gewünscht ist
const REFINE_TRIGGER_LEN = 1400;

/** ---------- Hilfsfunktionen ---------- */
const getId = (ctx: any) => {
  const v = ctx?.params?.id;
  return Array.isArray(v) ? v[0] : v;
};

function extractImageUrls(text: string | null | undefined): string[] {
  const urls: string[] = [];
  if (typeof text !== 'string' || !text) return urls;
  try {
    const re = /!\[[^\]]*\]\((?<url>[^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const u = m.groups?.url?.trim();
      if (u) urls.push(u);
    }
  } catch (e) {
    console.error("Fehler beim Extrahieren von Bild-URLs:", e);
  }
  return urls;
}

function guessMimeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace('.', '');
  if (e === 'png') return 'image/png';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  if (e === 'pdf') return 'application/pdf';
  if (e === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

async function toInlineDataFromLocalUpload(urlPath: string): Promise<Part | null> {
  try {
    const full = path.join(process.cwd(), 'public', decodeURIComponent(urlPath.replace(/^\/+/, '')));
    const buf = await readFile(full);
    return { inlineData: { data: buf.toString('base64'), mimeType: guessMimeFromExt(path.extname(full)) } };
  } catch (e) {
    console.error(`Fehler beim Laden lokaler Datei ${urlPath}:`, e);
    return null;
  }
}

async function toDataUrlFromLocalUpload(urlPath: string): Promise<string> {
  const full = path.join(process.cwd(), 'public', decodeURIComponent(urlPath.replace(/^\/+/, '')));
  const buf = await readFile(full);
  const mime = guessMimeFromExt(path.extname(full));
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function fetchImageAsBase64Part(url: string): Promise<Part | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image ${url}: ${response.statusText}`);
      return null;
    }
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      console.warn(`URL ${url} did not return an image. Mime type: ${contentType}`);
    }
    const buffer = await response.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const validMime = contentType.startsWith('image/') ? contentType.split(';')[0] : guessMimeFromExt(path.extname(new URL(url).pathname));
    const finalMime = validMime !== 'application/octet-stream' ? validMime : 'image/jpeg';
    return { inlineData: { data: base64Data, mimeType: finalMime } };
  } catch (error) {
    console.error(`Error fetching image ${url}:`, error);
    return null;
  }
}

/** ---------- CTA-Templates & Helfer ---------- */

// NEU: Hilfsfunktion zur Intent-Erkennung
/**
 * Prüft, ob der User-Text nach einer professionellen Beratung / Strategie klingt.
 */
function isProfessionalQuery(userText: string): boolean {
  if (!userText) return false;
  const keywords = [
    'setup', 'business', 'marketing', 'strategie', 'plan',
    'umsatz', 'kunden', 'generieren', 'reichweite', 'verkaufen',
    'shop', 'e-commerce', 'projekt', 'vorschlag', 'anbieten',
    'acrylbilder', 'kunst', 'gemalt', 'malerei', 'business anzukurbeln'
  ];
  const regex = new RegExp(keywords.join('|'), 'i');
  return regex.test(userText);
}


function buildClosingProposal(userText: string): string {
  const isArtMarketing = /acryl|kunst|künstler|malerei|instagram|pinterest|galerie|bilder|art|canvas/i.test(userText || '');
  if (isArtMarketing) {
    return `
## Mein Vorschlag – „Ultimatives Setup“

- **Branding-Kit:** Logo, Farbpalette, Typografie + 3 Feed-Layouts (Mockups).
- **Instagram-Plan:** 4 Posts/Woche, tägliche Story, monatlich 1 Reel-Serie (Making-of).
- **Content-Produktion:** 10–15 vorbereitete Fotos/Videos (Detailshots, Raum-Mockups, Timelapse).
- **Shop/Checkout:** Einfacher Kauf-/Anfrage-Flow (Link in Bio, Kontaktformular, Newsletter-Opt-in).
- **Hashtag & Zielgruppen-Research:** DE/EU, Interior & Kunst-Affinitäten, lokale Tags.
- **Ads-Testlauf:** 50–150 € / 2–4 Wochen, 2 Creatives × 2 Zielgruppen, wöchentliches Tuning.
- **Kooperation lokal:** Einrichtungsgeschäft/Galerie + QR-Flyer mit Mini-Portfolio.
- **Social Proof:** Kundenfoto-Challenge + Testimonials-Kacheln.
- **Reporting:** Wöchentlich 15 min: Reichweite, Saves, Anfragen, Sales-Funnel.

**Soll ich dir direkt einen 4-Wochen-Content-Kalender mit Caption-Vorlagen (inkl. Emojis & CTA) erstellen?**`;
  }
  // Generisches, hochwertiges Closing
  return `
## Mein Vorschlag – „Ultimatives Setup“

- **Zielbild definieren:** klare KPI (z. B. Anfragen/Woche, Conversion, Umsatz).
- **Content-Backlog:** 10–15 hochwertige Assets (Texte, Visuals, Kurzvideos).
- **Kanal-Fokus:** 1 Kernkanal + 1 Supportkanal (Workflows/Planung fix).
- **Conversion-Strecke:** klare CTAs, reduzierte Reibung (Formulare, Checkout, Termine).
- **Schnelltests:** 2–3 Hypothesen/Monat (A/B-Hooks, Creatives, Offers).
- **Retargeting-Setup:** Interessenten erneut ansprechen (E-Mail/Ads).
- **Proof-Layer:** Referenzen, Cases, Social Proof prominenter platzieren.
- **Review-Ritual:** 1×/Woche 15 min: Metriken → Learnings → Anpassungen.

**Soll ich das sofort in einen konkreten 30-Tage-Plan mit Aufgaben pro Woche übersetzen?**`;
}

// GEÄNDERT: Diese Funktion prüft jetzt, ob der Abschluss-Block überhaupt nötig ist.
function ensureClosingSection(text: string, userText: string): string {
  const alreadyHas = /mein vorschlag|ultimatives setup|nächste schritte|next steps/i.test(text || '');
  if (alreadyHas) return text;

  // NEU: Prüfen, ob die Anfrage überhaupt ein "Setup" erfordert.
  // Wenn nicht (z.B. bei der Katzen-Frage), einfach den Text zurückgeben.
  if (!isProfessionalQuery(userText)) {
    return text;
  }

  // Nur wenn es eine professionelle Anfrage war UND die KI das Setup vergessen hat,
  // hängen wir das Standard-Setup an.
  const cta = buildClosingProposal(userText);
  return `${text.trim()}\n\n${cta.trim()}\n`;
}

/** ---------- Route ---------- */
export async function POST(req: Request, ctx: any) {
  try {
    const chatId = getId(ctx);
    if (!chatId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = (await req.json()) as {
      model?: 'gpt-4o' | 'gpt-4o-mini' | 'gemini-1.5-pro' | 'gemini-2.5-pro' | 'gemini-pro';
      messages: Array<{ id?: string; role: 'user' | 'assistant' | 'system'; content: string }>;
    };

    const user = await getPrismaUserFromSession();
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true, model: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const chosen = (body.model ?? chat.model) as string;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    const last = body.messages[body.messages.length - 1];
    if (last.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be user' }, { status: 400 });
    }

    // speichere die User-Nachricht
    await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: last.content } });

    let assistantText = '';
    const imageUrls = extractImageUrls(last.content);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(`data: ${JSON.stringify(obj)}\n\n`);

        try {
          if (chosen.startsWith('gpt')) {
            // ------------ OpenAI (GPT-4o/mini) ------------
            console.log(`🚀 [OpenAI Stream] Modell: ${chosen}`);

            // Multimodal: Text + ggf. Bilder (+ In-Stream-Politurhinweis)
            const parts: any[] = [{
              type: 'text',
              text: `${last.content ?? ''}

Bitte überarbeite deine eigene Antwort während des Schreibens:
- gliedere klar mit H1/H2/H3,
- streiche Dopplungen,
- füge – wo sinnvoll – kurze Checklisten/Beispiele hinzu,
- nutze natürliche, lebendige Sprache statt Bulletpoint-Monotonie.
- **Falls angebracht** (bei Business-/Strategiefragen), beende mit dem Abschnitt **„Mein Vorschlag – Ultimatives Setup“** (6–10 Punkte + kurze CTA-Frage).`, // GEÄNDERT
            }];
            for (const url of imageUrls) {
              if (/^https?:\/\//i.test(url)) {
                parts.push({ type: 'image_url', image_url: { url } });
              } else if (url.startsWith('/uploads/')) {
                try {
                  const dataUrl = await toDataUrlFromLocalUpload(url);
                  parts.push({ type: 'image_url', image_url: { url: dataUrl } });
                } catch (e) {
                  console.error(`Konnte lokales Bild ${url} nicht laden:`, e);
                }
              }
            }

            // **System-Prompt vorn**
            const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: SYSTEM_PROMPT },
              ...body.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content ?? '' })),
              { role: 'user', content: parts },
            ];

            const completion = await openai.chat.completions.create({
              model: chosen as any,
              stream: true,
              ...OPENAI_GEN,
              messages: openaiMessages,
            });

            for await (const chunk of completion) {
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }

            // ---------- Optionaler Refine-Pass (OpenAI) ----------
            if (DO_REFINE && assistantText.length > REFINE_TRIGGER_LEN) {
              const refine = await openai.chat.completions.create({
                model: chosen as any,
                stream: false,
                ...OPENAI_GEN,
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  {
                    role: 'user',
                    content:
`Überarbeite den folgenden Entwurf minimal:
- bessere Struktur (H1/H2/H3), Dopplungen kürzen
- klare Checklisten/Beispiele einbauen, wo sinnvoll
- inhaltlich nichts Neues erfinden, Ton & Sprache beibehalten
- stelle sicher, dass **falls es ein Business-Thema ist**, ein Abschluss „Mein Vorschlag – Ultimatives Setup“ mit 6–10 Punkten vorhanden ist + kurze CTA-Frage.

--- ENTWURF ---
${assistantText}`, // GEÄNDERT
                  },
                ],
              });
              const refined = refine.choices?.[0]?.message?.content?.trim();
              if (refined && refined.length > 0) {
                assistantText = refined;
              }
            }

          } else {
            // ------------ Gemini (Vertex AI) ------------
            console.log(`🚀 [Gemini Stream] Modell: ${chosen}`);

            const vertex_ai = new VertexAI({
              project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
              location: 'us-central1',
            });

            // **System Instruction** + Modell
            const model = vertex_ai.getGenerativeModel({
              model: chosen,
              systemInstruction: SYSTEM_PROMPT,
            });

            // Verlauf
            const history = body.messages.slice(0, -1).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content ?? '' }],
            }));

            // Userturn (Text + ggf. Bilder + In-Stream-Politurhinweis)
            const userParts: Part[] = [{
              text: `${last.content ?? ''}

Bitte überarbeite deine eigene Antwort während des Schreibens:
- gliedere klar mit H1/H2/H3,
- streiche Dopplungen,
- füge – wo sinnvoll – kurze Checklisten/Beispiele hinzu,
- nutze natürliche, lebendige Sprache statt Bulletpoint-Monotonie.
- **Falls angebracht** (bei Business-/Strategiefragen), beende mit dem Abschnitt **„Mein Vorschlag – Ultimatives Setup“** (6–10 Punkte + kurze CTA-Frage).`, // GEÄNDERT
            }];
            for (const url of imageUrls) {
              let imagePart: Part | null = null;
              if (url.startsWith('/uploads/')) imagePart = await toInlineDataFromLocalUpload(url);
              else if (/^https?:\/\//i.test(url)) imagePart = await fetchImageAsBase64Part(url);
              if (imagePart) userParts.push(imagePart);
              else console.warn(`Konnte Bild ${url} nicht verarbeiten.`);
            }

            const chatSession = model.startChat({
              history,
              generationConfig: GEMINI_GEN,
            });

            const result = await chatSession.sendMessageStream(userParts);
            for await (const chunk of result.stream) {
              const delta =
                chunk.candidates?.[0]?.content?.parts?.map(p => (p as any).text ?? '').join('') ?? '';
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }

            // ---------- Optionaler Refine-Pass (Gemini) ----------
            if (DO_REFINE && assistantText.length > REFINE_TRIGGER_LEN) {
              const refineSession = model.startChat({
                history: [],
                generationConfig: GEMINI_GEN,
              });
              const refine = await refineSession.sendMessage([
                {
                  text:
`Überarbeite den folgenden Entwurf minimal:
- bessere Struktur (H1/H2/H3), Dopplungen kürzen
- klare Checklisten/Beispiele einbauen, wo sinnvoll
- inhaltlich nichts Neues erfinden, Ton & Sprache beibehalten
- stelle sicher, dass **falls es ein Business-Thema ist**, ein Abschluss „Mein Vorschlag – Ultimatives Setup“ mit 6–10 Punkten vorhanden ist + kurze CTA-Frage.

--- ENTWURF ---
${assistantText}`, // GEÄNDERT
                },
              ]);
              const refined = refine.response?.candidates?.[0]?.content?.parts
                ?.map((p: any) => p.text ?? '')
                .join('')
                .trim();
              if (refined && refined.length > 0) {
                assistantText = refined;
              }
            }
          }

          // **Failsafe: Abschluss-Block anhängen, falls Modell ihn nicht geliefert hat**
          // GEÄNDERT: Diese Funktion hängt den Block jetzt nur noch an, wenn 'isProfessionalQuery' true ist
          const withClosing = ensureClosingSection(assistantText, last.content);
          if (withClosing.length > assistantText.length) {
            const append = withClosing.slice(assistantText.length);
            send({ type: 'delta', text: append });
            assistantText = withClosing;
          }

          // Antwort speichern
          await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: assistantText, model: chosen },
          });

          // Optional: Usage messen/übergeben (hier leer)
          send({ type: 'usage', usage: {} });
          send({ type: 'done' });
          controller.close();
        } catch (err) {
          console.error('stream error:', err);
          const errorMessage = err instanceof Error ? err.message : 'An unknown stream error occurred';
          send({ type: 'error', message: `API Fehler: ${errorMessage}` });
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e: any) {
    console.error('POST /api/chats/[id]/messages/stream error:', e);
    if (e.message?.includes('Nicht autorisiert')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}