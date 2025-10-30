// app/tools/email-assistant/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Hilfsfunktionen (aus deiner app/chat/page.tsx) ---
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

// --- Typen für dieses Werkzeug ---
type EmailTone = 'formell' | 'freundlich' | 'direkt' | 'überzeugend' | 'dringend';
type EmailType = 'anfrage' | 'angebot' | 'follow-up' | 'beschwerde' | 'danksagung';

// Das ist die "interne" Form, die an die API gesendet wird
interface ApiFormData {
  recipientContext: string;
  goal: string;
  keyPoints: string;
  tone: EmailTone;
  emailType: EmailType;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

type RefineInstruction = 'kürzer' | 'formeller' | 'freundlicher';
type Language = 'Englisch' | 'Spanisch' | 'Französisch' | 'Türkisch' | 'Deutsch';

// +++ ANGEPASST: Typen für den Szenario-Generator +++
type ViewState = 'hub' | 'form';
type Scenario =
  | 'krankmeldung'
  | 'termin'
  | 'followup'
  | 'bitte'
  | 'beschwerde'
  | 'danke' // +++ NEU +++
  | 'sonstiges';

// +++ ANGEPASST: State für die vereinfachten Formulare +++
interface SimpleFormData {
  ansprache: 'sie' | 'du';
  krankAnWen: 'vorgesetzter' | 'kollege' | 'schule';
  krankDauer: 'heute' | 'heute-morgen' | 'unbestimmt';
  terminArt: 'absagen' | 'verschieben';
  terminAnWen: 'formell-sie' | 'informell-du';
  terminInfo: string;
  followupAnWen: 'kunde' | 'kollege' | 'dienstleister';
  followupThema: string;
  bitteAnWen: 'formell-sie' | 'informell-du';
  bitteWas: string;
  beschwerdeAnWen: 'firma' | 'kollege' | 'dienstleister';
  beschwerdeWas: string;
  beschwerdeForderung: string;

  // +++ NEU: Szenario 'danke' +++
  dankeAnWen: 'formell-sie' | 'informell-du';
  dankeWofuer: string; // Wofür?
  dankeKontext: string; // Optionale vorherige E-Mail

  // Szenario 'sonstiges' (das alte, volle Formular)
  sonstigesRecipientContext: string;
  sonstigesGoal: string;
  sonstigesKeyPoints: string;
  sonstigesTone: EmailTone;
  sonstigesEmailType: EmailType;
  sonstigesAnsprache: 'sie' | 'du';
}

// --- Hauptkomponente ---
export default function EmailAssistantPage() {
  const [view, setView] = useState<ViewState>('hub');
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // +++ ANGEPASST: State für vereinfachte Formulare +++
  const [simpleForm, setSimpleForm] = useState<SimpleFormData>({
    ansprache: 'sie',
    krankAnWen: 'vorgesetzter',
    krankDauer: 'heute',
    terminArt: 'absagen',
    terminAnWen: 'formell-sie',
    terminInfo: '',
    followupAnWen: 'kunde',
    followupThema: '',
    bitteAnWen: 'formell-sie',
    bitteWas: '',
    beschwerdeAnWen: 'firma',
    beschwerdeWas: '',
    beschwerdeForderung: '',
    dankeAnWen: 'formell-sie', // +++ NEU +++
    dankeWofuer: '', // +++ NEU +++
    dankeKontext: '', // +++ NEU +++
    // "Sonstiges"
    sonstigesRecipientContext: '',
    sonstigesGoal: '',
    sonstigesKeyPoints: '',
    sonstigesTone: 'freundlich',
    sonstigesEmailType: 'anfrage', // Default 'anfrage' ist gut
    sonstigesAnsprache: 'sie',
  });

  const [email, setEmail] = useState<GeneratedEmail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRefining, setIsRefining] = useState<RefineInstruction | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  const [isTranslating, setIsTranslating] = useState<Language | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [originalBody, setOriginalBody] = useState<string | null>(null);

  // Update für das VEREINFACHTE Formular
  const handleSimpleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setSimpleForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectScenario = (selectedScenario: Scenario) => {
    setScenario(selectedScenario);
    setView('form');
    setEmail(null);
    setError(null);
    setRefineError(null);
    setTranslateError(null);
    setOriginalBody(null);
  };

  const handleBackToHub = () => {
    setView('hub');
    setScenario(null);
    setEmail(null);
    setError(null);
    setRefineError(null);
    setTranslateError(null);
    setOriginalBody(null);
  };

  // Übersetzungs-Logik
  const buildApiFormData = (): ApiFormData => {
    const anspracheText = (ansprache: 'sie' | 'du') => `| Gewünschte Ansprache: ${ansprache}`;

    switch (scenario) {
      case 'krankmeldung':
        const recipientMap: Record<string, string> = {
          vorgesetzter: 'Mein Vorgesetzter',
          kollege: 'Ein Kollege / Team',
          schule: 'Schule / Universität / Dozent',
        };
        const dauerMap: Record<string, string> = {
          heute: 'nur für heute',
          'heute-morgen': 'für heute und morgen',
          unbestimmt: 'bis auf weiteres',
        };
        const krankenAnsprache = simpleForm.krankAnWen === 'schule' ? 'sie' : simpleForm.ansprache;

        return {
          recipientContext: recipientMap[simpleForm.krankAnWen] || 'Empfänger',
          goal: `Eine formelle Krankmeldung einreichen (${
            dauerMap[simpleForm.krankDauer]
          }) ${anspracheText(krankenAnsprache)}`,
          keyPoints: '',
          tone: 'formell',
          emailType: 'anfrage',
        };

      case 'termin':
        const terminAnsprache = simpleForm.terminAnWen === 'formell-sie' ? 'sie' : 'du';
        const terminContext =
          simpleForm.terminAnWen === 'formell-sie'
            ? 'Geschäftspartner / Kunde'
            : 'Kollege / Bekannter';
        const terminTone = simpleForm.terminAnWen === 'formell-sie' ? 'formell' : 'freundlich';

        return {
          recipientContext: terminContext,
          goal: `Einen Termin ${simpleForm.terminArt} ${anspracheText(terminAnsprache)}`,
          keyPoints: `Wichtige Infos: ${simpleForm.terminInfo}`,
          tone: terminTone,
          emailType: 'anfrage',
        };

      case 'followup':
        return {
          recipientContext: `Ein ${simpleForm.followupAnWen}`,
          goal: `Eine höfliche Erinnerung / Follow-Up senden ${anspracheText(simpleForm.ansprache)}`,
          keyPoints: `Bezugnehmend auf: ${simpleForm.followupThema}`,
          tone: 'freundlich',
          emailType: 'follow-up',
        };

      case 'bitte':
        const bitteAnsprache = simpleForm.bitteAnWen === 'formell-sie' ? 'sie' : 'du';
        const bitteContext =
          simpleForm.bitteAnWen === 'formell-sie'
            ? 'Formell (z.B. Behörde, Vorgesetzter)'
            : 'Informell (z.B. Kollege)';
        const bitteTone = simpleForm.bitteAnWen === 'formell-sie' ? 'formell' : 'freundlich';
        return {
          recipientContext: bitteContext,
          goal: `Um etwas bitten ${anspracheText(bitteAnsprache)}`,
          keyPoints: `Anliegen: ${simpleForm.bitteWas}`,
          tone: bitteTone,
          emailType: 'anfrage',
        };

      case 'beschwerde':
        const beschwerdeContextMap: Record<string, string> = {
          firma: 'Firma / Kundenservice',
          kollege: 'Kollege / Vorgesetzter',
          dienstleister: 'Externer Dienstleister',
        };
        return {
          recipientContext: beschwerdeContextMap[simpleForm.beschwerdeAnWen] || 'Firma / Kundenservice',
          goal: `Eine sachliche Beschwerde einreichen ${anspracheText(simpleForm.ansprache)}`,
          keyPoints: `Problem: ${simpleForm.beschwerdeWas}\nForderung (falls angegeben): ${
            simpleForm.beschwerdeForderung || 'Keine spezifische Forderung'
          }`,
          tone: 'formell',
          emailType: 'beschwerde',
        };

      // +++ NEU: Szenario 'danke' +++
      case 'danke':
        const dankeAnsprache = simpleForm.dankeAnWen === 'formell-sie' ? 'sie' : 'du';
        const dankeContext =
          simpleForm.dankeAnWen === 'formell-sie'
            ? 'Formell (z.B. Geschäftspartner, Vorgesetzter)'
            : 'Informell (z.B. Kollege, Freund)';
        const dankeTone = simpleForm.dankeAnWen === 'formell-sie' ? 'formell' : 'freundlich';
        return {
          recipientContext: dankeContext,
          goal: `Eine Danksagung formulieren ${anspracheText(dankeAnsprache)}`,
          keyPoints: `Wofür bedanke ich mich: ${
            simpleForm.dankeWofuer
          }\n\nKontext (vorherige E-Mail, falls angegeben):\n${
            simpleForm.dankeKontext || 'Kein Kontext'
          }`,
          tone: dankeTone,
          emailType: 'danksagung',
        };

      case 'sonstiges':
      default:
        return {
          recipientContext: simpleForm.sonstigesRecipientContext,
          goal: `${simpleForm.sonstigesGoal} ${anspracheText(simpleForm.sonstigesAnsprache)}`,
          keyPoints: simpleForm.sonstigesKeyPoints,
          tone: simpleForm.sonstigesTone,
          emailType: simpleForm.sonstigesEmailType,
        };
    }
  };

  // API-Aufruf beim Absenden
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setEmail(null);
    setRefineError(null);
    setTranslateError(null);
    setOriginalBody(null);

    const apiFormData = buildApiFormData();

    try {
      const response = await fetch('/api/tools/email-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiFormData),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();

      if (!data.email || !data.email.subject || data.email.body === undefined) {
        throw new Error('Ungültige Antwort vom Server: "email"-Objekt fehlt oder ist unvollständig.');
      }

      setEmail(data.email);
      setOriginalBody(data.email.body);
    } catch (err: any) {
      setError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  // "Feinschliff"-Handler
  const handleRefine = async (instruction: RefineInstruction) => {
    if (isRefining || !email || isTranslating) return;
    setIsRefining(instruction);
    setRefineError(null);
    setTranslateError(null);

    const instructionMap: Record<RefineInstruction, string> = {
      kürzer:
        'Mache diesen E-Mail-Text kürzer und knapper, behalte aber den Kerninhalt und die Höflichkeit bei.',
      formeller: 'Formuliere diesen E-Mail-Text professioneller, formeller und distanzierter.',
      freundlicher: 'Mache diesen E-Mail-Text freundlicher, wärmer und persönlicher.',
    };
    try {
      const response = await fetch('/api/tools/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: email.body,
          instruction: instructionMap[instruction],
        }),
      });
      if (!response.ok) throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      const data = await response.json();
      if (!data.refinedText) throw new Error('Ungültige Antwort von der "Refine"-API.');
      setEmail((prevEmail) => ({ ...prevEmail!, body: data.refinedText }));
      setOriginalBody(data.refinedText); // Überschreibt Original
    } catch (err: any) {
      setRefineError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsRefining(null);
    }
  };

  // "Übersetzungs"-Handler
  const handleTranslate = async (language: Language) => {
    if (isTranslating || !email || isRefining) return;

    if (language === 'Deutsch') {
      if (originalBody) {
        setEmail((prev) => ({ ...prev!, body: originalBody }));
      }
      setTranslateError(null);
      return;
    }

    setIsTranslating(language);
    setTranslateError(null);
    setRefineError(null);

    const textToTranslate = originalBody || email.body;
    if (!originalBody) {
      setOriginalBody(email.body);
    }

    try {
      const response = await fetch('/api/tools/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          language: language,
        }),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.translatedText) {
        throw new Error('Ungültige Antwort von der "Translate"-API.');
      }

      setEmail((prevEmail) => ({
        ...prevEmail!,
        body: data.translatedText,
      }));
    } catch (err: any) {
      setTranslateError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
      if (originalBody) {
        setEmail((prev) => ({ ...prev!, body: originalBody }));
      }
    } finally {
      setIsTranslating(null);
    }
  };

  // --- RENDER-FUNKTIONEN ---

  // +++ ANGEPASST: Rendert den "Szenario-Hub" +++
  const renderScenarioHub = () => (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
        E-Mail Assistent
      </h1>
      <p className="text-sm sm:text-base text-neutral-600 mb-8">
        Wofür brauchst du eine E-Mail? Wähle ein Szenario:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ScenarioButton
          title="Krankmeldung"
          description="Schnell & formell den Chef oder die Schule informieren."
          onClick={() => handleSelectScenario('krankmeldung')}
          icon="medical"
        />
        <ScenarioButton
          title="Termin absagen / verschieben"
          description="Höflich ein Meeting oder einen Termin neu ansetzen."
          onClick={() => handleSelectScenario('termin')}
          icon="calendar"
        />
        <ScenarioButton
          title="Nachfassen (Follow-Up)"
          description="Höflich an eine Antwort oder ein Angebot erinnern."
          onClick={() => handleSelectScenario('followup')}
          icon="reminder"
        />
        <ScenarioButton
          title="Um etwas bitten"
          description="Eine Anfrage für Informationen oder einen Gefallen formulieren."
          onClick={() => handleSelectScenario('bitte')}
          icon="request"
        />
        <ScenarioButton
          title="Beschwerde"
          description="Sachlich und bestimmt ein Problem schildern."
          onClick={() => handleSelectScenario('beschwerde')}
          icon="complaint"
        />
        {/* +++ NEU: Danke-Button +++ */}
        <ScenarioButton
          title="Danke sagen"
          description="Eine Danksagung für Hilfe, ein Meeting oder eine Info."
          onClick={() => handleSelectScenario('danke')}
          icon="heart"
        />
        <ScenarioButton
          title="Sonstiges (Manueller Assistent)"
          description="Alle Optionen selbst festlegen (Experten-Modus)."
          onClick={() => handleSelectScenario('sonstiges')}
          icon="manual"
        />
      </div>
    </>
  );

  // +++ ANGEPASST: Rendert das dynamische Formular +++
  const renderFormView = () => {
    
    // +++ NEU: Validierungs-Logik +++
    const isFormValid = (): boolean => {
      if (!scenario) return false;

      switch (scenario) {
        case 'krankmeldung':
          return true; // Alle Felder haben Defaults
        case 'termin':
          return simpleForm.terminInfo.trim() !== '';
        case 'followup':
          return simpleForm.followupThema.trim() !== '';
        case 'bitte':
          return simpleForm.bitteWas.trim() !== '';
        case 'beschwerde':
          return simpleForm.beschwerdeWas.trim() !== '';
        case 'danke':
          return simpleForm.dankeWofuer.trim() !== '';
        case 'sonstiges':
          return (
            simpleForm.sonstigesRecipientContext.trim() !== '' &&
            simpleForm.sonstigesGoal.trim() !== ''
          );
        default:
          return false;
      }
    };

    const formIsValid = isFormValid(); // Prüfe den Status für den Button

    return (
      <form onSubmit={handleSubmit}>
        {/* Zurück-Button */}
        <button
          type="button"
          onClick={handleBackToHub}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Andere Vorlage wählen
        </button>

        {/* --- RENDER: Szenario "Krankmeldung" --- */}
        {scenario === 'krankmeldung' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">Krankmeldung</h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">
              Schnell & formell informieren.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ToolSelect
                label="An wen?"
                id="krankAnWen"
                name="krankAnWen"
                value={simpleForm.krankAnWen}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'vorgesetzter', label: 'Vorgesetzter / Chef' },
                  { value: 'kollege', label: 'Kollege / Team' },
                  { value: 'schule', label: 'Schule / Uni / Dozent' },
                ]}
              />
              <ToolSelect
                label="Wie lange?"
                id="krankDauer"
                name="krankDauer"
                value={simpleForm.krankDauer}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'heute', label: 'Nur heute' },
                  { value: 'heute-morgen', label: 'Heute und morgen' },
                  { value: 'unbestimmt', label: 'Bis auf weiteres' },
                ]}
              />
            </div>
            {simpleForm.krankAnWen !== 'schule' && (
              <ToolSelect
                label="Ansprache"
                id="ansprache"
                name="ansprache"
                value={simpleForm.ansprache}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'sie', label: 'Formell (Sie)' },
                  { value: 'du', label: 'Informell (Du)' },
                ]}
              />
            )}
          </div>
        )}

        {/* --- RENDER: Szenario "Termin" --- */}
        {scenario === 'termin' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
              Termin absagen / verschieben
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ToolSelect
                label="Aktion"
                id="terminArt"
                name="terminArt"
                value={simpleForm.terminArt}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'absagen', label: 'Termin absagen' },
                  { value: 'verschieben', label: 'Termin verschieben' },
                ]}
              />
              <ToolSelect
                label="Empfänger (Ansprache)"
                id="terminAnWen"
                name="terminAnWen"
                value={simpleForm.terminAnWen}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'formell-sie', label: 'Formell (Sie)' },
                  { value: 'informell-du', label: 'Informell (Du)' },
                ]}
              />
            </div>
            <ToolTextarea
              label="Wichtige Infos (Termin, Ort, neue Vorschläge)"
              id="terminInfo"
              name="terminInfo"
              value={simpleForm.terminInfo}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Unser Meeting morgen 10 Uhr. Neuer Vorschlag: Freitag 14 Uhr."
              rows={3}
              required
            />
          </div>
        )}

        {/* --- RENDER: Szenario "Follow-Up" --- */}
        {scenario === 'followup' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
              Nachfassen (Follow-Up)
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ToolSelect
                label="An wen?"
                id="followupAnWen"
                name="followupAnWen"
                value={simpleForm.followupAnWen}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'kunde', label: 'Kunde / Interessent' },
                  { value: 'kollege', label: 'Kollege / Team' },
                  { value: 'dienstleister', label: 'Externer Dienstleister' },
                ]}
              />
              <ToolSelect
                label="Ansprache"
                id="ansprache"
                name="ansprache"
                value={simpleForm.ansprache}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'sie', label: 'Formell (Sie)' },
                  { value: 'du', label: 'Informell (Du)' },
                ]}
              />
            </div>
            <ToolInput
              label="Worauf beziehst du dich?"
              id="followupThema"
              name="followupThema"
              value={simpleForm.followupThema}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Mein Angebot vom 10.10. / Deine Aufgabe im Projekt X"
              required
            />
          </div>
        )}

        {/* --- RENDER: Szenario "Um etwas bitten" --- */}
        {scenario === 'bitte' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
              Um etwas bitten
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">
              Formuliere eine höfliche Anfrage oder einen Gefallen.
            </p>
            <ToolSelect
              label="An wen? (Ansprache)"
              id="bitteAnWen"
              name="bitteAnWen"
              value={simpleForm.bitteAnWen}
              onChange={handleSimpleFormChange}
              options={[
                { value: 'formell-sie', label: 'Formell (Sie)' },
                { value: 'informell-du', label: 'Informell (Du)' },
              ]}
            />
            <ToolTextarea
              label="Worum bittest du?"
              id="bitteWas"
              name="bitteWas"
              value={simpleForm.bitteWas}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Ich brauche die Zugangsdaten für das Projekt X. / Kannst du mir Feedback zum Entwurf geben?"
              rows={4}
              required
            />
          </div>
        )}

        {/* --- RENDER: Szenario "Beschwerde" --- */}
        {scenario === 'beschwerde' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
              Beschwerde formulieren
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">
              Beschreibe sachlich ein Problem und formuliere eine Forderung.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ToolSelect
                label="An wen?"
                id="beschwerdeAnWen"
                name="beschwerdeAnWen"
                value={simpleForm.beschwerdeAnWen}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'firma', label: 'Firma / Kundenservice' },
                  { value: 'kollege', label: 'Kollege / Vorgesetzter' },
                  { value: 'dienstleister', label: 'Externer Dienstleister' },
                ]}
              />
              <ToolSelect
                label="Ansprache"
                id="ansprache"
                name="ansprache"
                value={simpleForm.ansprache}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'sie', label: 'Formell (Sie)' },
                  { value: 'du', label: 'Informell (Du)' },
                ]}
              />
            </div>
            <ToolTextarea
              label="Was ist das Problem?"
              id="beschwerdeWas"
              name="beschwerdeWas"
              value={simpleForm.beschwerdeWas}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Die Lieferung ist beschädigt (Bestellnr. 123). / Der Service war unzureichend."
              rows={3}
              required
            />
            <ToolTextarea
              label="Was forderst du? (Optional)"
              id="beschwerdeForderung"
              name="beschwerdeForderung"
              value={simpleForm.beschwerdeForderung}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Ich bitte um eine Ersatzlieferung. / Ich erwarte eine Rückerstattung."
              rows={2}
            />
          </div>
        )}

        {/* +++ NEU: RENDER: Szenario "Danke sagen" +++ */}
        {scenario === 'danke' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
              Danke sagen
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">
              Formuliere eine nette Danksagung.
            </p>
            <ToolSelect
              label="An wen? (Ansprache)"
              id="dankeAnWen"
              name="dankeAnWen"
              value={simpleForm.dankeAnWen}
              onChange={handleSimpleFormChange}
              options={[
                { value: 'formell-sie', label: 'Formell (Sie)' },
                { value: 'informell-du', label: 'Informell (Du)' },
              ]}
            />
            <ToolTextarea
              label="Wofür bedankst du dich?"
              id="dankeWofuer"
              name="dankeWofuer"
              value={simpleForm.dankeWofuer}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Für das informative Gespräch / Für deine schnelle Hilfe bei..."
              rows={3}
              required
            />
            <ToolTextarea
              label="Kontext (Optional)"
              id="dankeKontext"
              name="dankeKontext"
              value={simpleForm.dankeKontext}
              onChange={handleSimpleFormChange}
              placeholder="Füge hier die E-Mail ein, auf die du antwortest, damit die KI den vollen Kontext hat..."
              rows={4}
            />
          </div>
        )}

        {/* --- RENDER: Szenario "Sonstiges" --- */}
        {scenario === 'sonstiges' && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
              Manueller Assistent
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">
              Stelle alle Parameter selbst ein.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* +++ KORRIGIERT: Gekürzte Liste (Danke auch entfernt) +++ */}
              <ToolSelect
                label="Art der E-Mail"
                id="sonstigesEmailType"
                name="sonstigesEmailType"
                value={simpleForm.sonstigesEmailType}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'anfrage', label: 'Allgemeine Anfrage' },
                  { value: 'angebot', label: 'Angebot / Vorschlag' },
                ]}
              />
              <ToolSelect
                label="Gewünschte Tonalität"
                id="sonstigesTone"
                name="sonstigesTone"
                value={simpleForm.sonstigesTone}
                onChange={handleSimpleFormChange}
                options={[
                  { value: 'freundlich', label: 'Freundlich & Hilfsbereit' },
                  { value: 'formell', label: 'Formell & Professionell' },
                  { value: 'direkt', label: 'Direkt & Auf den Punkt' },
                  { value: 'überzeugend', label: 'Überzeugend & Marketing' },
                  { value: 'dringend', label: 'Dringend' },
                ]}
              />
            </div>
            <ToolSelect
              label="Ansprache"
              id="sonstigesAnsprache"
              name="sonstigesAnsprache"
              value={simpleForm.sonstigesAnsprache}
              onChange={handleSimpleFormChange}
              options={[
                { value: 'sie', label: 'Formell (Sie)' },
                { value: 'du', label: 'Informell (Du)' },
              ]}
            />
            <ToolInput
              label="Empfänger-Kontext"
              id="sonstigesRecipientContext"
              name="sonstigesRecipientContext"
              value={simpleForm.sonstigesRecipientContext}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Ein wichtiger Neukunde, Mein Vorgesetzter"
              required
            />
            <ToolInput
              label="Ziel der E-Mail"
              id="sonstigesGoal"
              name="sonstigesGoal"
              value={simpleForm.sonstigesGoal}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Ein Meeting für nächste Woche vorschlagen"
              required
            />
            <ToolTextarea
              label="Wichtige Stichpunkte (Optional)"
              id="sonstigesKeyPoints"
              name="sonstigesKeyPoints"
              value={simpleForm.sonstigesKeyPoints}
              onChange={handleSimpleFormChange}
              placeholder="Alle Infos, die unbedingt in die E-Mail müssen..."
              rows={4}
            />
          </div>
        )}

        {/* --- Fehler-Anzeige --- */}
        {error && (
          <div className="mt-6 text-sm text-red-900 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
            <strong>Fehler:</strong> {error}
          </div>
        )}

        {/* --- Senden-Button (Mit Validierung) --- */}
        <div className="pt-6 mt-6 border-t border-neutral-200">
          <button
            type="submit"
            disabled={isLoading || !formIsValid} // +++ NEU: Validierung +++
            className={cls(
              'flex w-full sm:w-auto justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity',
              (isLoading || !formIsValid) // +++ NEU: Validierung +++
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:opacity-90'
            )}
          >
            {isLoading ? (
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : null}
            {isLoading ? 'Schreibe...' : 'E-Mail generieren'}
          </button>
        </div>
      </form>
    );
  }; // Ende von renderFormView

  // --- HAUPT-RENDER ---
  return (
    <div className="relative isolate h-[100dvh] overflow-hidden bg-neutral-50 text-neutral-900">
      {/* --- Header --- */}
      <header className="h-12 sm:h-14 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/80 bg-white/80 border-b border-neutral-200 shadow-sm">
        <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center gap-2">
          {/* Zurück-Button */}
          <Link
            href="/chat"
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 hover:bg-neutral-100"
            aria-label="Zurück zum Hub"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded bg-neutral-900" />
            <span className="text-sm font-semibold tracking-wide truncate">
              SiniSpace / Werkzeuge
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex items-center justify-center sm:justify-start rounded-lg border border-red-300 bg-red-50 text-sm hover:bg-red-100 text-red-700 h-8 w-8 sm:w-auto sm:px-3 sm:py-1.5"
              title="Abmelden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                />
              </svg>
              <span className="hidden sm:inline sm:ml-1.5">Abmelden</span>
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center sm:justify-start rounded-lg border border-neutral-300 bg-white text-sm hover:bg-neutral-100 h-8 w-8 sm:w-auto sm:px-3 sm:py-1.5"
              title="Einstellungen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0h3.75m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75"
                />
              </svg>
              <span className="hidden sm:inline sm:ml-1.5">Einstellungen</span>
            </Link>
          </div>
        </div>
      </header>

      {/* --- Hauptinhalt: Formular & Ergebnisse --- */}
      <div className="h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-3.5rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:flex h-full border-r border-neutral-200 flex-col overflow-hidden bg-neutral-100 p-4">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Zurück zum Hub
          </Link>
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <h3 className="font-semibold text-neutral-900 mb-2">Werkzeuge</h3>
            <nav className="flex flex-col gap-1">
              <Link
                href="/tools/social-post"
                className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md"
              >
                Social Media Creator
              </Link>
              <Link
                href="/tools/marketing-plan"
                className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md"
              >
                Marketing Planer
              </Link>
              <Link
                href="/tools/email-assistant"
                className="text-sm font-medium bg-neutral-200 text-neutral-900 px-3 py-1.5 rounded-md"
              >
                E-Mail Assistent
              </Link>
              <Link
                href="/tools/rezept-bauer"
                className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md"
              >
                Rezept-Bauer
              </Link>
            </nav>
          </div>
        </aside>

        {/* Formular-Bereich (Jetzt dynamisch) */}
        <section className="h-full flex flex-col overflow-auto bg-white">
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
            <div className="mx-auto max-w-3xl">
              {/* +++ NEU: Dynamische View +++ */}
              {view === 'hub' && renderScenarioHub()}
              {view === 'form' && scenario && renderFormView()}

              {/* --- Ergebnis-Bereich --- */}
              {email && !isLoading && (
                <div className="mt-12 border-t border-neutral-200 pt-10">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-8">
                    E-Mail Entwurf
                  </h2>
                  <EmailResultCard
                    subject={email.subject}
                    body={email.body}
                    onRefine={handleRefine}
                    isRefining={isRefining}
                    refineError={refineError}
                    onTranslate={handleTranslate}
                    isTranslating={isTranslating}
                    translateError={translateError}
                    isOriginalGerman={!originalBody || originalBody === email.body}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Sub-Komponenten ---

const ToolInput = (
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }
) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
      {props.label}
    </label>
    <input
      {...props}
      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
    />
  </div>
);

const ToolTextarea = (
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }
) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
      {props.label}
    </label>
    <textarea
      {...props}
      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
    />
  </div>
);

const ToolSelect = (
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    id: string;
    options: { value: string; label: string }[];
  }
) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
      {props.label}
    </label>
    <select
      {...props}
      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
    >
      {props.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const ScenarioButton = ({
  title,
  description,
  onClick,
  icon,
  disabled = false,
}: {
  title: string;
  description: string;
  onClick: () => void;
  icon: string;
  disabled?: boolean;
}) => {
  const icons: Record<string, React.ReactNode> = {
    medical: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    calendar: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12v-.008Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75v-.008Zm0 2.25h.008v.008H9.75v-.008Zm0-2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5v-.008Zm0 2.25h.008v.008H7.5v-.008Zm0-2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm0-2.25h.008v.008h-.008v-.008Zm2.25-2.25h.008v.008h-.008V10.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Z"
      />
    ),
    reminder: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    request: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
      />
    ),
    complaint: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z"
      />
    ),
    // +++ NEUES ICON +++
    heart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.099 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
      />
    ),
    manual: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.343 3.94c.09-.542.56-1.004 1.11-1.204a.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-.25 3.668.5.5 0 0 1-.632.636 2.8 2.8 0 0 0-3.668-.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0 .25-3.668.5.5 0 0 1 .636-.632.5.5 0 0 1 .632.636 2.8 2.8 0 0 0 3.668.25.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-3.668.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0-.25-3.668.5.5 0 0 1 .632-.636Zm0 0c.09-.542.56-1.004 1.11-1.204a.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-.25 3.668.5.5 0 0 1-.632.636 2.8 2.8 0 0 0-3.668-.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0 .25-3.668.5.5 0 0 1 .636-.632.5.5 0 0 1 .632.636 2.8 2.8 0 0 0 3.668.25.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-3.668.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0-.25-3.668.5.5 0 0 1 .632-.636Zm0 0c.09-.542.56-1.004 1.11-1.204a.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-.25 3.668.5.5 0 0 1-.632.636 2.8 2.8 0 0 0-3.668-.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0 .25-3.668.5.5 0 0 1 .636-.632.5.5 0 0 1 .632.636 2.8 2.8 0 0 0 3.668.25.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-3.668.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0-.25-3.668.5.5 0 0 1 .632-.636Z"
      />
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls(
        'flex flex-col items-start justify-between p-4 rounded-lg border border-neutral-300 bg-white text-left transition-all',
        disabled
          ? 'opacity-50 cursor-not-allowed bg-neutral-100'
          : 'hover:border-indigo-500 hover:bg-indigo-50/50 hover:shadow-sm'
      )}
      style={{ minHeight: '130px' }}
    >
      <div>
        <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            {icons[icon] || icons['manual']}
          </svg>
        </div>
        <h3 className="font-semibold text-neutral-900 text-base">{title}</h3>
      </div>
      <p className="text-sm text-neutral-600 line-clamp-2">{description}</p>
    </button>
  );
};

// +++ ANGEPASST: Ergebnis-Karte mit Übersetzung +++
interface EmailResultCardProps {
  subject: string;
  body: string;
  onRefine: (instruction: RefineInstruction) => Promise<void>;
  isRefining: RefineInstruction | null;
  refineError: string | null;
  // +++ NEU +++
  onTranslate: (language: Language) => Promise<void>;
  isTranslating: Language | null;
  translateError: string | null;
  isOriginalGerman: boolean;
}

function EmailResultCard({
  subject,
  body,
  onRefine,
  isRefining,
  refineError,
  onTranslate,
  isTranslating,
  translateError,
  isOriginalGerman,
}: EmailResultCardProps) {
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const handleCopySubject = () => {
    copyText(subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyBody = () => {
    copyText(body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const components = {
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return (
          <code
            {...rest}
            className={cls(
              className,
              'rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.85em] break-words font-normal'
            )}
          >
            {children}
          </code>
        );
      }
      return (
        <pre className="my-3 rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto max-w-full">
          {String(children).replace(/\n$/, '')}
        </pre>
      );
    },
    a: (props: any) => <a {...props} className="underline break-words text-indigo-600" />,
    p: (props: any) => <p {...props} className="mb-3" />,
    ul: (props: any) => <ul {...props} className="list-disc pl-5 my-3" />,
    ol: (props: any) => <ol {...props} className="list-decimal pl-5 my-3" />,
    li: (props: any) => <li {...props} className="my-1" />,
  };

  // +++ NEU: Sprachoptionen +++
  const languageOptions: { value: Language; label: string }[] = [
    { value: 'Englisch', label: 'Englisch' },
    { value: 'Spanisch', label: 'Spanisch' },
    { value: 'Französisch', label: 'Französisch' },
    { value: 'Türkisch', label: 'Türkisch' },
  ];

  return (
    <div className="rounded-xl bg-white border border-neutral-200 shadow-sm">
      {/* Betreff-Zeile */}
      <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600 shrink-0">Betreff:</span>
          <span className="text-sm font-semibold text-neutral-900">{subject}</span>
        </div>
        <button
          onClick={handleCopySubject}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 shrink-0"
          disabled={copiedSubject}
        >
          {copiedSubject ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>

      {/* Textkörper */}
      <div className="p-4 sm:p-5 relative">
        <button
          onClick={handleCopyBody}
          className="absolute top-4 right-4 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          disabled={copiedBody}
        >
          {copiedBody ? 'Text kopiert!' : 'Text kopieren'}
        </button>

        <div
          className={cls(
            'prose prose-sm sm:prose-base prose-neutral text-neutral-800 prose-a:text-indigo-600 prose-strong:text-neutral-900',
            'prose-p:leading-relaxed',
            'prose-code:font-normal',
            'max-w-none'
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {body}
          </ReactMarkdown>
        </div>
      </div>

      {/* +++ ANGEPASST: "Feinschliff" & "Übersetzung" Sektion +++ */}
      <div className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-4 sm:px-5 space-y-3">
        {/* Zeile 1: Feinschliff */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-600 mr-2 shrink-0">Feinschliff:</span>
          <button
            onClick={() => onRefine('kürzer')}
            disabled={!!isRefining || !!isTranslating}
            className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefining === 'kürzer' ? (
              <svg
                className="animate-spin -ml-1 mr-1.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : null}
            {isRefining === 'kürzer' ? 'Wird gekürzt...' : 'Kürzer'}
          </button>
          <button
            onClick={() => onRefine('formeller')}
            disabled={!!isRefining || !!isTranslating}
            className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefining === 'formeller' ? (
              <svg
                className="animate-spin -ml-1 mr-1.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : null}
            {isRefining === 'formeller' ? 'Wird formeller...' : 'Formeller'}
          </button>
          <button
            onClick={() => onRefine('freundlicher')}
            disabled={!!isRefining || !!isTranslating}
            className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefining === 'freundlicher' ? (
              <svg
                className="animate-spin -ml-1 mr-1.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : null}
            {isRefining === 'freundlicher' ? 'Wird freundlicher...' : 'Freundlicher'}
          </button>
        </div>

        {/* Zeile 2: Übersetzung */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-600 mr-2 shrink-0">Übersetzen:</span>
          {isTranslating ? (
            <div className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700">
              <svg
                className="animate-spin -ml-1 mr-1.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {`Übersetze in ${isTranslating}...`}
            </div>
          ) : (
            <select
              id="language"
              name="language"
              onChange={(e) => onTranslate(e.target.value as Language)}
              disabled={!!isRefining || !!isTranslating}
              className="block w-auto rounded-md border-0 py-1 pl-2 pr-8 text-xs font-medium text-neutral-700 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              value={isOriginalGerman ? 'default' : ''} // Setzt Dropdown zurück, wenn auf Deutsch
            >
              <option value="default" disabled hidden>
                {isOriginalGerman ? 'In andere Sprache...' : 'Sprache wählen...'}
              </option>
              {languageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {!isOriginalGerman && <option value="Deutsch">(Zurück zu Deutsch)</option>}
            </select>
          )}
        </div>

        {/* Fehler-Anzeigen */}
        {refineError && (
          <div className="mt-2 text-xs text-red-900 bg-red-500/10 border border-red-400/30 rounded-md p-2">
            <strong>Fehler beim Anpassen:</strong> {refineError}
          </div>
        )}
        {translateError && (
          <div className="mt-2 text-xs text-red-900 bg-red-500/10 border border-red-400/30 rounded-md p-2">
            <strong>Fehler beim Übersetzen:</strong> {translateError}
          </div>
        )}
      </div>
    </div>
  );
}