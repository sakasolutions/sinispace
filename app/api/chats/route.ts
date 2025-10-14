// app/api/chats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await ensureUser();
    const chats = await prisma.chat.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(chats);
  } catch (e: any) {
    console.error('GET /api/chats error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const { model } = await req.json();

    const chat = await prisma.chat.create({
      data: {
        userId: user.id,
        model: model ?? 'gpt-4o-mini',
        title: 'Neuer Chat',
      },
    });

    return NextResponse.json(chat);
  } catch (e: any) {
    console.error('POST /api/chats error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
