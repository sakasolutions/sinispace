// app/api/tools/rezept-bauer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung (Frontend -> Server) ---
const inputSchema = z.object({
  mainIngredients: z.string().min(5, 'Hauptzutaten müssen mindestens 5 Zeichen lang sein.'),
  pantryItems: z.string().optional(), // Standard-Zutaten sind optional
  diet: z.enum(['alles', 'vegetarisch', 'vegan', 'glutenfrei']),
  timeframe: z.enum(['schnell', 'mittel', 'egal']),
});

// --- Ausgabe-Validierung (AI -> Server) ---
// Wir definieren die genaue Struktur, die wir von der KI erwarten.
const outputSchema = z.object({
  recipe: z.object({
    title: z.string().min(1, 'Titel fehlt'),
    description: z.string().min(10, 'Beschreibung fehlt'),
    prepTime: z.string().min(3, 'Zubereitungszeit fehlt'),
    ingredients: z.string().min(10, 'Zutatenliste fehlt (muss Markdown sein)'),
    instructions: z.string().min(20, 'Anleitung fehlt (muss Markdown sein)'),
  }),
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
    
    const { 
      mainIngredients, 
      pantryItems, 
      diet, 
      timeframe 
    } = validation.data;

    // 2. Der spezialisierte System-Prompt
    const systemPrompt = `Du bist ein kreativer und erfahrener Koch (für SiniSpace). 
Deine Aufgabe ist es, ein einzelnes, köstliches Rezept zu erstellen, das primär die vom Nutzer genannten Hauptzutaten verwendet.

**Anweisungen:**
1.  **Priorität:** Die \`mainIngredients\` müssen die Basis des Rezepts bilden. Die \`pantryItems\` können ergänzend verwendet werden. Du darfst 1-2 weitere gängige Zutaten (z.B. ein spezifisches Gewürz, Milch) hinzufügen, wenn es das Rezept essentiell verbessert.
2.  **Filter:** Das Rezept muss die Ernährungsform \`${diet}\` strikt einhalten.
3.  **Zeit:** Der Zeitaufwand muss zu \`${timeframe}\` passen (schnell: < 20min, mittel: 30-45min).
4.  **JSON-Struktur:** Die Ausgabe MUSS ein JSON-Objekt sein. Dieses Objekt MUSS einen einzigen Key namens \`"recipe"\` haben.
5.  **Inhalt von "recipe":** Das \`"recipe"\`-Objekt MUSS 5 Keys haben:
    * \`"title"\`: (Ein kreativer, passender Name für das Gericht als String).
    * \`"description"\`: (Ein kurzer "Appetizer"-Text, 1-2 Sätze, als String).
    * \`"prepTime"\`: (Die geschätzte Zubereitungszeit, z.B. "ca. 20 Minuten", als String).
    * \`"ingredients"\`: (Eine Zutatenliste als Markdown-Liste. Nenne genaue Mengen, z.B. "200g Hähnchenbrust").
    * \`"instructions"\`: (Die Zubereitungsschritte als nummerierte Markdown-Liste).

**Beispiel-Output:**
{
  "recipe": {
    "title": "Schnelle Hähnchen-Paprika-Pfanne",
    "description": "Ein einfaches und würziges Pfannengericht, perfekt für einen schnellen Feierabend.",
    "prepTime": "ca. 15 Minuten",
    "ingredients": "- 200g Hähnchenbrust\\n- 1 Rote Paprika\\n- 1 Zwiebel\\n- 2 EL Olivenöl\\n- Salz & Pfeffer",
    "instructions": "1. Hähnchenbrust in Streifen schneiden.\\n2. Paprika und Zwiebel würfeln.\\n3. Öl in einer Pfanne erhitzen..."
  }
}`;

    const userPrompt = `Bitte erstelle ein Rezept mit den folgenden Spezifikationen:
- **Hauptzutaten:** ${mainIngredients}
- **Standard-Zutaten (Vorratskammer):** ${pantryItems || 'Keine Angabe'}
- **Ernährungsform:** ${diet}
- **Zeitaufwand:** ${timeframe}`;

    // 3. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // Kreativer bei Rezepten
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 4. Antwort parsen UND mit Zod validieren
    const parsedJson = JSON.parse(content);
    const outputValidation = outputSchema.safeParse(parsedJson);

    if (!outputValidation.success) {
      console.error("KI-Antwort entsprach nicht der Zod-Struktur:", outputValidation.error.flatten());
      console.error("Empfangene Daten von KI:", content); 
      throw new Error('Die KI hat eine unerwartete Datenstruktur geliefert.');
    }

    // 'outputValidation.data' ist jetzt typsicher.
    // Das Frontend erwartet { recipe: { ... } }
    return NextResponse.json(outputValidation.data); 

  } catch (error: any) {
    console.error('Fehler in /api/tools/rezept-bauer:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}