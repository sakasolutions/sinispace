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

/** ---------- System-Prompt (Qualität & Stil) ---------- */
const SYSTEM_PROMPT = `
Du bist „SiniSpace Assistant“. Sprich standardmäßig DEUTSCH.

PRINZIPIEN:
1) Wahrheit & Genauigkeit zuerst. Keine erfundenen Fakten/Quellen. Unklar? Sag offen „weiß ich nicht“ + schlage den nächsten sinnvollen Schritt vor.
2) Struktur: Beginne IMMER mit einer **Kurzfassung** (2–4 Sätze). Nutze Markdown (H1–H3, Listen, **fett**). Keine unnötigen Wiederholungen.
3) Bei Logik/Mathe/Code: zeige nachvollziehbare, knappe Schritte. Code mit korrektem Fence (\`\`\`ts, \`\`\`bash etc.).
4) Effektiv mitdenken: Liefere die Lösung + ggf. 1–2 sinnvolle Alternativen/Verbesserungen. Wo sinnvoll: kurze Checklisten/Beispiele.
5) Halte dich an die Nutzersprache (Standard: Deutsch). Antworte prägnant, freundlich, professionell.
6) Denke BEVOR du antwortest kurz über Absicht → Plan → finale Antwort nach. Erzeuge als Ausgabe nur die finale Antwort, nicht deine Notizen.
7) Zielqualität: Antworten sollen dem Niveau von ChatGPT-4o / Gemini Pro entsprechen – tiefgründig, hilfreich, natürlich formuliert.
`.trim();

/** ---------- Qualitäts-Defaults (zentral) ---------- */
const OPENAI_GEN = {
  temperature: 0.35,
  top_p: 0.9,
  max_tokens: 8192,          // ggf. auf 4096/3072 senken, falls Modell-/Quota-Limits greifen
  presence_penalty: 0.3,
  frequency_penalty: 0.25,
} as const;

const GEMINI_GEN = {
  temperature: 0.35,
  topP: 0.9,
  topK: 64,
  maxOutputTokens: 8192,      // ggf. reduzieren, falls Limits greifen
  // responseMimeType: 'text/markdown', // aktivieren, wenn in deiner Vertex-Version unterstützt
} as const;

/** ---------- Optional: 2. Pass zur Mini-Verfeinerung ---------- */
const DO_REFINE = false;        // auf true setzen, wenn nach dem Stream eine kurze Politur gewünscht ist
const REFINE_TRIGGER_LEN = 1200;

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

            // Multimodal: Text + ggf. Bilder
            const parts: any[] = [{ type: 'text', text: `${last.content ?? ''}\n\nBitte überarbeite deine eigene Antwort während des Schreibens: gliedere klar mit H1/H2/H3, streiche Dopplungen, füge wo sinnvoll kurze Checklisten/Beispiele hinzu.` }];
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

            // Userturn (Text + Bilder)
            const userParts: Part[] = [{
              text: `${last.content ?? ''}\n\nBitte überarbeite deine eigene Antwort während des Schreibens: gliedere klar mit H1/H2/H3, streiche Dopplungen, füge wo sinnvoll kurze Checklisten/Beispiele hinzu.`,
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

--- ENTWURF ---
${assistantText}`,
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
