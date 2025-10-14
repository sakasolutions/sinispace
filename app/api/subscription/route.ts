import { NextResponse } from 'next/server';
import { ensureUser } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

export async function GET(req: Request) {
  try {
    const authed = await ensureUser();

    const url = new URL(req.url);
    // Optional: ?email=override@example.com – zum Testen einer anderen Rechnungs-E-Mail
    const overrideEmail = url.searchParams.get('email')?.trim().toLowerCase() || null;

    const email = (overrideEmail || authed.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ hasSubscription: false, reason: 'no_email' });

    // Kunden per Such-API holen (präziser als list)
    const customers = (await stripe.customers.search({
      query: `email:"${email}"`,
      limit: 20,
    })).data;

    if (customers.length === 0) {
      return NextResponse.json({ hasSubscription: false, reason: 'no_customer', emailUsed: email });
    }

    // Neueste/„beste“ Subscription finden
    let best: Stripe.Subscription | null = null;
    for (const c of customers) {
      const subs = (await stripe.subscriptions.list({
        customer: c.id,
        status: 'all',
        limit: 20,
      })).data;

      for (const s of subs) {
        // @ts-ignore - Die Eigenschaft existiert, aber die Typen sind in der neuen Stripe-Bibliothek veraltet
        if (!best || (s.current_period_end ?? 0) > (best.current_period_end ?? 0)) {
          best = s;
        }
      }
    }

    if (!best) {
      return NextResponse.json({ hasSubscription: false, reason: 'no_subscription', emailUsed: email });
    }

    return NextResponse.json({
      hasSubscription: true,
      status: best.status,
      cancelAtPeriodEnd: best.cancel_at_period_end,
      // @ts-ignore - Auch hier sind die Typen veraltet
      currentPeriodEnd: new Date(best.current_period_end * 1000),
      emailUsed: email,
    });
  } catch (e) {
    console.error('GET /api/subscription error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}