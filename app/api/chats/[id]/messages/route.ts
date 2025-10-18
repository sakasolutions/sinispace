// app/api/chats/[id]/messages/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrismaUserFromSession } from '@/lib/auth'; // GEÄNDERT: Neue Import-Funktion

// WICHTIG: Cache-Killer für alle GET-Anfragen auf dieser Route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // GEÄNDERT: Direkter, zuverlässiger User-Check
    const user = await getPrismaUserFromSession();

    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id }, // Dieser Filter ist jetzt zuverlässig
      select: { id: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (e: any) {
    console.error('GET /api/chats/[id]/messages error:', e);
    if (e.message.includes('Nicht autorisiert')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // GEÄNDERT: Direkter, zuverlässiger User-Check
    const user = await getPrismaUserFromSession();

    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id }, // Dieser Filter ist jetzt zuverlässig
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
  } catch (e: any) {
    console.error('POST /api/chats/[id]/messages error:', e);
    if (e.message.includes('Nicht autorisiert')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}