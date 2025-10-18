// app/api/chats/[id]/messages/stream/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrismaUserFromSession } from '@/lib/auth';
import OpenAI from 'openai';
import { VertexAI, Part } from '@google-cloud/vertexai'; // Nur VertexAI importieren
import { readFile } from 'fs/promises';
import path from 'path';
// KEIN Import von GoogleAuth mehr nötig

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// --- Hilfsfunktionen ---
const getId = (ctx: any) => {
  const v = ctx?.params?.id;
  return Array.isArray(v) ? v[0] : v;
};

function extractImageUrls(text: string | null | undefined): string[] {
  const urls: string[] = [];
  if (typeof text !== 'string' || !text) {
      return urls;
  }
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
  return 'application/octet-stream'; // Fallback
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
    // Versuche Mime aus Endung zu raten, wenn der ContentType nicht passt
    const validMime = contentType.startsWith('image/') ? contentType.split(';')[0] : guessMimeFromExt(path.extname(new URL(url).pathname));
    // Fallback auf jpeg, wenn alles fehlschlägt
    const finalMime = validMime !== 'application/octet-stream' ? validMime : 'image/jpeg';
    return { inlineData: { data: base64Data, mimeType: finalMime } };
  } catch (error) {
    console.error(`Error fetching image ${url}:`, error);
    return null;
  }
}
// --- Ende Hilfsfunktionen ---

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
    if (!Array.isArray(body.messages) || body.messages.length === 0) return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    const last = body.messages[body.messages.length - 1];
    if (last.role !== 'user') return NextResponse.json({ error: 'Last message must be user' }, { status: 400 });

    await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: last.content } });

    let assistantText = '';
    const imageUrls = extractImageUrls(last.content);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(`data: ${JSON.stringify(obj)}\n\n`);

        try {
          if (chosen.startsWith('gpt')) {
            // OpenAI Logik
            console.log(`🚀 [OpenAI Stream] Sende Anfrage an Modell: ${chosen}`);
            const parts: any[] = [{ type: 'text', text: last.content ?? '' }];
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
              ...body.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content ?? '' })),
              { role: 'user', content: parts },
            ];
            const completion = await openai.chat.completions.create({ model: chosen as any, stream: true, messages: openaiMessages });
            for await (const chunk of completion) {
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }

          } else { // Gemini Logik
            console.log(`🚀 [Gemini Stream] Sende Anfrage an Modell: ${chosen}`);

            // ======================================================
            // VERSUCH 3: Standard-Authentifizierung über Umgebungsvariable (Dateipfad)
            // ======================================================
            // Wir verlassen uns darauf, dass GOOGLE_APPLICATION_CREDENTIALS in .env.local gesetzt ist
            // und initialisieren VertexAI OHNE explizite Credentials.
            // Stelle sicher, dass GOOGLE_APPLICATION_CREDENTIALS="./gcp-service-account.json"
            // in deiner .env.local steht und die Datei im Projekt-Root liegt.
            const vertex_ai = new VertexAI({
              project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
              location: 'us-central1',
              // KEINE googleAuthOptions oder credentials hier!
            });
            // ======================================================
            // ENDE VERSUCH 3
            // ======================================================

            const model = vertex_ai.getGenerativeModel({ model: chosen });
            const userParts: Part[] = [{ text: last.content ?? '' }];
            for (const url of imageUrls) {
              let imagePart: Part | null = null;
              if (url.startsWith('/uploads/')) {
                imagePart = await toInlineDataFromLocalUpload(url);
              } else if (/^https?:\/\//i.test(url)) {
                imagePart = await fetchImageAsBase64Part(url);
              }
              if (imagePart) {
                userParts.push(imagePart);
              } else {
                 console.warn(`Konnte Bild ${url} nicht verarbeiten oder laden.`);
              }
            }

            const history = body.messages.slice(0, -1).map((m) => ({
                role: m.role === 'assistant' ? 'model' : m.role,
                parts: [{ text: m.content ?? '' }],
            }));

            const chatSession = model.startChat({ history });
            const result = await chatSession.sendMessageStream(userParts);
            for await (const chunk of result.stream) {
              const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }
          }

          // Speichern der Assistant-Nachricht
          await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: assistantText, model: chosen },
          });
          send({ type: 'usage', usage: {} });
          send({ type: 'done' });
          controller.close();
        } catch (err) {
          console.error('stream error:', err);
          const errorMessage = err instanceof Error ? err.message : 'An unknown stream error occurred';
          console.error('API Error details:', err); // Behalte dieses Logging!
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
    if (e.message.includes('Nicht autorisiert')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}