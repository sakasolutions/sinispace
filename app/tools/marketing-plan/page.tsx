// app/tools/marketing-plan/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- Hilfsfunktionen ---
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

// --- Typen ---
type BudgetLevel = 'niedrig' | 'mittel' | 'hoch';

// +++ NEU: Typen für den Szenario-Hub +++
type ViewState = 'hub' | 'form';
type Scenario = 'product-launch' | 'social-growth' | 'sale-event' | 'local-event' | 'manual';

// Das ist die "Experten-Form", die an die API gesendet wird
interface ApiFormData {
  productName: string;
  productDescription: string;
  targetAudience: string;
  mainGoals: string;
  usp: string;
  budgetLevel: BudgetLevel;
}

// +++ NEU: Die "Idiotensichere" Form, die der Nutzer sieht +++
interface SimpleFormData {
  // Für alle Szenarien
  budgetLevel: BudgetLevel;
  
  // Szenario 'product-launch'
  productName: string;
  productDesc: string;
  simpleAudience: string;

  // Szenario 'social-growth'
  socialPlatform: 'Instagram' | 'TikTok' | 'LinkedIn' | 'Facebook';
  socialAudience: string;

  // Szenario 'sale-event'
  saleDetails: string;
  saleAudience: string;

  // Szenario 'manual' (Dein altes Formular)
  manualProductName: string;
  manualProductDescription: string;
  manualTargetAudience: string;
  manualMainGoals: string;
  manualUsp: string;
}

// Struktur, die wir von der API als Antwort erwarten
export interface MarketingPlan {
  executiveSummary: string;
  targetAudienceProfile: string;
  keyMessages: string;
  recommendedChannels: string;
  campaignIdeas: string;
  successMetrics: string;
}

// --- Hauptkomponente ---
export default function MarketingPlanerPage() {
  // +++ NEU: View- und Szenario-State +++
  const [view, setView] = useState<ViewState>('hub');
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // +++ NEU: State für vereinfachte Formulare +++
  const [simpleForm, setSimpleForm] = useState<SimpleFormData>({
    budgetLevel: 'mittel',
    productName: '',
    productDesc: '',
    simpleAudience: '',
    socialPlatform: 'Instagram',
    socialAudience: '',
    saleDetails: '',
    saleAudience: '',
    manualProductName: '',
    manualProductDescription: '',
    manualTargetAudience: '',
    manualMainGoals: '',
    manualUsp: '',
  });

  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  // +++ NEU: Auswahl eines Szenarios +++
  const handleSelectScenario = (selectedScenario: Scenario) => {
    setScenario(selectedScenario);
    setView('form');
    setPlan(null); // Alte Ergebnisse löschen
    setError(null);
  };

  // +++ NEU: Zurück zum Hub +++
  const handleBackToHub = () => {
    setView('hub');
    setScenario(null);
    setPlan(null);
    setError(null);
  };

  // +++ NEU: Die "Übersetzungs-Magie" (Simple Form -> API Form) +++
  const buildApiFormData = (): ApiFormData => {
    switch (scenario) {
      case 'product-launch':
        return {
          productName: simpleForm.productName,
          productDescription: simpleForm.productDesc,
          targetAudience: simpleForm.simpleAudience,
          mainGoals: 'Launch eines neuen Produkts, Steigerung der Bekanntheit, erste Verkäufe erzielen.',
          usp: 'Vom Nutzer nicht spezifiziert. Bitte aus der Produktbeschreibung ableiten.',
          budgetLevel: simpleForm.budgetLevel,
        };

      case 'social-growth':
        return {
          productName: `Social Media Kanal (${simpleForm.socialPlatform})`,
          productDescription: `Unser Ziel ist es, unseren ${simpleForm.socialPlatform}-Kanal auszubauen und eine Community zu etablieren.`,
          targetAudience: simpleForm.socialAudience,
          mainGoals: `Follower-Wachstum und Steigerung der Engagement-Rate auf ${simpleForm.socialPlatform}.`,
          usp: 'Hochwertiger, zielgruppenspezifischer Content.',
          budgetLevel: simpleForm.budgetLevel,
        };

      case 'sale-event':
        return {
          productName: 'Rabatt-Aktion / Sale',
          productDescription: `Wir planen eine Rabatt-Aktion. Details: ${simpleForm.saleDetails}`,
          targetAudience: simpleForm.saleAudience,
          mainGoals: 'Kurzfristige Umsatzsteigerung, Abverkauf von Lagerbeständen, Neukundengewinnung.',
          usp: `Zeitlich begrenztes Sonderangebot: ${simpleForm.saleDetails}`,
          budgetLevel: simpleForm.budgetLevel,
        };
      
      // (Hier können 'local-event' etc. ergänzt werden)

      case 'manual':
      default:
        // Das ist dein altes, "Experten"-Formular
        return {
          productName: simpleForm.manualProductName,
          productDescription: simpleForm.manualProductDescription,
          targetAudience: simpleForm.manualTargetAudience,
          mainGoals: simpleForm.manualMainGoals,
          usp: simpleForm.manualUsp,
          budgetLevel: simpleForm.budgetLevel,
        };
    }
  };
  
  // +++ NEU: Validierungs-Logik +++
  const isFormValid = (): boolean => {
      if (!scenario) return false;
      
      switch (scenario) {
        case 'product-launch':
          return simpleForm.productName.trim() !== '' && simpleForm.productDesc.trim() !== '' && simpleForm.simpleAudience.trim() !== '';
        case 'social-growth':
          return simpleForm.socialAudience.trim() !== '';
        case 'sale-event':
          return simpleForm.saleDetails.trim() !== '' && simpleForm.saleAudience.trim() !== '';
        case 'manual':
          return simpleForm.manualProductName.trim() !== '' && simpleForm.manualTargetAudience.trim() !== '' && simpleForm.manualMainGoals.trim() !== '';
        default:
          return false;
      }
  };

  // API-Aufruf beim Absenden
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || !isFormValid()) return;

    setIsLoading(true);
    setError(null);
    setPlan(null);

    // +++ NEU: API-Daten dynamisch bauen +++
    const apiFormData = buildApiFormData();

    try {
      const response = await fetch('/api/tools/marketing-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiFormData), // Sende die übersetzten Daten
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      
      if (!data.plan) {
        throw new Error('Ungültige Antwort vom Server: "plan"-Objekt fehlt.');
      }
      
      setPlan(data.plan);

    } catch (err: any) {
      setError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  // Optionen für Budget
  const budgetOptions: { value: BudgetLevel; label: string }[] = [
    { value: 'niedrig', label: 'Niedrig (Fokus auf organisch/Social Media)' },
    { value: 'mittel', label: 'Mittel (Mix aus organisch & bezahlten Ads)' },
    { value: 'hoch', label: 'Hoch (Großangelegte Kampagnen möglich)' },
  ];
  
  // --- RENDER-FUNKTIONEN ---

  // +++ NEU: Rendert den "Szenario-Hub" +++
  const renderScenarioHub = () => (
    <>
      <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
        Marketing Planer
      </h1>
      <p className="text-sm sm:text-base text-neutral-600 mb-8">
        Was ist dein Ziel? Wähle ein Szenario, um einen umsetzbaren Plan zu erhalten.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ScenarioButton
          title="Neues Produkt / Service starten"
          description="Erhalte einen Launch-Plan, von Teasern bis zu ersten Verkäufen."
          onClick={() => handleSelectScenario('product-launch')}
          icon="rocket"
        />
        <ScenarioButton
          title="Mehr Social Media Follower"
          description="Erstelle einen Content-Plan, um deine Community aufzubauen."
          onClick={() => handleSelectScenario('social-growth')}
          icon="instagram"
        />
        <ScenarioButton
          title="Rabatt-Aktion / Sale planen"
          description="Erhalte Ideen, um deinen Sale effektiv zu bewerben."
          onClick={() => handleSelectScenario('sale-event')}
          icon="sale"
        />
        <ScenarioButton
          title="Lokale Veranstaltung bewerben"
          description="Plane, wie du Leute aus deiner Region erreichst."
          onClick={() => alert('Dieses Szenario ist noch nicht implementiert.')} // TODO
          icon="pin"
          disabled
        />
        <ScenarioButton
          title="Manueller Plan (Experten-Modus)"
          description="Definiere alle Parameter (USP, Ziele, etc.) selbst."
          onClick={() => handleSelectScenario('manual')}
          icon="manual"
        />
      </div>
    </>
  );
  
  // +++ NEU: Rendert das dynamische Formular +++
  const renderFormView = () => {
    const formIsValid = isFormValid(); // Für den Button-Status
    
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Zurück-Button */}
        <button
          type="button"
          onClick={handleBackToHub}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Andere Vorlage wählen
        </button>

        {/* --- RENDER: Szenario "Product Launch" --- */}
        {scenario === 'product-launch' && (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">Neues Produkt / Service starten</h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">Beantworte 3 simple Fragen für deinen Launch-Plan.</p>
            <ToolInput
              label="Wie heißt dein Produkt/Service?"
              id="productName"
              name="productName"
              value={simpleForm.productName}
              onChange={handleSimpleFormChange}
              placeholder="z.B. SiniBoost App"
              required
            />
            <ToolTextarea
              label="Was ist das Wichtigste daran (in einem Satz)?"
              id="productDesc"
              name="productDesc"
              rows={3}
              value={simpleForm.productDesc}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Eine App, die dir hilft, Alltagsaufgaben mit KI zu lösen."
              required
            />
            <ToolTextarea
              label="Wer soll das kaufen (in einem Satz)?"
              id="simpleAudience"
              name="simpleAudience"
              rows={3}
              value={simpleForm.simpleAudience}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Leute, die von Technik überfordert sind, aber Zeit sparen wollen."
              required
            />
            <ToolSelect
              label="Budget-Niveau"
              id="budgetLevel"
              name="budgetLevel"
              value={simpleForm.budgetLevel}
              onChange={handleSimpleFormChange}
              options={budgetOptions}
            />
          </>
        )}
        
        {/* --- RENDER: Szenario "Social Growth" --- */}
        {scenario === 'social-growth' && (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">Mehr Social Media Follower</h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">Plane deine Wachstumsstrategie.</p>
            <ToolSelect
              label="Welche Plattform?"
              id="socialPlatform"
              name="socialPlatform"
              value={simpleForm.socialPlatform}
              onChange={handleSimpleFormChange}
              options={[
                { value: 'Instagram', label: 'Instagram' },
                { value: 'TikTok', label: 'TikTok' },
                { value: 'LinkedIn', label: 'LinkedIn' },
                { value: 'Facebook', label: 'Facebook' },
              ]}
            />
            <ToolTextarea
              label="Wen möchtest du erreichen?"
              id="socialAudience"
              name="socialAudience"
              rows={3}
              value={simpleForm.socialAudience}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Junge Mütter, die schnelle Rezepte suchen / B2B-Entscheider im IT-Bereich"
              required
            />
            <ToolSelect
              label="Budget-Niveau"
              id="budgetLevel"
              name="budgetLevel"
              value={simpleForm.budgetLevel}
              onChange={handleSimpleFormChange}
              options={budgetOptions}
            />
          </>
        )}
        
        {/* --- RENDER: Szenario "Sale Event" --- */}
        {scenario === 'sale-event' && (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">Rabatt-Aktion / Sale planen</h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">Beschreibe deine Aktion, um sie zu bewerben.</p>
            <ToolTextarea
              label="Was beinhaltet dein Sale?"
              id="saleDetails"
              name="saleDetails"
              rows={3}
              value={simpleForm.saleDetails}
              onChange={handleSimpleFormChange}
              placeholder="z.B. 20% Rabatt auf alle Sommer-Produkte, nur dieses Wochenende."
              required
            />
            <ToolTextarea
              label="Wen möchtest du erreichen?"
              id="saleAudience"
              name="saleAudience"
              rows={3}
              value={simpleForm.saleAudience}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Bestehende Kunden (per E-Mail) und neue Schnäppchenjäger (per Social Media)."
              required
            />
            <ToolSelect
              label="Budget-Niveau"
              id="budgetLevel"
              name="budgetLevel"
              value={simpleForm.budgetLevel}
              onChange={handleSimpleFormChange}
              options={budgetOptions}
            />
          </>
        )}

        {/* --- RENDER: Szenario "Manual" (Dein altes Formular) --- */}
        {scenario === 'manual' && (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">Manueller Planer (Experten-Modus)</h1>
            <p className="text-sm sm:text-base text-neutral-600 -mt-2 mb-6">Definiere alle Parameter selbst für einen detaillierten Plan.</p>
            <ToolInput
              label="Produkt- oder Servicename"
              id="manualProductName"
              name="manualProductName"
              value={simpleForm.manualProductName}
              onChange={handleSimpleFormChange}
              placeholder="z.B. SiniBoost App, Premium-Coaching 'Fokus'"
              required
            />
            <ToolTextarea
              label="Produkt-/Service-Beschreibung"
              id="manualProductDescription"
              name="manualProductDescription"
              rows={3}
              value={simpleForm.manualProductDescription}
              onChange={handleSimpleFormChange}
              placeholder="Was macht dein Produkt? Welches Problem löst es?"
              required
            />
            <ToolTextarea
              label="Detaillierte Zielgruppe"
              id="manualTargetAudience"
              name="manualTargetAudience"
              rows={3}
              value={simpleForm.manualTargetAudience}
              onChange={handleSimpleFormChange}
              placeholder="z.B. Solo-Selbstständige (30-45 J.), die mit Zeitmanagement kämpfen..."
              required
            />
            <ToolTextarea
              label="Alleinstellungsmerkmal (USP)"
              id="manualUsp"
              name="manualUsp"
              rows={2}
              value={simpleForm.manualUsp}
              onChange={handleSimpleFormChange}
              placeholder="Was macht dich/dein Produkt einzigartig? z.B. KI-Integration, persönlicher Support"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ToolInput
                label="Hauptziele"
                id="manualMainGoals"
                name="manualMainGoals"
                value={simpleForm.manualMainGoals}
                onChange={handleSimpleFormChange}
                placeholder="z.B. Markenbekanntheit, 100 Leads, 20 Verkäufe"
                required
              />
              <ToolSelect
                label="Budget-Niveau"
                id="budgetLevel"
                name="budgetLevel"
                value={simpleForm.budgetLevel}
                onChange={handleSimpleFormChange}
                options={budgetOptions}
              />
            </div>
          </>
        )}

        {/* --- Fehler-Anzeige --- */}
        {error && (
          <div className="mt-2 text-sm text-red-900 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
            <strong>Fehler:</strong> {error}
          </div>
        )}
        
        {/* --- Senden-Button --- */}
        <div className="pt-2">
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
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            {isLoading ? 'Erstelle Plan...' : 'Marketingplan generieren'}
          </button>
        </div>
      </form>
    );
  }; // Ende von renderFormView()


  return (
    <div className="relative isolate h-[100dvh] overflow-hidden bg-neutral-50 text-neutral-900">
      {/* --- Header (VOLLSTÄNDIG) --- */}
      <header className="h-12 sm:h-14 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/80 bg-white/80 border-b border-neutral-200 shadow-sm">
        <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center gap-2">
          {/* Zurück-Button */}
          <Link
            href="/chat"
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 hover:bg-neutral-100"
            aria-label="Zurück zum Hub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded bg-neutral-900" />
            <span className="text-sm font-semibold tracking-wide truncate">SiniSpace / Werkzeuge</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex items-center justify-center sm:justify-start rounded-lg border border-red-300 bg-red-50 text-sm hover:bg-red-100 text-red-700 h-8 w-8 sm:w-auto sm:px-3 sm:py-1.5"
              title="Abmelden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              <span className="hidden sm:inline sm:ml-1.5">Abmelden</span>
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center sm:justify-start rounded-lg border border-neutral-300 bg-white text-sm hover:bg-neutral-100 h-8 w-8 sm:w-auto sm:px-3 sm:py-1.5"
              title="Einstellungen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3-7.5 0h3.75m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" />
              </svg>
              <span className="hidden sm:inline sm:ml-1.5">Einstellungen</span>
            </Link>
          </div>
        </div>
      </header>
      
      {/* --- Hauptinhalt: Formular & Ergebnisse --- */}
      <div className="h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-3.5rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        
        {/* Angepasste "Sidebar" für Werkzeuge (VOLLSTÄNDIG) */}
        <aside className="hidden lg:flex h-full border-r border-neutral-200 flex-col overflow-hidden bg-neutral-100 p-4">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Zurück zum Hub
          </Link>
          <div className="mt-4 border-t border-neutral-200 pt-4">
             <h3 className="font-semibold text-neutral-900 mb-2">Werkzeuge</h3>
             <nav className="flex flex-col gap-1">
                <Link href="/tools/social-post" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">Social Media Creator</Link>
                <Link href="/tools/marketing-plan" className="text-sm font-medium bg-neutral-200 text-neutral-900 px-3 py-1.5 rounded-md">Marketing Planer</Link>
                <Link href="/tools/email-assistant" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">E-Mail Assistent</Link>
                <Link href="/tools/rezept-bauer" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">Rezept-Bauer</Link>
             </nav>
          </div>
        </aside>

        {/* Formular-Bereich */}
        <section className="h-full flex flex-col overflow-auto bg-white">
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
            <div className="mx-auto max-w-3xl">
              
              {/* +++ NEU: Dynamische View +++ */}
              {view === 'hub' && renderScenarioHub()}
              {view === 'form' && scenario && renderFormView()}

              {/* --- Ergebnis-Bereich --- */}
              {plan && !isLoading && (
                <div className="mt-12 border-t border-neutral-200 pt-10">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-8">
                    Dein Marketingplan
                  </h2>
                  <div className="space-y-8">
                    <PlanSectionCard title="Executive Summary" content={plan.executiveSummary} />
                    <PlanSectionCard title="Zielgruppen-Profil" content={plan.targetAudienceProfile} />
                    <PlanSectionCard title="Kernbotschaften & USPs" content={plan.keyMessages} />
                    <PlanSectionCard title="Empfohlene Kanäle" content={plan.recommendedChannels} />
                    <PlanSectionCard title="Kampagnen-Ideen" content={plan.campaignIdeas} />
                    <PlanSectionCard title="Erfolgsmessung (KPIs)" content={plan.successMetrics} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Sub-Komponenten (aus deiner Datei kopiert und angepasst) ---

// +++ NEU: Helfer-Komponenten für Formulare +++
const ToolInput = (props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; }) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium leading-6 text-neutral-900 mb-2">{props.label}</label>
    <input {...props} className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
  </div>
);

const ToolTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string; }) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium leading-6 text-neutral-900 mb-2">{props.label}</label>
    <textarea {...props} className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
  </div>
);

const ToolSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; options: { value: string; label: string }[] }) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium leading-6 text-neutral-900 mb-2">{props.label}</label>
    <select {...props} className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
      {props.options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// +++ NEU: Szenario-Button (aus E-Mail-Tool adaptiert) +++
const ScenarioButton = ({ title, description, onClick, icon, disabled = false }: {
  title: string,
  description: string,
  onClick: () => void,
  icon: string,
  disabled?: boolean
}) => {
  const icons: Record<string, React.ReactNode> = {
    rocket: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.81m5.84-2.57a14.98 14.98 0 0 0 6.16-3.32m-6.16 3.32a14.98 14.98 0 0 1-5.84 2.57m5.84-2.57V3.54m0 8.27a15.02 15.02 0 0 0-4.47-2.57m4.47 2.57a15.02 15.02 0 0 1 4.47 2.57m0 0a9 9 0 1 1-1.57-5.59m1.57 5.59a15.02 15.02 0 0 1-4.47 2.57m4.47-2.57a15.02 15.02 0 0 0 4.47-2.57m-4.47 2.57 4.47 2.57m0 0a9 9 0 1 0-1.57-5.59m1.57 5.59-4.47 2.57m-4.47-2.57a9 9 0 1 0 1.57 5.59m-1.57-5.59-4.47-2.57m0 0a15.02 15.02 0 0 1-4.47-2.57m0 0c-.27.14-.55.27-.84.38" /></svg>,
    instagram: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
    sale: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>,
    pin: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
    manual: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.004 1.11-1.204a.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-.25 3.668.5.5 0 0 1-.632.636 2.8 2.8 0 0 0-3.668-.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0 .25-3.668.5.5 0 0 1 .636-.632.5.5 0 0 1 .632.636 2.8 2.8 0 0 0 3.668.25.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-3.668.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0-.25-3.668.5.5 0 0 1 .632-.636Zm0 0c.09-.542.56-1.004 1.11-1.204a.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-.25 3.668.5.5 0 0 1-.632.636 2.8 2.8 0 0 0-3.668-.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0 .25-3.668.5.5 0 0 1 .636-.632.5.5 0 0 1 .632.636 2.8 2.8 0 0 0 3.668.25.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-3.668.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0-.25-3.668.5.5 0 0 1 .632-.636Zm0 0c.09-.542.56-1.004 1.11-1.204a.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-.25 3.668.5.5 0 0 1-.632.636 2.8 2.8 0 0 0-3.668-.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0 .25-3.668.5.5 0 0 1 .636-.632.5.5 0 0 1 .632.636 2.8 2.8 0 0 0 3.668.25.5.5 0 0 1 .632.636 2.8 2.8 0 0 0-3.668.25.5.5 0 0 1-.636-.632 2.8 2.8 0 0 0-.25-3.668.5.5 0 0 1 .632-.636Z" /></svg>,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls(
        "flex flex-col items-start justify-between p-4 rounded-lg border border-neutral-300 bg-white text-left transition-all",
        disabled 
          ? "opacity-50 cursor-not-allowed bg-neutral-100"
          : "hover:border-indigo-500 hover:bg-indigo-50/50 hover:shadow-sm"
      )}
      style={{ minHeight: '130px' }}
    >
      <div>
        <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 mb-2">
          {icons[icon] || icons['manual']}
        </div>
        <h3 className="font-semibold text-neutral-900 text-base">{title}</h3>
      </div>
      <p className="text-sm text-neutral-600 line-clamp-2">{description}</p>
    </button>
  );
};

// --- Sub-Komponente für die Ergebnis-Abschnitte (aus deiner Datei) ---
function PlanSectionCard({ title, content }: { title: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Versucht, Markdown in reinen Text für das Clipboard umzuwandeln (einfache Ersetzung)
    const plainText = content
      .replace(/### (.*)/g, '$1\n')
      .replace(/## (.*)/g, '$1\n')
      .replace(/# (.*)/g, '$1\n')
      .replace(/[\*_]([^\*_]+)[\*_]/g, '$1') // Fett/Kursiv
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links
      .replace(/(\n){2,}/g, '\n\n') // Mehrfache Zeilenumbrüche
      .replace(/- /g, '\n- ') // Listenpunkte
      .trim();
      
    copyText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Markdown-Komponenten
  const components = {
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return <code {...rest} className={cls(className, 'rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.85em] break-words font-normal')} >{children}</code>;
      }
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : '';
      return <SyntaxHighlighter {...rest} style={oneLight} language={lang} PreTag="div" className="my-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto max-w-full">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>;
    },
    a: (props: any) => <a {...props} className="underline break-words text-indigo-600" target="_blank" rel="noopener noreferrer" />,
    table: (props: any) => (<div className="max-w-full overflow-auto my-3 border border-neutral-300 rounded-lg"><table {...props} className="w-full text-left border-collapse" /></div>),
    thead: (props: any) => <thead {...props} className="bg-neutral-100" />,
    th: (props: any) => <th {...props} className="p-2 border-b border-neutral-300" />,
    td: (props: any) => <td {...props} className="p-2 border-b border-neutral-300" />,
    ul: (props: any) => <ul {...props} className="list-disc pl-5 my-2" />,
    ol: (props: any) => <ol {...props} className="list-decimal pl-5 my-2" />,
    li: (props: any) => <li {...props} className="my-1.5" />,
    p: (props: any) => <p {...props} className="text-neutral-700" />,
  };

  return (
    <div className="rounded-xl bg-white border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-neutral-200">
        <h3 className="text-base sm:text-lg font-semibold text-neutral-900">
          {title}
        </h3>
        <button
          onClick={handleCopy}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          disabled={copied}
        >
          {copied ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>
      <div className="p-4 sm:p-5">
        <div
          className={cls(
            'prose prose-sm sm:prose-base prose-neutral text-neutral-800 prose-a:text-indigo-600 prose-strong:text-neutral-900',
            'prose-p:leading-relaxed', 'prose-code:font-normal', 'max-w-none'
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}