// app/api/chats/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';

export const runtime = 'nodejs';

const getId = (ctx: any) => {
  const v = ctx?.params?.id;
  return Array.isArray(v) ? v[0] : v;
};

/** PATCH – Chat aktualisieren (Titel, Modell) */
export async function PATCH(req: Request, ctx: any) {
  try {
    const id = getId(ctx);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const user = await ensureUser();
    const patch = (await req.json()) as { title?: string; model?: string };

    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id },
      select: { id: true, title: true, model: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

/** DELETE – Chat + Messages + Usage löschen */
export async function DELETE(_req: Request, ctx: any) {
  try {
    const id = getId(ctx);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const user = await ensureUser();

    const chat = await prisma.chat.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.$transaction([
      prisma.usage.deleteMany({ where: { chatId: chat.id } }),
      prisma.message.deleteMany({ where: { chatId: chat.id } }),
      prisma.chat.delete({ where: { id: chat.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('DELETE /api/chats/:id error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
