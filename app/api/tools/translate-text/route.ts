// app/api/tools/translate-text/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung (Frontend -> Server) ---
const inputSchema = z.object({
  text: z.string().min(5, 'Der zu übersetzende Text ist zu kurz.'),
  language: z.string().min(3, 'Die Zielsprache ist nicht definiert.'),
});

// --- Ausgabe-Validierung (AI -> Server) ---
const outputSchema = z.object({
  translatedText: z.string().min(1, 'Die KI hat leeren Text zurückgegeben.'),
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
    
    const { text, language } = validation.data;

    // 2. Der spezialisierte System-Prompt
    const systemPrompt = `Du bist ein professioneller Übersetzungs-Assistent (für SiniSpace).
Deine Aufgabe ist es, einen existierenden Text präzise in eine Zielsprache zu übersetzen.

**Anweisungen:**
1.  **Struktur:** Die Ausgabe MUSS ein JSON-Objekt sein.
2.  **Inhalt:** Das Objekt MUSS einen einzigen Key namens \`"translatedText"\` haben.
3.  **Wert:** Der Wert von \`"translatedText"\` MUSS der übersetzte Text als String sein.
4.  **Formatierung:** Behalte die ursprüngliche Markdown-Formatierung (Absätze, Listen, etc.) exakt bei.
5.  **Genauigkeit:** Übersetze den Inhalt so genau wie möglich, ohne den Sinn zu verändern. Übersetze auch Platzhalter wie \`[Name des Empfängers]\` in die Zielsprache (z.B. zu \`[Recipient's Name]\`).
6.  **Fokus:** Füge absolut keine Kommentare, Notizen oder Erklärungen hinzu. Nur die reine Übersetzung im JSON.

**Beispiel-Output:**
{
  "translatedText": "Dear [Recipient's Name],\\n\\nthis is the translated body...\\n\\nSincerely,\\n[Your Name]"
}`;

    // 3. Der User-Prompt
    const userPrompt = `
Bitte übersetze den folgenden Text in die Sprache: **${language}**

**Original-Text:**
"""
${text}
"""

Gib mir nur das JSON-Objekt mit dem \`translatedText\` zurück.`;

    // 4. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Sehr geringe Temperatur für präzise Übersetzungen
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 5. Antwort parsen UND mit Zod validieren
    const parsedJson = JSON.parse(content);
    const outputValidation = outputSchema.safeParse(parsedJson);

    if (!outputValidation.success) {
      console.error("KI-Antwort (Translate) entsprach nicht der Zod-Struktur:", outputValidation.error.flatten());
      console.error("Empfangene Daten von KI (Translate):", content); 
      throw new Error('Die KI hat eine unerwartete Datenstruktur für die Übersetzung geliefert.');
    }

    // Das Frontend erwartet { translatedText: "..." }
    return NextResponse.json(outputValidation.data); 

  } catch (error: any) {
    console.error('Fehler in /api/tools/translate-text:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}