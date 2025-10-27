// app/api/tools/social-post/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung mit Zod ---
// Stellt sicher, dass die Daten vom Frontend im richtigen Format ankommen.
const inputSchema = z.object({
  topic: z.string().min(5, 'Das Thema muss mindestens 5 Zeichen lang sein.'),
  audience: z.string().min(3, 'Die Zielgruppe muss mindestens 3 Zeichen lang sein.'),
  tone: z.enum(['professionell', 'lustig', 'inspirierend', 'locker', 'informativ']),
  count: z.number().min(1, 'Es muss mindestens 1 Variante sein.').max(5, 'Es dürfen maximal 5 Varianten sein.'),
});

// --- OpenAI-Client Initialisierung ---
// HINWEIS: Wenn du deinen OpenAI-Client bereits in einer
// separaten Datei (z.B. in 'lib/openai.ts') initialisiert hast,
// importiere ihn stattdessen von dort.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Stellt sicher, dass dein API-Key in .env.local hinterlegt ist
});

// --- Die POST-Funktion ---
export async function POST(req: NextRequest) {
  try {
    // 1. Body aus der Anfrage lesen
    const body = await req.json();

    // 2. Body validieren
    const validation = inputSchema.safeParse(body);
    if (!validation.success) {
      console.warn('Ungültige Anfrage:', validation.error.flatten());
      return NextResponse.json(
        { error: 'Ungültige Eingabedaten.', details: validation.error.flatten() },
        { status: 400 } // 400 = Bad Request
      );
    }
    
    // Gültige Daten extrahieren
    const { topic, audience, tone, count } = validation.data;

    // 3. Spezialisierten System-Prompt bauen
    const systemPrompt = `Du bist ein Experte für Social Media Marketing. 
Deine Aufgabe ist es, ${count} verschiedene, kreative Social-Media-Post-Vorschläge zu generieren.
Die Tonalität muss ${tone} sein.
Die Zielgruppe ist: ${audience}.

Du MUSST deine Antwort ausschließlich als JSON-Objekt formatieren.
Das Objekt soll einen einzigen Key namens "variations" haben.
Der Wert von "variations" MUSS ein Array von Strings sein. Jeder String ist ein vollständiger Post-Vorschlag.

Beispiel-Output:
{
  "variations": [
    "Vorschlag 1... (inkl. Emojis)",
    "Vorschlag 2... (inkl. Hashtags)"
  ]
}`;

    const userPrompt = `Thema: ${topic}`;

    // 4. OpenAI API aufrufen (GPT-4o mit JSON-Modus)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Premium-Modell für zuverlässiges JSON
      response_format: { type: 'json_object' }, // JSON-Modus erzwingen
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // Etwas kreativer als Standard
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 5. Antwort-JSON parsen (obwohl es schon JSON sein sollte, zur Sicherheit)
    const parsedJson = JSON.parse(content);

    // 6. Gültige JSON-Antwort an das Frontend zurücksenden
    // Das Frontend erwartet { variations: [...] }
    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error('Fehler in /api/tools/social-post:', error);
    
    let errorMessage = 'Ein interner Serverfehler ist aufgetreten.';
    if (error.name === 'SyntaxError') { // Spezieller Fehler, falls die KI kein gültiges JSON liefert
      errorMessage = 'Die KI hat eine ungültige JSON-Struktur geliefert.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}