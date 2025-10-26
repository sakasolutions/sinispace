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

// --- System-Prompts ---

const SIMPLE_SYSTEM_PROMPT = `
Du bist ein hilfreicher und freundlicher Assistent. Sprich standardmäßig DEUTSCH.
Antworte klar, präzise und auf den Punkt. Nutze Markdown (#, ##, Listen) für die Struktur.
`.trim();

/**
 * (NEU) PFAD B: Der "Dynamische Projekt-Leiter"
 * (GEÄNDERT: Option A fordert jetzt ChatGPT-Niveau)
 */
const PRO_ROUTER_SYSTEM_PROMPT = `
Du bist „SiniSpace Assistant“, ein hochintelligenter, professioneller KI-Berater. Sprich standardmäßig DEUTSCH.

--------------------------------------------------
DEINE KERN-AUFGABE: DER DYNAMISCHE PROJEKT-LEITER
--------------------------------------------------
Bewerte JEDE neue Nutzeranfrage, die als "PROJECT" (z.B. Business, Marketing, Plan) eingestuft wird.
Dein Ziel ist es, den NUTZEN für den Kunden zu maximieren. Wähle als Experte die beste ERSTE REAKTION aus einer dieser drei Optionen:

1.  **OPTION A: Die SOFORT-LÖSUNG (Strategischer Plan)**
    * **Wann:** Wenn die Anfrage klar und fokussiert ist und ein detaillierter, sofort umsetzbarer Plan den meisten Wert bietet (z.B. "Setup für Acrylmalerei", "Plan für Schmuck-Marketing").
    * **Aktion:** Antworte *direkt* mit einem **umfassenden, strategischen Plan auf höchstem Niveau (ChatGPT-4o Qualität)**.
        * Beginne mit einer **klaren Zusammenfassung** und dem **Ziel**.
        * Gliedere den Plan logisch in **mehrere Hauptphasen** (z.B. Fundament, Online-Präsenz, Reichweite, Monetarisierung). Nutze dafür H2 (\`##\`).
        * Fülle jede Phase mit **sehr konkreten, umsetzbaren Unterpunkten** (mindestens 3-5 pro Phase). Nutze dafür Listen oder H3 (\`###\`). Erkläre das *Warum* und gib *spezifische Beispiele* für Inhalte, Tools, Kanäle oder Formulierungen.
        * Füge eine **priorisierte To-Do-Liste** (\`📋 Nächste Schritte\`) für die ersten 1-2 Wochen hinzu. Nutze Emojis zur Priorisierung (z.B. 🔥 Hoch, Mittel, Niedrig).
        * Schließe mit einem Abschnitt, der **konkrete nächste Hilfestellungen** anbietet (z.B. "🧩 Wenn du willst, helfe ich euch mit: ..."). Sei proaktiv!
        * Das Ergebnis muss den Tiefgang, die Struktur und die Detailfülle einer professionellen Marketing-Beratung haben und deutlich über eine simple 10-Punkte-Liste hinausgehen.

2.  **OPTION B: Das GEFÜHRTE PROJEKT (Phasen-Angebot)**
    * **Wann:** Wenn das Projekt sehr groß oder komplex ist (z.B. "App bauen", "komplettes Business von Null gründen") und ein interaktiver Phasen-Plan sinnvoller ist als ein sofortiger, kompletter Plan (Option A).
    * **Aktion:** Schlage dem Nutzer *direkt* vor, das Projekt in Phasen zu gliedern. Halte diese *erste* Antwort kurz und fokussiert auf den Vorschlag der Phasen.
    * **Beispiel-Antwort:** "Großartig. Das ist ein umfangreiches Projekt. Ich schlage vor, wir gehen das Schritt für Schritt in Phasen an: 1. Fundament & Branding, 2. Angebot & Content, 3. Wachstum & Sales. Wollen wir mit Phase 1: Fundament & Zielgruppe starten?"

3.  **OPTION C: Die KRITISCHE RÜCKFRAGE**
    * **Wann:** Wenn eine entscheidende Information fehlt, um eine gute Antwort (A oder B) zu geben (z.B. "Ich brauche einen Marketingplan" -> aber für was? Budget? Zielgruppe?).
    * **Aktion:** Stelle die *eine*, wichtigste Rückfrage, die du brauchst, um professionell zu antworten. Halte die Frage kurz und präzise.
    * **Beispiel-Antwort:** "Verstanden. Bevor ich den Plan erstelle: Was ist das primäre Ziel? Geht es um schnelle Verkäufe oder um langfristigen Markenaufbau?"

--------------------------------------------------
WICHTIGE REGELN
--------------------------------------------------
- **ENTSCHEIDE DU!** Biete dem Nutzer *niemals* die Wahl zwischen "Schnell" und "Geführt" an. Entscheide du als Experte, welcher Pfad (A, B oder C) der beste ist, und führe ihn aus.
- **FOLGE-ANFRAGEN:** Wenn du ein "Geführtes Projekt" (Option B) gestartet hast, bleibe in diesem Modus und führe den Nutzer durch die Phasen, indem du weitere Fragen stellst. Wenn du eine Rückfrage (Option C) gestellt hast, nutze die Antwort des Nutzers, um dann die bestmögliche Option (A oder B) zu liefern.

--------------------------------------------------
PRINZIPIEN (Für Option A)
--------------------------------------------------
1) **Wahrheit & Genauigkeit zuerst.** Keine erfundenen Fakten/Quellen.
2. **Mehrwert & Kontext:** Erkläre *warum* etwas wichtig ist und *wie* es praktisch umgesetzt werden kann (siehe Option A Anweisungen).
3. **Struktur & Stil:** Nutze Markdown (Überschriften mit #, ##, ###, Listen, **fett**, Tabellen, Emojis). Nutze natürliche, lebendige Sprache.
4. **Bei Logik/Mathe/Code:** Zeige nachvollziehbare Schritte.
5. **Stimme:** Freundlich, professionell, inspirierend – wie ein erfahrener Mentor oder Senior Consultant.
`.trim();


/**
 * Der "Wachmann": Klassifiziert Anfragen, um Token zu sparen.
 */
async function runPreflightCheck(userQuery: string): Promise<'SIMPLE' | 'PROJECT'> {
  const model = 'gpt-4o-mini';
  const prompt = `Klassifiziere die Nutzeranfrage. Antworte NUR mit 'SIMPLE' oder 'PROJECT'.
SIMPLE = Smalltalk, Witze, Rezepte, allgemeine Wissensfragen, Code-Fragen, Übersetzungen.
PROJECT = Business-Pläne, Marketing-Strategien, App-Ideen, komplexe Lösungsfindungen, Projekt-Setups (z.B. "Acryl-Business ankurbeln", "Marketingplan erstellen").
Anfrage: ${userQuery}`;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 5,
    });
    const result = completion.choices[0].message.content?.trim().toUpperCase();
    if (result === 'PROJECT') {
      return 'PROJECT';
    }
    return 'SIMPLE';
  } catch (e) {
    console.error('Fehler im Preflight-Check:', e);
    return 'SIMPLE';
  }
}


/** ---------- Qualitäts-Defaults (zentral) ---------- */
const OPENAI_GEN = {
  temperature: 0.7, // Kreativer
  top_p: 0.9,
  max_tokens: 12288,
  presence_penalty: 0.3,
  frequency_penalty: 0.25,
} as const;

const GEMINI_GEN = {
  temperature: 0.7, // Kreativer
  topP: 0.9,
  topK: 64,
  maxOutputTokens: 12288,
} as const;

/** ---------- Optional: 2. Pass zur Mini-Verfeinerung ---------- */
const DO_REFINE = false;
const REFINE_TRIGGER_LEN = 1400;

/** ---------- Hilfsfunktionen (Nur noch Bildverarbeitung) ---------- */
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
      select: { id: true, model: true, modelLevel: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    const last = body.messages[body.messages.length - 1];
    if (last.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be user' }, { status: 400 });
    }

    await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: last.content } });

    let assistantText = '';
    const imageUrls = extractImageUrls(last.content);

    // --- "Modell-Kaskade" Logik (unverändert) ---
    let systemPrompt: string;
    let chosenModel: string;
    let effectiveModelLevel = chat.modelLevel as 'simple' | 'pro';
    let isNewProjectOffer = false;

    const preferredProModel = (body.model ?? chat.model) as string;

    if (effectiveModelLevel === 'pro') {
      console.log(`🚀 [PRO CHAT] Modell: ${preferredProModel}`);
      systemPrompt = PRO_ROUTER_SYSTEM_PROMPT; // Benutzt den NEUEN Pro-Prompt
      chosenModel = preferredProModel;

    } else {
      console.log(`[PREFLIGHT] Prüfe Intent für: "${last.content.substring(0, 40)}..."`);
      const intent = await runPreflightCheck(last.content);

      if (intent === 'PROJECT') {
        console.log(`🚀 [PREFLIGHT -> PROJECT] Upgrade auf Pro-Modell: ${preferredProModel}`);
        effectiveModelLevel = 'pro';
        systemPrompt = PRO_ROUTER_SYSTEM_PROMPT; // Benutzt den NEUEN Pro-Prompt
        chosenModel = preferredProModel;
        isNewProjectOffer = true;

      } else {
        const simpleModel = preferredProModel.startsWith('gemini') ? 'gemini-1.5-flash-latest' : 'gpt-4o-mini';
        console.log(`🚀 [PREFLIGHT -> SIMPLE] Nutze günstiges Modell: ${simpleModel}`);
        effectiveModelLevel = 'simple';
        systemPrompt = SIMPLE_SYSTEM_PROMPT;
        chosenModel = simpleModel;
      }
    }
    // --- ENDE KASKADEN-LOGIK ---


    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(`data: ${JSON.stringify(obj)}\n\n`);

        try {
          if (isNewProjectOffer) {
            await prisma.chat.update({
              where: { id: chat.id },
              data: { modelLevel: 'pro' },
            });
            console.log(`[DB UPDATE] Chat ${chat.id} ist jetzt "pro"`);
          }

          const politurPrompt = `

Bitte überarbeite deine eigene Antwort während des Schreibens:
- gliedere klar mit Markdown-Überschriften (#, ##, ###),
- streiche Dopplungen,
- nutze natürliche, lebendige Sprache statt Bulletpoint-Monotonie.
`;

          if (chosenModel.startsWith('gpt')) {
            // ------------ OpenAI (GPT-4o/mini) ------------
            console.log(`🚀 [OpenAI Stream] Effektives Modell: ${chosenModel}`);

            const parts: any[] = [{
              type: 'text',
              text: `${last.content ?? ''}\n${politurPrompt}`,
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

            const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'system', content: systemPrompt },
              ...body.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content ?? '' })),
              { role: 'user', content: parts },
            ];

            const completion = await openai.chat.completions.create({
              model: chosenModel as any,
              stream: true,
              ...OPENAI_GEN, // Benutzt die NEUE Temperatur
              messages: openaiMessages,
            });

            for await (const chunk of completion) {
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }

            // Refine-Pass...

          } else {
            // ------------ Gemini (Vertex AI) ------------
            console.log(`🚀 [Gemini Stream] Effektives Modell: ${chosenModel}`);

            const vertex_ai = new VertexAI({
              project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
              location: 'us-central1',
            });

            const model = vertex_ai.getGenerativeModel({
              model: chosenModel,
              systemInstruction: systemPrompt,
            });

            const history = body.messages.slice(0, -1).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user', // Korrigiert
              parts: [{ text: m.content ?? '' }],
            }));

            const userParts: Part[] = [{
              text: `${last.content ?? ''}\n${politurPrompt}`,
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
              generationConfig: GEMINI_GEN, // Benutzt die NEUE Temperatur
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

            // Refine-Pass...

          }

          // Antwort speichern
          await prisma.message.create({
            data: {
              chatId: chat.id,
              role: 'assistant',
              content: assistantText,
              model: chosenModel
            },
          });

          send({ type: 'usage', usage: {} });
          send({ type: 'done' });
          controller.close();
        } catch (err) {
          console.error('stream error:', err);
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
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