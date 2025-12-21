// app/api/stripe/checkout/route.ts



import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';
import Stripe from 'stripe';

export const runtime = 'nodejs'; // wichtig für Stripe SDK

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    let customerId = dbUser?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser?.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId!,
      line_items: [{ price: process.env.STRIPE_PRICE_YEARLY!, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('POST /api/stripe/checkout error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
