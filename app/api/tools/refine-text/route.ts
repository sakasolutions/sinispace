// app/api/tools/refine-text/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung (Frontend -> Server) ---
// Diese Route ist generisch. Sie nimmt jeden Text und eine Anweisung.
const inputSchema = z.object({
  text: z.string().min(10, 'Der zu überarbeitende Text ist zu kurz.'),
  instruction: z.string().min(5, 'Die Anweisung ist zu kurz.'),
});

// --- Ausgabe-Validierung (AI -> Server) ---
// Wir erwarten einen einzigen Key "refinedText" zurück.
const outputSchema = z.object({
  refinedText: z.string().min(1, 'Die KI hat leeren Text zurückgegeben.'),
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
    
    const { text, instruction } = validation.data;

    // 2. Der spezialisierte System-Prompt
    const systemPrompt = `Du bist ein professioneller Text-Editor (für SiniSpace). 
Deine Aufgabe ist es, einen existierenden Text basierend auf einer klaren Anweisung zu überarbeiten.

**Anweisungen:**
1.  **Struktur:** Die Ausgabe MUSS ein JSON-Objekt sein.
2.  **Inhalt:** Das Objekt MUSS einen einzigen Key namens \`"refinedText"\` haben.
3.  **Wert:** Der Wert von \`"refinedText"\` MUSS der überarbeitete Text als String sein.
4.  **Formatierung:** Behalte die ursprüngliche Markdown-Formatierung (Absätze, Listen etc.) bei, es sei denn, die Anweisung verlangt explizit etwas anderes.
5.  **Fokus:** Ändere NUR den Text gemäß der Anweisung. Füge keine Kommentare oder Erklärungen hinzu.

**Beispiel-Output:**
{
  "refinedText": "Sehr geehrter Herr Müller,\\n\\nDanke für Ihre E-Mail. Der Text wurde erfolgreich überarbeitet.\\n\\nBeste Grüße,\\nMax Mustermann"
}`;

    // 3. Der User-Prompt
    const userPrompt = `
Hier ist der Original-Text:
"""
${text}
"""

Hier ist die Anweisung, wie du ihn überarbeiten sollst:
"${instruction}"

Bitte gib mir nur das JSON-Objekt mit dem \`refinedText\` zurück.`;

    // 4. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Für Überarbeitungen ist Qualität wichtiger
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5, // Weniger Kreativität bei Überarbeitungen
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 5. Antwort parsen UND mit Zod validieren
    const parsedJson = JSON.parse(content);
    const outputValidation = outputSchema.safeParse(parsedJson);

    if (!outputValidation.success) {
      console.error("KI-Antwort (Refine) entsprach nicht der Zod-Struktur:", outputValidation.error.flatten());
      console.error("Empfangene Daten von KI (Refine):", content); 
      throw new Error('Die KI hat eine unerwartete Datenstruktur für die Überarbeitung geliefert.');
    }

    // Das Frontend erwartet { refinedText: "..." }
    return NextResponse.json(outputValidation.data); 

  } catch (error: any) {
    console.error('Fehler in /api/tools/refine-text:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}