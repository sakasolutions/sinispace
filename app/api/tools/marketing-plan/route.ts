// app/api/tools/marketing-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// --- Eingabe-Validierung mit Zod ---
const inputSchema = z.object({
  productName: z.string().min(3, 'Produktname ist zu kurz'),
  productDescription: z.string().min(10, 'Beschreibung ist zu kurz'),
  targetAudience: z.string().min(10, 'Zielgruppe ist zu kurz'),
  mainGoals: z.string().min(5, 'Ziele sind zu kurz'),
  usp: z.string().min(5, 'USP ist zu kurz'),
  budgetLevel: z.enum(['niedrig', 'mittel', 'hoch']),
});

// --- OpenAI-Client Initialisierung ---
// (Wieder: Wenn du diesen schon zentral hast, importiere ihn)
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
      productName, 
      productDescription, 
      targetAudience, 
      mainGoals, 
      usp, 
      budgetLevel 
    } = validation.data;

    // 2. Der spezialisierte System-Prompt (DEIN "GEHIRN")
    // HIER kannst du später so viel verfeinern, wie du möchtest!
    const systemPrompt = `Du bist ein Senior Marketing Strategist (Berater für SiniSpace). 
Deine Aufgabe ist es, einen prägnanten, umsetzbaren Marketingplan zu erstellen.

Das Budget-Niveau ist "${budgetLevel}". Passe deine Vorschläge entsprechend an:
- niedrig: Fokus auf organische, kostenlose Methoden (SEO, Content, Community Building).
- mittel: Mix aus Content Marketing und gezielten, kleinen Paid Ads (z.B. Social Media Ads).
- hoch: Große Paid-Kampagnen, Influencer-Marketing, Multi-Channel-Strategien.

Die Ausgabe MUSS ein JSON-Objekt sein.
Das Objekt MUSS einen einzigen Key namens "plan" haben.
Der Wert von "plan" MUSS ein Objekt mit den folgenden 6 Keys sein:

1.  "executiveSummary": (Eine kurze Zusammenfassung des Plans, 2-3 Sätze).
2.  "targetAudienceProfile": (Eine detailliertere Beschreibung der Zielgruppe basierend auf der Eingabe, als Fließtext).
3.  "keyMessages": (Die Kernbotschaften und die herausgestellten USPs, als Fließtext oder Markdown-Liste).
4.  "recommendedChannels": (Empfohlene Marketingkanäle, passend zur Zielgruppe und Budget, als Markdown-Liste).
5.  "campaignIdeas": (3 konkrete Kampagnen-Ideen für die wichtigsten Kanäle, als Markdown-Liste).
6.  "successMetrics": (Wichtige KPIs zur Erfolgsmessung, passend zu den Zielen, als Markdown-Liste).

Alle Textinhalte sollen professionell, klar und direkt umsetzbar sein. Verwende Markdown für Listen.
Stelle sicher, dass die Antwort NUR dieses JSON-Objekt enthält.`;

    const userPrompt = `Erstelle den Marketingplan für das folgende Produkt:
- Produkt: ${productName}
- Beschreibung: ${productDescription}
- Zielgruppe: ${targetAudience}
- USP: ${usp}
- Hauptziele: ${mainGoals}
- Budget: ${budgetLevel}`;

    // 3. OpenAI API aufrufen (GPT-4o mit JSON-Modus)
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Wichtig für komplexe JSON-Strukturen
      response_format: { type: 'json_object' }, // JSON-Modus erzwingen
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7, // Leicht kreativ, aber strategisch
      max_tokens: 2500,
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('Leere Antwort von der KI erhalten.');
    }

    // 4. Antwort parsen und an das Frontend senden
    // (Das Frontend erwartet data.plan, daher muss das JSON { "plan": { ... } } sein)
    const parsedJson = JSON.parse(content);
    
    // Kurze Prüfung, ob die Struktur stimmt
    if (!parsedJson.plan || !parsedJson.plan.executiveSummary) {
       console.error("KI-Antwort entsprach nicht der erwarteten Struktur:", parsedJson);
       throw new Error('Die KI hat eine unerwartete Datenstruktur geliefert.');
    }

    return NextResponse.json(parsedJson); // Sendet { "plan": { ... } } zurück

  } catch (error: any) {
    console.error('Fehler in /api/tools/marketing-plan:', error);
    return NextResponse.json(
      { error: error.message || 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}