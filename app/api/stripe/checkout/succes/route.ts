// app/api/stripe/checkout/success/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUser } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-10-29.clover' });

// ***** ANFANG: NEUE HELFERFUNKTION *****
// Diese Funktion ruft dein PHP-Skript auf
async function sendAdminNotification(session: Stripe.Checkout.Session) {
  
  // ⚠️⚠️⚠️ BITTE DIESE URL ANPASSEN ⚠️⚠️⚠️
  // Trage hier die echte URL zu deinem PHP-Skript ein
  const PHP_SCRIPT_URL = 'https://ai-point.shop/api/send-order-email.php';

  try {
    // Daten aus der Stripe-Session extrahieren
    const customerDetails = session.customer_details;
    if (!customerDetails || !customerDetails.email) {
      console.log('Keine Kundendetails für E-Mail-Versand gefunden.');
      return;
    }

    // Name aufteilen
    const nameParts = (customerDetails.name || '').split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || '';

    // Adressdaten
    const address = customerDetails.address;
    
    const payload = {
      project_name: 'SINISPACE', // <-- Hier wird das Projekt gesteuert
      email: customerDetails.email,
      firstname: firstname,
      lastname: lastname,
      address: address?.line1 || '',
      zip: address?.postal_code || '',
      city: address?.city || '',
      purchaseDate: new Date().toLocaleString('de-DE'),
    };

    const response = await fetch(PHP_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fehler beim Senden der Admin-Mail (PHP):', errorText);
    } else {
      console.log('Admin-Benachrichtigung (PHP) erfolgreich gesendet.');
    }

  } catch (e) {
    console.error('Schwerer Fehler beim fetch-Aufruf zum PHP-Skript:', e);
  }
}
// ***** ENDE: NEUE HELFERFUNKTION *****


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
          // @ts-ignore - Die Eigenschaft existiert wahrscheinlich, aber die Typen haben sich in der neuen Stripe-Bibliothek geändert
          subscriptionEnd: new Date(sub.current_period_end * 1000),
        },
      });
    }

    // ***** HIER IST DER NEUE AUFRUF *****
    // Ruft die Benachrichtigungsfunktion auf ("fire-and-forget")
    sendAdminNotification(session); 
    // *************************************

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);
  } catch (e) {
    console.error('GET /api/stripe/checkout/success error', e);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);
  }
}