// app/api/stripe/customer-portal/route.ts
import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/auth';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST(req: Request) {
  try {
    const user = await ensureUser();
    const email = user.email;
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    let customer = (await stripe.customers.list({ email, limit: 1 })).data[0];
    if (!customer) {
      customer = await stripe.customers.create({ email, metadata: { userId: user.id } });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('POST /api/stripe/customer-portal error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
