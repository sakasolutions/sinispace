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

1.  **OPTION A: Die SOFORT-LÖSUNG (Strategischer High-End Plan)**
    * **Wann:** Wenn die Anfrage klar und fokussiert ist und ein detaillierter, sofort umsetzbarer Plan den meisten Wert bietet (z.B. "Setup für Acrylmalerei", "Plan für Schmuck-Marketing").
    * **Aktion:** Antworte *direkt* mit einem **umfassenden, strategischen Plan auf absolutem Top-Niveau (Vorbild: ChatGPT-4o / Gemini 2.5 Pro)**. Die Antwort muss sich wie eine maßgeschneiderte Mini-Beratung anfühlen.
        * **1. Zusammenfassung & Ziel (Klarheit):** Beginne mit 2-3 Sätzen, die das Problem zusammenfassen und das Kernziel des Plans benennen.
        * **2. Logische Hauptphasen (Struktur):** Gliedere den Plan in 3-5 logische Hauptphasen (z.B. Fundament, Präsenz, Reichweite, Verkauf). Nutze prägnante H2 (\`##\`).
        * **3. Detaillierte Unterpunkte (Tiefe & Beispiele):** Fülle jede Phase mit **mindestens 4-6 sehr konkreten, praxisnahen Unterpunkten**. Nutze Listen oder H3 (\`###\`).
            * **Erkläre das "Warum":** Begründe kurz, warum jeder Punkt wichtig ist.
            * **Gib präzise Beispiele:** Statt "Nutze Social Media", schreibe "Fokus auf Instagram Reels: Zeige den Entstehungsprozess deiner Bilder im Zeitraffer (max. 30 Sek.) mit trendigen Sounds."
            * **Nenne konkrete Tools/Plattformen:** Empfiehl spezifische Tools (z.B. Canva, Linktree, Shopify, Etsy).
        * **4. Priorisierte To-Do-Liste (Umsetzung):** Füge eine \`📋 Nächste Schritte (Sofort umsetzen)\`-Liste hinzu. 3-5 der wichtigsten Aufgaben für die ersten 7 Tage. Priorisiere mit Emojis (z.B. 🔥 Wichtigst, 🟠 Mittel, ⚪ Später).
        * **5. Proaktive Hilfsangebote (Mehrwert):** Schließe mit einem Abschnitt \`🧩 Wie ich dir weiterhelfen kann:\`. Biete 3-4 sehr konkrete nächste Schritte an, die *du* übernehmen könntest (z.B. "Content-Kalender für 4 Wochen erstellen", "3 Instagram Reel-Ideen ausarbeiten", "Keyword-Recherche für Hashtags").
        * **Qualitätsanspruch:** Das Ergebnis muss extrem praktisch, inspirierend und sofort umsetzbar sein. Reine Aufzählungen sind zu wenig.

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

  // --- NEUE "SMART ROUTER" LOGIK (OpenAI-Fallback) ---
    // Diese Logik nutzt NUR OpenAI, da Gemini für dieses Konto gesperrt ist.
    // Sie entscheidet bei JEDER Nachricht neu.

    let systemPrompt: string;
    let chosenModel: string;

    console.log(`[SMART ROUTER] Prüfe Intent für: "${last.content.substring(0, 40)}..."`);
    const intent = await runPreflightCheck(last.content);

    if (intent === 'PROJECT') {
      // "PRO"-PFAD: Bewusster TEST von Gemini
      chosenModel = 'gemini-2.5-pro'; // <-- HIER ÄNDERN ZUM TESTEN
      systemPrompt = PRO_ROUTER_SYSTEM_PROMPT;
      console.log(`🚀 [GEMINI-TEST -> PROJECT] Nutze Pro-Modell: ${chosenModel}`);
        
    } else {
        // "SIMPLE"-PFAD: Nutze das günstigste Modell von OpenAI
        chosenModel = 'gpt-4o-mini';
        systemPrompt = SIMPLE_SYSTEM_PROMPT;
        console.log(`🚀 [ROUTER -> SIMPLE] Nutze günstiges Modell: ${chosenModel}`);
    }
    
    const isNewProjectOffer = false; 
    // --- ENDE "SMART ROUTER" LOGIK ---

    // +++ `finalModelName` hier definieren, damit `catch` darauf zugreifen kann +++
    let finalModelName = chosenModel;

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
            // ------------ OpenAI (GPT-4o/mini) --- (UNVERÄNDERT) ---
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

            // Refine-Pass...

          } else {
            // +++ KORRIGIERTER Gemini (Vertex AI) Block +++
            console.log(`🚀 [Gemini/Vertex Stream] Effektives Modell: ${chosenModel}`);

            const vertex_ai = new VertexAI({
              project: process.env.GOOGLE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
              location: 'us-central1', // <-- ZURÜCK ZUM STANDARD
            });
            
            // +++ Modell-Namen-Übersetzung (WICHTIG!) +++
            if (chosenModel === 'gemini-2.5-pro' || chosenModel === 'gemini-1.5-pro') {
              finalModelName = 'gemini-1.5-pro-latest'; 
            }
            if (chosenModel === 'gemini-pro') {
                finalModelName = 'gemini-1.0-pro';
            }
            console.log(`[Vertex Mapping] Frontend: "${chosenModel}" -> Vertex: "${finalModelName}"`);


            const model = vertex_ai.getGenerativeModel({
              model: finalModelName,
              // +++ KORREKTUR: Zurück zum String-Format, das deine Lib erwartet +++
              systemInstruction: systemPrompt,
            });

            const history = body.messages.slice(0, -1).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user', // Korrekt
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
            // --- ENDE KORREKTURBLOCK ---
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

        } catch (err: any) { // +++ KORREKTUR: Detailliertes Error Handling für Vertex +++
          console.error("!!! FATALER STREAM-FEHLER !!!");
          console.error("Fehler-Objekt:", err);
          console.error("Fehler-Nachricht:", err.message);
          
          let errorMessage = err.message || 'An unknown error occurred';
          
          // Spezifische Vertex/GCP-Fehler abfangen
          if (err.message?.includes("does not exist") || err.message?.includes("GetModel")) {
              errorMessage = `Modell "${finalModelName}" (gemappt von "${chosenModel}") nicht gefunden oder nicht für dieses Projekt aktiviert.`;
          } else if (err.message?.includes("Quota") || err.message?.includes("rate limit")) {
              errorMessage = `API-Limit (Quota) überschritten. Bitte prüfe dein Google Cloud-Konto.`;
          } else if (err.message?.includes("Billing account") || err.message?.includes("project is not linked") || err.message?.includes("API has not been used")) {
              errorMessage = `Abrechnungs- oder API-Problem. Stelle sicher, dass die "Vertex AI API" im Projekt aktiviert UND mit einem aktiven Abrechnungskonto verknüpft ist.`;
          } else if (err.message?.includes("permission denied") || err.message?.includes("credentials")) {
              errorMessage = `Authentifizierungsfehler. Stelle sicher, dass die "Application Default Credentials" (ADC) korrekt konfiguriert sind (z.B. gcloud auth application-default login) oder der Service Account die Rolle "Vertex AI User" hat.`;
          }

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