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

// --- NEU: Definition der 2 relevanten System-Prompts ---

/**
 * PFAD A: Für billige, schnelle Alltagsanfragen.
 */
const SIMPLE_SYSTEM_PROMPT = `
Du bist ein hilfreicher und freundlicher Assistent. Sprich standardmäßig DEUTSCH.
Antworte klar, präzise und auf den Punkt. Nutze Markdown (#, ##, Listen) für die Struktur.
`.trim();

/**
 * PFAD B: Für Pro-Nutzer & Projektanfragen.
 * (GEÄNDERT: Die Follow-Up-Regel für "Schnelle Zusammenfassung" ist jetzt dynamisch)
 */
const PRO_ROUTER_SYSTEM_PROMPT = `
Du bist „SiniSpace Assistant“. Sprich standardmäßig DEUTSCH.

--------------------------------------------------
DEINE KERN-AUFGABE: DER PROJEKT-ROUTER
--------------------------------------------------
Bewerte JEDE neue Nutzeranfrage SOFORT und entscheide dich für EINEN von ZWEI Pfaden:

### PFAD A: Die "Experten-Antwort" (Standardfall)
Dies ist der Pfad für 90% aller Anfragen:
- Allgemeine Wissensfragen (z. B. "Was ist ein API?")
- Kreative Aufgaben (z. B. "Schreib ein Gedicht")
- Einfache Anfragen (z. B. "Rezept für Carbonara", "Witz über Katzen")
- Smalltalk
- Der Nutzer befindet sich bereits in einem Projekt-Workflow und stellt eine Folgefrage.

**WENN DU PFAD A WÄHLST:**
1.  Gib SOFORT die bestmögliche, direkte und vollständige Antwort.
2.  Folge den "Prinzipien" (siehe unten) für Struktur und Stil (Kurzfassung, Markdown etc.).
3.  **WICHTIG:** Biete KEINEN Projekt-Modus an. Schließe die Antwort natürlich ab.

---

### PFAD B: Das "Geführte Projekt" (Spezialfall)
Dies ist der Pfad für 10% der Anfragen – wenn der Nutzer ein NEUES, echtes PROBLEM lösen oder ein VORHABEN starten will.
Trigger-Beispiele:
- "Marketingplan für..."
- "Business für meine Freundin ankurbeln..."
- "Wie verkaufe ich X..."
- "Ich brauche ein komplettes Setup für..."

**WENN DU PFAD B WÄHLST (und es eine NEUE Anfrage ist):**
1.  **STOPP!** Gib NICHT sofort die volle Lösung.
2.  Deine *einzige* Antwort muss das "Projekt-Angebot" sein.
3.  Antworte *genau* in diesem Format:

    "Das ist ein spannendes Vorhaben! Es klingt nach einem echten Projekt.

    Um hier wirklich professionelle Ergebnisse zu erzielen, können wir das auf zwei Arten angehen:

    1.  **Schnelle Zusammenfassung:** Ich gebe dir sofort mein „Ultimatives Setup“ – eine dichte Checkliste mit den wichtigsten Hebeln, um sofort loszulegen.

    2.  **Geführtes Projekt:** Wir behandeln das wie ein echtes Business-Projekt. Ich führe dich Schritt für Schritt durch die entscheidenden Phasen (z. B. Branding, Content, Sales-Funnel, Wachstum), stelle dir die richtigen Fragen und wir erarbeiten einen wasserdichten Plan.

    Was bevorzugst du? Die **[Schnelle Zusammenfassung]** oder das **[Geführte Projekt]**?"

4.  Warte auf die Antwort des Nutzers.

--------------------------------------------------
PRINZIPIEN (Für PFAD A & Follow-Ups)
--------------------------------------------------
1) **Wahrheit & Genauigkeit zuerst.** Keine erfundenen Fakten/Quellen.
2) **Mehrwert & Kontext:** Erkläre *warum* etwas wichtig ist und *wie* es praktisch umgesetzt werden kann.
3) **Struktur & Stil:**
   - Beginne mit einer **Kurzfassung** (2–4 Sätze) (außer bei Pfad B).
   - Nutze Markdown (Überschriften mit #, ##, ###, Listen, **fett**, Tabellen).
   - Nutze natürliche, lebendige Sprache.
4. **Bei Logik/Mathe/Code:** Zeige nachvollziehbare Schritte.
5. **Stimme:** Freundlich, professionell, inspirierend – wie ein erfahrener Mentor.
6. **Zielniveau:** ChatGPT-4o / Gemini 2.5 Pro.

--------------------------------------------------
FOLLOW-UP-REGELN (NACH PFAD B)
--------------------------------------------------
- **Wenn Nutzer "Schnelle Zusammenfassung" wählt:**
  Antworte SOFORT mit: "Absolut, hier ist dein persönliches Setup.".
  Generiere dann einen Abschnitt \`## Mein Vorschlag – „Ultimatives Setup“\`.
  Erstelle eine **individuelle Checkliste mit 6-10 Punkten**, die *präzise auf das Problem des Nutzers* zugeschnitten ist (z.B. für "Schmuck", "Acrylmalerei", "Café" etc.).
  Schließe mit einer kurzen, passenden CTA-Frage (z.B. "Soll ich dir dafür einen Content-Kalender erstellen?").

- **Wenn Nutzer "Geführtes Projekt" wählt:**
  Antworte mit: "Großartig. Fangen wir professionell an. Jedes erfolgreiche Projekt steht auf mehreren Säulen. Für dein Ziel [Ziel des Nutzers, z.B. 'Kunst verkaufen'] habe ich folgenden Phasen-Plan:
  
  **Phase 1: Fundament & Branding**
  (Wofür stehst du? Wer ist der Traumkunde? Was macht dich einzigartig?)
  
  **Phase 2: Content- & Angebots-Maschine**
  (Was genau wird verkauft? Welche Inhalte (Bilder/Videos) brauchen wir?)
  
  **Phase 3: Der Sales-Funnel**
  (Wie genau kauft jemand? Per DM? Über einen Shop?)
  
  **Phase 4: Traffic & Wachstum**
  (Woher kommen die Leute? (Ads, Kooperationen, SEO?))
  
  ---
  **Lass uns mit Phase 1: Fundament & Branding beginnen.**
  
  Meine erste Frage: [Stelle die erste, wichtigste Frage zu Phase 1, z.B. "Wie würdest du den einzigartigen Stil in 3 Worten beschreiben?"]"
`.trim();


/**
 * Der "Wachmann": Klassifiziert Anfragen, um Token zu sparen.
 */
async function runPreflightCheck(userQuery: string): Promise<'SIMPLE' | 'PROJECT'> {
  const model = 'gpt-4o-mini'; // Günstiges & schnelles Modell für die Klassifizierung
  const prompt = `Klassifiziere die Nutzeranfrage. Antworte NUR mit 'SIMPLE' oder 'PROJECT'.
SIMPLE = Smalltalk, Witze, Rezepte, allgemeine Wissensfragen, Code-Fragen, Übersetzungen.
PROJECT = Business-Pläne, Marketing-Strategien, App-Ideen, komplexe Lösungsfindungen, Projekt-Setups (z.B. "Acryl-Business ankurbeln", "Marketingplan erstellen").
Anfrage: ${userQuery}`;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 5, // 'SIMPLE' oder 'PROJECT'
    });
    const result = completion.choices[0].message.content?.trim().toUpperCase();
    if (result === 'PROJECT') {
      return 'PROJECT';
    }
    return 'SIMPLE';
  } catch (e) {
    console.error('Fehler im Preflight-Check:', e);
    return 'SIMPLE'; // Im Zweifel als 'SIMPLE' einstufen, um Kosten zu sparen
  }
}


/** ---------- Qualitäts-Defaults (zentral) ---------- */
const OPENAI_GEN = {
  temperature: 0.45,
  top_p: 0.9,
  max_tokens: 12288,
  presence_penalty: 0.3,
  frequency_penalty: 0.25,
} as const;

const GEMINI_GEN = {
  temperature: 0.45,
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

/** ---------- CTA-Templates & Helfer ---------- */
// GELÖSCHT: isProfessionalQuery, buildClosingProposal, ensureClosingSection


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
    // Holen den 'modelLevel' aus der DB
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

    // Speichere die User-Nachricht
    await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: last.content } });

    let assistantText = '';
    const imageUrls = extractImageUrls(last.content);

    // --- "Modell-Kaskade" Logik ---
    let systemPrompt: string;
    let chosenModel: string;
    let effectiveModelLevel = chat.modelLevel as 'simple' | 'pro';
    let isNewProjectOffer = false; 

    const preferredProModel = (body.model ?? chat.model) as string;

    if (effectiveModelLevel === 'pro') {
      // 1. DIES IST BEREITS EIN PRO-CHAT
      console.log(`🚀 [PRO CHAT] Modell: ${preferredProModel}`);
      systemPrompt = PRO_ROUTER_SYSTEM_PROMPT;
      chosenModel = preferredProModel;

    } else {
      // 2. DIES IST EIN "SIMPLE" CHAT (Standard)
      console.log(`[PREFLIGHT] Prüfe Intent für: "${last.content.substring(0, 40)}..."`);
      const intent = await runPreflightCheck(last.content);

      if (intent === 'PROJECT') {
        // 2a. WACHMANN SAGT: "PROJECT" -> Upgrade!
        console.log(`🚀 [PREFLIGHT -> PROJECT] Upgrade auf Pro-Modell: ${preferredProModel}`);
        effectiveModelLevel = 'pro';
        systemPrompt = PRO_ROUTER_SYSTEM_PROMPT;
        chosenModel = preferredProModel;
        isNewProjectOffer = true; // DB muss aktualisiert werden!
      
      } else {
        // 2b. WACHMANN SAGT: "SIMPLE" -> Bleib billig!
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
          // DB-Upgrade ausführen
          if (isNewProjectOffer) {
            await prisma.chat.update({
              where: { id: chat.id },
              data: { modelLevel: 'pro' },
            });
            console.log(`[DB UPDATE] Chat ${chat.id} ist jetzt "pro"`);
          }

          // Die In-Stream-Politur-Anweisung
          const politurPrompt = `

Bitte überarbeite deine eigene Antwort während des Schreibens:
- gliedere klar mit Markdown-Überschriften (#, ##, ###),
- streiche Dopplungen,
- füge – wo sinnvoll – kurze Checklisten/Beispiele hinzu,
- nutze natürliche, lebendige Sprache statt Bulletpoint-Monotonie.
${effectiveModelLevel === 'pro' ? '- Wenn du eine "Ultimatives Setup"-Checkliste erstellst, stelle sicher, dass sie 6-10 *maßgeschneiderte* Punkte und eine CTA-Frage enthält.' : ''}
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
              // ... (Refine-Logik, falls benötigt) ...
            }

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
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content ?? '' }],
            }));

            const userParts: Part[] = [{
              text: `${last.content ?? ''}\n${politurPrompt}`,
            }];
            for (const url of imageUrls) {
              let imagePart: Part | null = null;
              if (url.startsWith('/uploads/')) imagePart = await toInlineDataFromLocalUpload(url);
              else if (/^httpska?:\/\//i.test(url)) imagePart = await fetchImageAsBase64Part(url);
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
            
            // ... (Refine-Pass für Gemini, falls DO_REFINE = true) ...
            
          }

          // **Failsafe: Abschluss-Block (GELÖSCHT)**
          // Wir vertrauen jetzt darauf, dass das Pro-Modell die Anweisungen
          // im PRO_ROUTER_SYSTEM_PROMPT befolgt.

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