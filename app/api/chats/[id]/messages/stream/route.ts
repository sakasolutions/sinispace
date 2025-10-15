// app/api/chats/[id]/messages/stream/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';
import OpenAI from 'openai';
// 1. KORREKTUR: Die alte Google-Bibliothek wird durch die neue, korrekte Vertex AI-Bibliothek ersetzt.
import { VertexAI } from '@google-cloud/vertexai';
import { readFile } from 'fs/promises';
import path from 'path';

// Prisma/Streaming brauchen Node
export const runtime = 'nodejs';
// Wichtig, damit die Umgebungsvariablen zur Laufzeit verfügbar sind
export const dynamic = 'force-dynamic';

// Der OpenAI-Client bleibt, wie er ist. Perfekt.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
// 2. ÄNDERUNG: Die statische Initialisierung des alten Google-Clients wird entfernt.
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Alle deine Hilfsfunktionen bleiben exakt gleich. Sie sind perfekt.
const getId = (ctx: any) => {
  const v = ctx?.params?.id;
  return Array.isArray(v) ? v[0] : v;
};

function extractImageUrls(text: string) {
  const urls: string[] = [];
  const re = /!\[[^\]]*\]\((?<url>[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const u = m.groups?.url?.trim();
    if (u) urls.push(u);
  }
  return urls;
}

function guessMimeFromExt(ext: string) {
  const e = ext.toLowerCase().replace('.', '');
  if (e === 'png') return 'image/png';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

async function toInlineDataFromLocalUpload(urlPath: string) {
  const full = path.join(process.cwd(), 'public', decodeURIComponent(urlPath.replace(/^\/+/, '')));
  const buf = await readFile(full);
  return { inlineData: { data: buf.toString('base64'), mimeType: guessMimeFromExt(path.extname(full)) } };
}

async function toDataUrlFromLocalUpload(urlPath: string) {
  const full = path.join(process.cwd(), 'public', decodeURIComponent(urlPath.replace(/^\/+/, '')));
  const buf = await readFile(full);
  const mime = guessMimeFromExt(path.extname(full));
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export async function POST(req: Request, ctx: any) {
  try {
    const chatId = getId(ctx);
    if (!chatId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = (await req.json()) as {
      model?: 'gpt-4o-mini' | 'gemini-1.5-pro' | 'gemini-pro'; // gemini-pro hinzugefügt
      messages: Array<{ id?: string; role: 'user' | 'assistant' | 'system'; content: string }>;
    };

    const user = await ensureUser();
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

    await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: last.content } });

    let assistantText = '';

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(`data: ${JSON.stringify(obj)}\n\n`);

        try {
          const imageUrls = extractImageUrls(last.content);

          if (chosen.startsWith('gpt')) {
            // DEIN OPENAI-CODE BLEIBT 100% UNVERÄNDERT. ER IST PERFEKT.
            const parts: any[] = [{ type: 'text', text: last.content }];
            for (const url of imageUrls) {
              if (/^https?:\/\//i.test(url)) parts.push({ type: 'image_url', image_url: { url } });
              else if (url.startsWith('/uploads/')) {
                const dataUrl = await toDataUrlFromLocalUpload(url);
                parts.push({ type: 'image_url', image_url: { url: dataUrl } });
              }
            }

            const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              ...body.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: parts },
            ];

            const completion = await openai.chat.completions.create({
              model: chosen as any,
              stream: true,
              messages: openaiMessages,
            });

            for await (const chunk of completion) {
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }
          } else {
            // 3. GROSSE KORREKTUR: HIER TAUSCHEN WIR DEN GEMINI-MOTOR AUS
            
            // Initialisiere den KORREKTEN Vertex AI Client
            const vertex_ai = new VertexAI({
              project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
              location: 'us-central1', // Dies ist eine gängige Region
            });

            // Wir nehmen den Modellnamen aus deiner `chosen` Variable
            const model = vertex_ai.getGenerativeModel({
              model: chosen,
            });

            const userParts: any[] = [{ text: last.content }];
            for (const url of imageUrls) {
              if (url.startsWith('/uploads/')) {
                const inlineDataPart = await toInlineDataFromLocalUpload(url);
                userParts.push(inlineDataPart);
              }
            }
            
            // Die Vertex-Bibliothek ist schlauer und kann mit der Historie umgehen
            const chat = model.startChat({
              history: body.messages.slice(0, -1).map((m) => ({
                  role: m.role === 'assistant' ? 'model' : m.role,
                  parts: [{ text: m.content }],
              })),
            });

            const result = await chat.sendMessageStream(userParts);

            for await (const chunk of result.stream) {
              const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
              if (delta) {
                assistantText += delta;
                send({ type: 'delta', text: delta });
              }
            }
          }

          await prisma.message.create({
            data: { chatId: chat.id, role: 'assistant', content: assistantText, model: chosen },
          });

          send({ type: 'usage', usage: {} });
          send({ type: 'done' });
          controller.close();
        } catch (err) {
          console.error('stream error:', err);
          send({ type: 'error', message: 'stream failed' });
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
  } catch (e) {
    console.error('POST /api/chats/[id]/messages/stream error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}