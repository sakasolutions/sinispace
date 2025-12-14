// app/api/stripe/cancel/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-10-29.clover' });

export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.subscriptionId) {
      return NextResponse.json({ error: 'Kein aktives Abo' }, { status: 400 });
    }

    const updated = await stripe.subscriptions.update(dbUser.subscriptionId, { cancel_at_period_end: true });
    return NextResponse.json({ ok: true, cancelAtPeriodEnd: updated.cancel_at_period_end });
  } catch (e) {
    console.error('cancel error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
