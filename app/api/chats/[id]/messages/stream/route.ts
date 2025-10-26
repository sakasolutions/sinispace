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

// --- NEU: Definition der 3 System-Prompts ---

/**
 * (NEU) PFAD A: Für billige, schnelle Alltagsanfragen.
 * Wird von gpt-4o-mini oder gemini-flash genutzt.
 */
const SIMPLE_SYSTEM_PROMPT = `
Du bist ein hilfreicher und freundlicher Assistent. Sprich standardmäßig DEUTSCH.
Antworte klar, präzise und auf den Punkt. Nutze Markdown (#, ##, Listen) für die Struktur.
`.trim();

/**
 * (NEU) PFAD B: Für Pro-Nutzer & Projektanfragen.
 * Dies ist der "Router", der den Premium-Workflow anbietet.
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
- "Business für meine Freundin ankurbeln..." (z. B. die Acryl-Malerin)
- "Wie verkaufe ich X..."
- "Ich brauche ein komplettes Setup für..."
- "Eine App entwickeln..."
- "Businessplan für ein Café..."

**WENN DU PFAD B WÄHLST (und es eine NEUE Anfrage ist):**
1.  **STOPP!** Gib NICHT sofort die volle Lösung oder ein "Ultimatives Setup".
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
  Generiere die "Ultimatives Setup"-Checkliste (6-10 Punkte + CTA-Frage). Nutze dafür die Funktion \`buildClosingProposal\` (z.B. das "Kunst-Setup" oder das "Generische Setup").

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
  
  Meine erste Frage: [Stelle die erste, wichtigste Frage zu Phase 1, z.B. "Wie würdest du den einzigartigen Stil deiner Freundin in 3 Worten beschreiben?"]"
`.trim();


/**
 * (NEU) Der "Wachmann": Klassifiziert Anfragen, um Token zu sparen.
 * Nutzt immer ein günstiges, schnelles Modell.
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
// Diese gelten jetzt primär für die PRO-Modelle
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

/** ---------- Hilfsfunktionen ---------- */
// Diese bleiben alle gleich wie vorher
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
  // ... (Code unverändert)
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
// Diese bleiben alle gleich wie vorher
function isProfessionalQuery(userText: string): boolean {
  if (!userText) return false;
  const keywords = [
    'setup', 'business', 'marketing', 'strategie', 'plan',
    'umsatz', 'kunden', 'generieren', 'reichweite', 'verkaufen',
    'shop', 'e-commerce', 'projekt', 'vorschlag', 'anbieten',
    'acrylbilder', 'kunst', 'gemalt', 'malerei', 'business anzukurbeln',
    'schnelle zusammenfassung' // <-- WICHTIG: Damit der Failsafe auch nach dem Projekt-Angebot greift
  ];
  const regex = new RegExp(keywords.join('|'), 'i');
  return regex.test(userText);
}

function buildClosingProposal(userText: string): string {
  // ... (Code unverändert)
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

function ensureClosingSection(text: string, userText: string): string {
  // ... (Code unverändert)
  // Diese Funktion ist weiterhin nützlich als Failsafe für die "Schnelle Zusammenfassung"
  const alreadyHas = /mein vorschlag|ultimatives setup|nächste schritte|next steps/i.test(text || '');
  if (alreadyHas) return text;

  if (!isProfessionalQuery(userText)) {
    return text;
  }

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
    // --- NEU: Holen den 'modelLevel' aus der DB ---
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
      select: { id: true, model: true, modelLevel: true }, // <-- 'modelLevel' hinzugefügt
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }
    const last = body.messages[body.messages.length - 1];
    if (last.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be user' }, { status: 400 });
    }

    // Speichere die User-Nachricht (unverändert)
    await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: last.content } });

    let assistantText = '';
    const imageUrls = extractImageUrls(last.content);

    // --- NEU: Die "Modell-Kaskade" Logik ---

    let systemPrompt: string;
    let chosenModel: string;
    let effectiveModelLevel = chat.modelLevel as 'simple' | 'pro';
    let isNewProjectOffer = false; // Flag, um DB-Update zu triggern

    // Der vom Nutzer im Frontend gewählte "Wunsch-Modell" (z.B. gpt-4o)
    const preferredProModel = (body.model ?? chat.model) as string;

    if (effectiveModelLevel === 'pro') {
      // 1. DIES IST BEREITS EIN PRO-CHAT
      // Wir bleiben im Pro-Modus, nutzen den Pro-Prompt und das Pro-Modell
      console.log(`🚀 [PRO CHAT] Modell: ${preferredProModel}`);
      systemPrompt = PRO_ROUTER_SYSTEM_PROMPT;
      chosenModel = preferredProModel;

    } else {
      // 2. DIES IST EIN "SIMPLE" CHAT (Standard)
      // Wir müssen den "Wachmann" (Preflight) fragen
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
        // Wir nutzen den Simple-Prompt und ein hartcodiertes GÜNSTIGES Modell
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
          // --- NEU: DB-Upgrade ausführen ---
          // Wenn der Chat gerade zum "PROJECT" wurde, speichern wir das jetzt.
          if (isNewProjectOffer) {
            await prisma.chat.update({
              where: { id: chat.id },
              data: { modelLevel: 'pro' },
            });
            console.log(`[DB UPDATE] Chat ${chat.id} ist jetzt "pro"`);
          }
          // ---

          // Die In-Stream-Politur-Anweisung (angepasst)
          const politurPrompt = `

Bitte überarbeite deine eigene Antwort während des Schreibens:
- gliedere klar mit Markdown-Überschriften (#, ##, ###),
- streiche Dopplungen,
- füge – wo sinnvoll – kurze Checklisten/Beispiele hinzu,
- nutze natürliche, lebendige Sprache statt Bulletpoint-Monotonie.
${effectiveModelLevel === 'pro' ? '- **Falls angebracht** (Business/Strategie), beende mit „Mein Vorschlag – Ultimatives Setup“.' : ''}
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
              { role: 'system', content: systemPrompt }, // NEU: dynamischer Prompt
              ...body.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content ?? '' })),
              { role: 'user', content: parts },
            ];

            const completion = await openai.chat.completions.create({
              model: chosenModel as any, // NEU: dynamisches Modell
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
                model: chosenModel as any,
                stream: false,
                ...OPENAI_GEN,
                messages: [
                  { role: 'system', content: systemPrompt },
                  {
                    role: 'user',
                    content: `Überarbeite den folgenden Entwurf minimal:
- bessere Struktur (mit #, ##, ### Überschriften), Dopplungen kürzen
- klare Checklisten/Beispiele einbauen, wo sinnvoll
- inhaltlich nichts Neues erfinden, Ton & Sprache beibehalten
${effectiveModelLevel === 'pro' ? '- stelle sicher, dass **falls es ein Business-Thema ist**, ein Abschluss „Mein Vorschlag – Ultimatives Setup“ vorhanden ist.' : ''}
--- ENTWURF ---
${assistantText}`,
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
            console.log(`🚀 [Gemini Stream] Effektives Modell: ${chosenModel}`);

            const vertex_ai = new VertexAI({
              project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
              location: 'us-central1',
            });

            const model = vertex_ai.getGenerativeModel({
              model: chosenModel, // NEU: dynamisches Modell
              systemInstruction: systemPrompt, // NEU: dynamischer Prompt
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
            
            // ... (Refine-Pass für Gemini, falls DO_REFINE = true) ...
            
          }

          // **Failsafe: Abschluss-Block anhängen (unverändert)**
          // Diese Logik funktioniert weiterhin perfekt für den "Schnelle Zusammenfassung"-Pfad.
          // Bei "SIMPLE"-Chats wird isProfessionalQuery() false sein.
          const withClosing = ensureClosingSection(assistantText, last.content);
          if (withClosing.length > assistantText.length) {
            const append = withClosing.slice(assistantText.length);
            send({ type: 'delta', text: append });
            assistantText = withClosing;
          }

          // Antwort speichern
          await prisma.message.create({
            data: { 
              chatId: chat.id, 
              role: 'assistant', 
              content: assistantText, 
              model: chosenModel // NEU: Speichere das *effektiv genutzte* Modell
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