// app/api/tools/social-post/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung (Frontend -> Server) ---
// +++ VÖLLIG NEUES SCHEMA, BASIEREND AUF DER NEUEN UI +++
const inputSchema = z.object({
  platform: z.enum(['instagram', 'linkedin', 'facebook', 'x-twitter']),
  goal: z.string().min(3, 'Ein Ziel muss ausgewählt werden.'),
  keyPoints: z.string().min(5, 'Die Stichpunkte müssen mindestens 5 Zeichen lang sein.'),
  tone: z.enum(['professionell', 'lustig', 'inspirierend', 'locker', 'informativ']),
  count: z.number().min(1).max(3), // Max 3, um Qualität hoch zu halten
});

// --- Ausgabe-Validierung (AI -> Server) ---
// +++ DAS NEUE "POST-KIT"-SCHEMA (DAS IST DER GAME-CHANGER) +++
const outputSchema = z.object({
  variations: z.array(
    z.object({
      title: z.string().min(1, 'Titel fehlt'),
      text: z.string().min(10, 'Post-Text fehlt'),
      visualSuggestion: z.string().min(10, 'Vorschlag für Visual fehlt'),
      hashtags: z.string().min(3, 'Hashtags fehlen'),
      ctaSuggestion: z.string().min(3, 'Call-to-Action fehlt'),
    })
  ).min(1, 'Es muss mindestens eine Variante geben.'),
});

// --- OpenAI-Client Initialisierung ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Die POST-Funktion ---
export async function POST(req: NextRequest) {
  try {
    // 1. Body lesen und validieren
    const body = await req.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Ungültige Eingabedaten.', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    // Gültige Daten extrahieren
    const { platform, goal, keyPoints, tone, count } = validation.data;

    // 3. Spezialisierter System-Prompt (KOMPLETT NEU)
    const systemPrompt = `Du bist ein Weltklasse Social Media Manager (für SiniSpace). 
Deine Aufgabe ist es, ${count} verschiedene, komplette "Social Media Post-Kits" zu erstellen.

**Anweisungen:**
1.  **Plattform:** Die Posts MÜSSEN für ${platform} optimiert sein. (z.B. LinkedIn = professionell, 1-2 Hashtags; Instagram = Emojis, viele Hashtags; X = kurz & knapp).
2.  **Ziel:** Das Ziel des Posts ist: "${goal}".
3.  **Tonalität:** Die Tonalität muss ${tone} sein.
4.  **JSON-Struktur:** Die Ausgabe MUSS ein JSON-Objekt sein mit einem Key \`"variations"\`.
5.  **"variations":** MUSS ein Array von \`${count}\` Post-Kit-Objekten sein.
6.  **JEDES Post-Kit-Objekt MUSS 5 Keys haben:**
    * \`"title"\`: Ein interner Titel/Name für diese Post-Idee (z.B. "Der 'Problem-Lösung'-Ansatz" or "Der 'Kunden-Testimonial'-Post").
    * \`"text"\`: Der vollständige Post-Text, perfekt formatiert für ${platform} (inkl. Emojis, Absätzen).
    * \`"visualSuggestion"\`: Ein **konkreter, umsetzbarer Vorschlag** für das Bild oder Video (z.B. "Ein kurzes Reel, das den 'Vorher/Nachher'-Effekt zeigt." oder "Ein minimalistisches Zitat-Bild mit Firmenlogo.").
    * \`"hashtags"\`: Eine Liste relevanter Hashtags als einzelner String (z.B. "#neuesprodukt #rabatt #tech").
    * \`"ctaSuggestion"\`: Ein klarer Call-to-Action (z.B. "Klicke jetzt den Link in der Bio!" oder "Stell deine Frage in den Kommentaren!").

**Beispiel-Output:**
{
  "variations": [
    {
      "title": "Vorschlag 1: Der 'Frage-Hook'",
      "text": "Bist du es leid, müde zu sein? 😴 Unser SiniBoost ist da! ...",
      "visualSuggestion": "Ein kurzes, schnelles Reel, das eine müde Person zeigt, die SiniBoost nimmt und dann energiegeladen ist.",
      "hashtags": "#siniboost #energie #rabatt",
      "ctaSuggestion": "Sichere dir 20% Rabatt - Link in der Bio!"
    }
  ]
}`;

    const userPrompt = `Hier sind die Kern-Infos für die Posts:
"${keyPoints}"`;

    // 4. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2500,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 5. Antwort parsen UND mit Zod validieren
    const parsedJson = JSON.parse(content);
    const outputValidation = outputSchema.safeParse(parsedJson);

    if (!outputValidation.success) {
      console.error("KI-Antwort (Social) entsprach nicht der Zod-Struktur:", outputValidation.error.flatten());
      console.error("Empfangene Daten von KI (Social):", content); 
      throw new Error('Die KI hat eine unerwartete Datenstruktur geliefert.');
    }

    // Das Frontend erwartet { variations: [...] }
    return NextResponse.json(outputValidation.data);

  } catch (error: any) {
    console.error('Fehler in /api/tools/social-post:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}