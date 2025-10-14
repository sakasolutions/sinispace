// app/api/chats/[id]/messages/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';

// Prisma braucht Node
export const runtime = 'nodejs';

// Wir definieren den Typ jetzt direkt in der Funktion unten
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params; // Direkter Zugriff auf die ID
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const user = await ensureUser();

    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (e) {
    console.error('GET /api/chats/[id]/messages error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Wir definieren den Typ auch hier direkt in der Funktion
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params; // Auch hier direkter Zugriff
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const user = await ensureUser();

    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { role, content, model } = (await req.json()) as {
      role: 'user' | 'assistant' | 'system';
      content: string;
      model?: string;
    };

    if (!role || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const msg = await prisma.message.create({
      data: { chatId: chat.id, role, content, model },
    });

    return NextResponse.json(msg, { status: 201 });
  } catch (e) {
    console.error('POST /api/chats/[id]/messages error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}