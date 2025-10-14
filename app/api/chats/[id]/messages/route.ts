// app/api/chats/[id]/messages/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';

// WICHTIG: Keine Edge-Runtime hier, Prisma braucht Node
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await ensureUser();

    // gehört der Chat dem User?
    const chat = await prisma.chat.findFirst({
      where: { id: params.id, userId: user.id },
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await ensureUser();

    // gehört der Chat dem User?
    const chat = await prisma.chat.findFirst({
      where: { id: params.id, userId: user.id },
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
      data: {
        chatId: chat.id,
        role,
        content,
        model,
      },
    });

    return NextResponse.json(msg, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/chats/[id]/messages error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
