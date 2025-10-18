// app/api/chats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPrismaUserFromSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getPrismaUserFromSession();
    
    const chats = await prisma.chat.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(chats);
  } catch (e: any) {
    console.error('GET /api/chats error:', e);
    if (e.message.includes('Nicht autorisiert')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getPrismaUserFromSession();
    // GEÄNDERT: Explizit den Typ für das erwartete Modell definieren
    const { model }: { model?: 'gpt-4o' | 'gpt-4o-mini' | 'gemini-1.5-pro' | 'gemini-2.5-pro' } = await req.json();

    const chat = await prisma.chat.create({
      data: {
        userId: user.id,
        // Fallback bleibt 'gpt-4o', aber das gesendete 'gemini-2.5-pro' wird korrekt übernommen
        model: model ?? 'gpt-4o', 
        title: 'Neuer Chat',
      },
    });

    return NextResponse.json(chat);
  } catch (e: any) {
    console.error('POST /api/chats error:', e);
    if (e.message.includes('Nicht autorisiert')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}