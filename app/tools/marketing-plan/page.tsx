// app/tools/marketing-plan/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- Hilfsfunktionen (aus deiner app/chat/page.tsx) ---
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

// --- Typen für dieses Werkzeug ---
type BudgetLevel = 'niedrig' | 'mittel' | 'hoch';

interface FormData {
  productName: string;
  productDescription: string;
  targetAudience: string;
  mainGoals: string; // Wird ein Textfeld, kann mehrere Ziele enthalten
  usp: string; // Alleinstellungsmerkmal
  budgetLevel: BudgetLevel;
}

// Struktur, die wir von der API als Antwort erwarten
export interface MarketingPlan {
  executiveSummary: string;
  targetAudienceProfile: string;
  keyMessages: string;
  recommendedChannels: string; // Wird Markdown (z.B. Liste) sein
  campaignIdeas: string;       // Wird Markdown (z.B. Liste) sein
  successMetrics: string;      // Wird Markdown (z.B. Liste) sein
}

// --- Hauptkomponente ---
export default function MarketingPlanerPage() {
  const [formData, setFormData] = useState<FormData>({
    productName: '',
    productDescription: '',
    targetAudience: '',
    mainGoals: '',
    usp: '',
    budgetLevel: 'mittel',
  });
  const [plan, setPlan] = useState<MarketingPlan | null>(null); // State für den strukturierten Plan
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update für Formular-State
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // API-Aufruf beim Absenden
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setPlan(null); // Alten Plan zurücksetzen

    try {
      const response = await fetch('/api/tools/marketing-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      
      // Wir erwarten ein Objekt { plan: MarketingPlan } von der API
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

  return (
    <div className="relative isolate h-[100dvh] overflow-hidden bg-neutral-50 text-neutral-900">
      {/* --- Angepasster Header --- */}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0h3.75m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" />
              </svg>
              <span className="hidden sm:inline sm:ml-1.5">Einstellungen</span>
            </Link>
          </div>
        </div>
      </header>
      
      {/* --- Hauptinhalt: Formular & Ergebnisse --- */}
      <div className="h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-3.5rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        
        {/* Angepasste "Sidebar" für Werkzeuge */}
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
              <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
                Marketing Planer
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 mb-8">
                Definiere dein Produkt und deine Ziele. Die KI erstellt einen strukturierten Marketingplan.
              </p>

              {/* --- Das Formular --- */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="productName" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Produkt- oder Servicename
                  </label>
                  <input
                    type="text"
                    id="productName"
                    name="productName"
                    className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="z.B. SiniBoost App, Premium-Coaching 'Fokus'"
                    value={formData.productName}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="productDescription" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Produkt-/Service-Beschreibung
                  </label>
                  <textarea
                    id="productDescription"
                    name="productDescription"
                    rows={3}
                    className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="Was macht dein Produkt? Welches Problem löst es?"
                    value={formData.productDescription}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="targetAudience" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Detaillierte Zielgruppe
                  </label>
                  <textarea
                    id="targetAudience"
                    name="targetAudience"
                    rows={3}
                    className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="z.B. Solo-Selbstständige (30-45 J.), die mit Zeitmanagement kämpfen; viel auf LinkedIn unterwegs."
                    value={formData.targetAudience}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="usp" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Alleinstellungsmerkmal (USP)
                  </label>
                  <textarea
                    id="usp"
                    name="usp"
                    rows={2}
                    className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="Was macht dich/dein Produkt einzigartig? z.B. KI-Integration, persönlicher Support"
                    value={formData.usp}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="mainGoals" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Hauptziele
                    </label>
                    <input
                      type="text"
                      id="mainGoals"
                      name="mainGoals"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      placeholder="z.B. Markenbekanntheit, 100 Leads, 20 Verkäufe"
                      value={formData.mainGoals}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="budgetLevel" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Budget-Niveau
                    </label>
                    <select
                      id="budgetLevel"
                      name="budgetLevel"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      value={formData.budgetLevel}
                      onChange={handleFormChange}
                    >
                      {budgetOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

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
                    disabled={isLoading || !formData.productName.trim() || !formData.targetAudience.trim() || !formData.mainGoals.trim()}
                    className={cls(
                      'flex w-full sm:w-auto justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity',
                      (isLoading || !formData.productName.trim() || !formData.targetAudience.trim() || !formData.mainGoals.trim())
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

// --- Sub-Komponente für die Ergebnis-Abschnitte ---
function PlanSectionCard({ title, content }: { title: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Markdown-Komponenten (aus deiner MessageBubble)
  const components = {
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return <code {...rest} className={cls(className, 'rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.85em] break-words font-normal')} >{children}</code>;
      }
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : '';
      return <SyntaxHighlighter {...rest} style={oneLight} language={lang} PreTag="div" className="my-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto max-w-full">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>;
    },
    a: (props: any) => <a {...props} className="underline break-words text-indigo-600" />,
    table: (props: any) => (<div className="max-w-full overflow-auto my-3 border border-neutral-300 rounded-lg"><table {...props} className="w-full text-left border-collapse" /></div>),
    thead: (props: any) => <thead {...props} className="bg-neutral-100" />,
    th: (props: any) => <th {...props} className="p-2 border-b border-neutral-300" />,
    td: (props: any) => <td {...props} className="p-2 border-b border-neutral-300" />,
    // Markdown-Listen sollen besser aussehen
    ul: (props: any) => <ul {...props} className="list-disc pl-5 my-2" />,
    ol: (props: any) => <ol {...props} className="list-decimal pl-5 my-2" />,
    li: (props: any) => <li {...props} className="my-1" />, // <-- KORRIGIERTE ZEILE
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
            'prose-p:leading-relaxed', 'prose-code:font-normal'
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