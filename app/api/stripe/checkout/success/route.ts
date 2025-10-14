// app/api/stripe/checkout/success/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function GET(req: Request) {
  try {
    const user = await ensureUser();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    const sub = session.subscription as Stripe.Subscription | null;
    const customer = session.customer as Stripe.Customer | null;

    if (sub && customer) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: customer.id,
          subscriptionId: sub.id,
          subscriptionEnd: new Date(sub.current_period_end * 1000),
        },
      });
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);
  } catch (e) {
    console.error('GET /api/stripe/checkout/success error', e);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);
  }
}
