// app/api/tools/email-assistant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung (Frontend -> Server) ---
// +++ KORREKTUR: 'angebot' entfernt, da es ein eigenes Szenario wird +++
const inputSchema = z.object({
  recipientContext: z.string().min(3, 'Empfänger-Kontext ist zu kurz'),
  goal: z.string().min(5, 'Das Ziel der E-Mail ist zu kurz'),
  keyPoints: z.string().optional(), // Stichpunkte sind optional
  tone: z.enum(['formell', 'freundlich', 'direkt', 'überzeugend', 'dringend']),
  emailType: z.enum(['anfrage', 'follow-up', 'beschwerde', 'danksagung']), // 'angebot' entfernt
});

// --- Ausgabe-Validierung (AI -> Server) ---
const outputSchema = z.object({
  email: z.object({
    subject: z.string().min(1, 'Betreff fehlt'),
    body: z.string().min(10, 'E-Mail-Text fehlt'),
  }),
});

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY fehlt");
  return new OpenAI({ apiKey: key });
}

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
      recipientContext, 
      goal, 
      keyPoints, 
      tone, 
      emailType 
    } = validation.data;

    // 2. Der spezialisierte System-Prompt (MIT ÄNDERUNG)
    const systemPrompt = `Du bist ein professioneller Kommunikationsassistent (für SiniSpace). 
Deine Aufgabe ist es, einen E-Mail-Entwurf (Betreff und Textkörper) zu erstellen.

**Anweisungen:**
1.  **Struktur:** Die Ausgabe MUSS ein JSON-Objekt sein. Dieses Objekt MUSS einen einzigen Key namens "email" haben.
2.  **Inhalt von "email":** Der Wert von "email" MUSS ein Objekt mit zwei Keys sein:
    * \`"subject"\`: (Ein kurzer, prägnanter Betreff als String).
    * \`"body"\`: (Der vollständige E-Mail-Text als Markdown-formatierter String).
3.  **Inhalt des "body":**
    * Verwende Platzhalter wie \`[Name des Empfängers]\` für die Anrede und \`[Dein Name]\` für die Signatur.
    * Formatiere den Text mit Absätzen (Leerzeilen im Markdown).
    * Falls Stichpunkte sinnvoll sind, verwende Markdown-Listen.
    * Die Tonalität muss **${tone}** sein.
    * Der Typ der E-Mail ist **${emailType}**.
    
4.  **WICHTIGE STIL-REGEL:** Beginne E-Mails direkt und modern. Vermeide UNBEDINGT veraltete, steife Floskeln wie "ich hoffe, diese Nachricht trifft Sie wohl", "ich hoffe, es geht Ihnen gut" oder ähnliches. Gehe direkt zur Sache oder starte mit einem klaren Bezugspunkt.

**Beispiel-Output:**
{
  "email": {
    "subject": "Beispiel-Betreff hier",
    "body": "Sehr geehrte/r [Name des Empfängers],\\n\\nhier ist der Textkörper der E-Mail...\\n\\nMit freundlichen Grüßen,\\n[Dein Name]"
  }
}`;

    const userPrompt = `Bitte erstelle einen E-Mail-Entwurf mit den folgenden Spezifikationen:
- **Art:** ${emailType}
- **Tonalität:** ${tone}
- **Empfänger-Kontext:** ${recipientContext}
- **Ziel der E-Mail:** ${goal}
- **Wichtige Stichpunkte, die enthalten sein müssen (falls vorhanden):** ${keyPoints || 'Keine spezifischen Stichpunkte vorgegeben.'}`;

const openai = getOpenAI();



    // 3. OpenAI API aufrufen
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
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
    console.error('Fehler in /api/tools/email-assistant:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}