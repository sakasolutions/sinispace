// app/api/tools/rezept-bauer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// +++ ANGEPASSTES Eingabe-Schema +++
const inputSchema = z.object({
  mainIngredients: z.array(z.string()).min(1, 'Es muss mindestens eine Hauptzutat angegeben werden.'),
  pantryItems: z.array(z.string()).optional(),
  diet: z.enum(['alles', 'vegetarisch', 'vegan', 'glutenfrei']),
  timeframe: z.enum(['schnell', 'mittel', 'egal']),
  personCount: z.enum(['1', '2', '3-4']), // +++ NEU +++
  // Optionale Felder für Feinschliff
  refineInstruction: z.string().optional(),
  currentRecipe: z.string().optional(), 
});

// --- Ausgabe-Validierung (AI -> Server) ---
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
      timeframe,
      personCount, // +++ NEU +++
      refineInstruction,
      currentRecipe
    } = validation.data;
    
    // +++ NEU: Dynamischer System-Prompt (STARK ÜBERARBEITET) +++
    let systemPrompt = `Du bist ein kreativer und erfahrener Koch (für SiniSpace), der Rezepte für absolute Kochanfänger schreibt.
Deine Aufgabe ist es, ein einzelnes, köstliches und "idiotensicheres" Rezept zu erstellen.

**KERN-ANWEISUNGEN:**
1.  **Priorität:** Die \`mainIngredients\` müssen die Basis sein. Die \`pantryItems\` können ergänzend verwendet werden. Du darfst 1-2 weitere gängige Zutaten hinzufügen, wenn es das Rezept essentiell verbessert.
2.  **Filter (Strikt einhalten):**
    * Ernährungsform: \`${diet}\`
    * Zeitaufwand: \`${timeframe}\` (schnell: < 20min, mittel: 30-45min)
    * Personenanzahl: \`${personCount}\` (Alle Mengenangaben in "ingredients" MÜSSEN für diese Anzahl sein).

**IDOTENSICHERE ANLEITUNG (WICHTIG!):**
Der Nutzer kann NICHT kochen. Die "instructions" müssen extrem detailliert sein:
1.  **Trennung:** Trenne Vorbereitung (Schnippeln) klar von der Zubereitung (Kochen).
2.  **Kein Fachjargon:** Nicht "dünsten" oder "anbraten" ohne Erklärung.
3.  **Zeitangaben:** JEDER Kochschritt MUSS eine **ungefähre Zeitangabe** haben (z.B. "ca. 3-4 Minuten braten").
4.  **Visuelle Signale:** JEDER Kochschritt MUSS ein **klares visuelles Signal** haben (z.B. "...bis die Zwiebeln glasig sind" oder "...bis das Hackfleisch krümelig und braun ist").

**JSON-STRUKTUR (Strikt einhalten):**
1.  Die Ausgabe MUSS ein JSON-Objekt sein mit einem Key \`"recipe"\`.
2.  \`"recipe"\` MUSS 5 Keys haben:
    * \`"title"\`: (Ein kreativer Name).
    * \`"description"\`: (Ein kurzer "Appetizer"-Text, 1-2 Sätze).
    * \`"prepTime"\`: (Die geschätzte Zubereitungszeit, z.B. "ca. 20 Minuten").
    * \`"ingredients"\`: (Markdown-Liste mit exakten Mengenangaben für \`${personCount}\` Person(en)).
    * \`"instructions"\`: (Die idiotensichere, nummerierte Markdown-Anleitung).
`;

    // +++ NEU: Logik für Feinschliff +++
    if (refineInstruction && currentRecipe) {
      let instructionText = '';
      if (refineInstruction === 'neue-idee') {
        instructionText = `**WICHTIG:** Du hast bereits ein Rezept vorgeschlagen. Der Nutzer möchte eine **komplett NEUE IDEE**. Bitte generiere ein *anderes* Rezept mit den gleichen Hauptzutaten und Filtern. Vermeide das vorherige Rezept: ${currentRecipe}`;
      } else if (refineInstruction === 'einfacher') {
        instructionText = `**WICHTIG:** Bitte nimm das folgende Rezept und mache es **EINFACHER**. (Weniger Schritte, weniger Töpfe, einfachere Zutaten, falls möglich). Das ist das Rezept: ${currentRecipe}`;
      } else if (refineInstruction === 'gesuender') {
        instructionText = `**WICHTIG:** Bitte nimm das folgende Rezept und mache es **GESÜNDER**. (z.B. weniger Fett, weniger Zucker, mehr Gemüse, schonendere Garmethoden). Das ist das Rezept: ${currentRecipe}`;
      }
      
      systemPrompt += `\n\n**FEINSCHLIFF-ANWEISUNG:**\n${instructionText}`;
    }

    systemPrompt += `\n\n**Beispiel-Output (Idiotensicher):**
{
  "recipe": {
    "title": "Einfache Hackfleisch-Pfanne",
    "description": "Ein super schnelles und einfaches Gericht, das garantiert gelingt.",
    "prepTime": "ca. 15 Minuten",
    "ingredients": "- 200g Hackfleisch\\n- 1 Zwiebel\\n- 2 EL Olivenöl\\n- Salz & Pfeffer",
    "instructions": "1. **Vorbereitung:** Zwiebel schälen und in kleine Würfel schneiden.\\n2. **Anbraten:** Öl in einer großen Pfanne bei mittlerer Hitze erhitzen. Zwiebeln hinzufügen und **ca. 2-3 Minuten** anschwitzen, **bis sie glasig (durchsichtig) werden**.\\n3. **Fleisch braten:** Hackfleisch dazugeben und mit einem Pfannenwender zerteilen. **Etwa 5-7 Minuten** krümelig braten, **bis es nicht mehr rosa ist und braun wird**.\\n4. **Abschmecken:** Mit Salz und Pfeffer würzen und sofort servieren."
  }
}`;

    // +++ ANGEPASST: User-Prompt nutzt .join() und personCount +++
    const userPrompt = `Bitte erstelle ein Rezept mit den folgenden Spezifikationen:
- **Hauptzutaten:** ${mainIngredients.join(', ')}
- **Standard-Zutaten (Vorratskammer):** ${pantryItems?.join(', ') || 'Keine Angabe'}
- **Ernährungsform:** ${diet}
- **Zeitaufwand:** ${timeframe}
- **Für wie viele Personen:** ${personCount}`;

    // 3. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
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

    return NextResponse.json(outputValidation.data); 

  } catch (error: any) {
    console.error('Fehler in /api/tools/rezept-bauer:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}