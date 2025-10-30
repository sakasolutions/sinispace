// app/api/tools/shopping-list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung (Frontend -> Server) ---
const inputSchema = z.object({
  userIngredients: z.array(z.string()).min(1, 'Es müssen Zutaten vom Nutzer vorhanden sein.'),
  recipeIngredients: z.string().min(10, 'Die Rezept-Zutatenliste fehlt.'), // Kommt als Markdown-String
});

// --- Ausgabe-Validierung (AI -> Server) ---
const outputSchema = z.object({
  shoppingList: z.string().min(1, 'Die Einkaufsliste ist leer.'), // Als Markdown-Liste
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
      userIngredients, 
      recipeIngredients
    } = validation.data;

    // 2. Der spezialisierte System-Prompt
    const systemPrompt = `Du bist ein präziser Einkaufslisten-Assistent. 
Deine Aufgabe ist es, eine Liste von Rezept-Zutaten mit den Zutaten zu vergleichen, die der Nutzer bereits besitzt, und NUR die fehlenden Artikel aufzulisten.

**Anweisungen:**
1.  **JSON-Struktur:** Die Ausgabe MUSS ein JSON-Objekt sein mit einem einzigen Key namens \`"shoppingList"\`.
2.  **Vergleich:** Vergleiche die \`recipeIngredients\` (Liste A) mit den \`userIngredients\` (Liste B).
3.  **Intelligenz:** Sei intelligent beim Abgleich. Wenn der Nutzer "Hähnchen" (Liste B) hat, braucht er "200g Hähnchenbrust" (Liste A) NICHT zu kaufen. Wenn der Nutzer "Milch" hat, braucht er "100ml Milch" nicht zu kaufen. Standard-Gewürze (Salz, Pfeffer), die der Nutzer fast sicher hat (auch wenn sie nicht in Liste B stehen), sollten ignoriert werden, *es sei denn*, es ist ein sehr spezifisches Gewürz (z.B. "Safran").
4.  **Ausgabe:** Der Wert von \`"shoppingList"\` MUSS eine Markdown-Liste (mit \`-\`) der Zutaten aus Liste A sein, die NICHT in Liste B vorhanden sind.
5.  **Keine Treffer:** Wenn ALLE Zutaten bereits vorhanden sind, gib den Text "Du hast bereits alle Zutaten!" zurück.

**Beispiel-Output:**
{
  "shoppingList": "- 1 Dose Kokosmilch\\n- 1 EL Rote Currypaste"
}`;

    const userPrompt = `
**Rezept-Zutaten (Liste A):**
${recipeIngredients}

**Meine Zutaten (Liste B):**
${userIngredients.join(', ')}

Bitte erstelle die Einkaufsliste (nur die fehlenden Zutaten).`;

    // 3. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Präzision ist hier wichtig
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Sehr präzise, nicht kreativ
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 4. Antwort parsen UND mit Zod validieren
    const parsedJson = JSON.parse(content);
    const outputValidation = outputSchema.safeParse(parsedJson);

    if (!outputValidation.success) {
      console.error("KI-Antwort (ShoppingList) entsprach nicht der Zod-Struktur:", outputValidation.error.flatten());
      console.error("Empfangene Daten von KI (ShoppingList):", content); 
      throw new Error('Die KI hat eine unerwartete Datenstruktur geliefert.');
    }

    return NextResponse.json(outputValidation.data); 

  } catch (error: any) {
    console.error('Fehler in /api/tools/shopping-list:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}