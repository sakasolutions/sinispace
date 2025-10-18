// app/api/user-data/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// --- Firebase Admin SDK initialisieren ---
const serviceAccountPath = path.resolve(process.cwd(), 'service-account-key.json');

if (!admin.apps.length) {
  try {
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Die Datei "service-account-key.json" wurde nicht im Projekt-Root gefunden. Pfad: ${serviceAccountPath}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Firebase Admin Initialisierung fehlgeschlagen:', e.message);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// --- Der GET-Handler ---
export async function GET(request: Request) {
  if (!admin.apps.length) {
    return NextResponse.json({ error: 'Firebase Admin SDK ist nicht initialisiert. Prüfe die service-account-key.json.' }, { status: 500 });
  }
  
  try {
    // 1. Token holen und verifizieren
    const authorization = headers().get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nicht autorisiert (Kein Token)' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: 'Ungültiges Token' }, { status: 403 });
    }
    
    const uid = decodedToken.uid;
    const email = decodedToken.email || 'E-Mail nicht gefunden';

    // 2. Firestore-Dokument holen
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    // 3. HIER IST DIE AUTOMATISIERUNG!
    if (!userDoc.exists) {
      // Nutzer ist in Auth, aber nicht in Firestore DB
      // NEU: Wir legen den Nutzer jetzt automatisch an!
      try {
        await userDocRef.set({
          email: email,
          subscriptionEnd: null, // Standardmäßig kein Abo
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Sende die gerade erstellten (leeren) Daten zurück
        return NextResponse.json({ 
          email: email, 
          subscriptionEnd: null,
        });

      } catch (createError: any) {
        console.error(`Fehler beim Erstellen von User-Dokument ${uid}:`, createError);
        return NextResponse.json({ error: 'User-Dokument konnte nicht erstellt werden' }, { status: 500 });
      }
    }
    
    // 4. Nutzer existiert bereits, Daten zurücksenden
    const userData = userDoc.data();
    return NextResponse.json({
      email: email,
      subscriptionEnd: userData?.subscriptionEnd?.toDate?.()?.toISOString() || userData?.subscriptionEnd || null,
    });

  } catch (error: any) {
    console.error('Fehler in /api/user-data:', error.message);
    return NextResponse.json({ error: 'Interner Serverfehler', details: error.message }, { status: 500 });
  }
}