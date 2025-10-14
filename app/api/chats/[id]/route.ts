// app/api/chats/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';

type Ctx = { params: { id: string } };

/**
 * PATCH – Chat aktualisieren (Titel, Modell)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await ensureUser();
    const patch = (await req.json()) as { title?: string; model?: string };

    // Chat gehört dem eingeloggten User?
    const chat = await prisma.chat.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, title: true, model: true },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Titel/Modell aktualisieren
    const updated = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title ?? chat.title } : {}),
        ...(patch.model !== undefined ? { model: patch.model ?? chat.model } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('PATCH /api/chats/:id error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE – Chat + zugehörige Messages & Usage-Einträge löschen
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await ensureUser();

    // Sicherstellen, dass Chat dem User gehört
    const chat = await prisma.chat.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Löschen in einer Transaktion (Usage → Messages → Chat)
    await prisma.$transaction([
      prisma.usage.deleteMany({ where: { chatId: chat.id } }),
      prisma.message.deleteMany({ where: { chatId: chat.id } }),
      prisma.chat.delete({ where: { id: chat.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    console.error('DELETE /api/chats/:id error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
