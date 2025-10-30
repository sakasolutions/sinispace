// app/tools/social-post/page.tsx
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

// --- Typen für dieses Werkzeug ---
type Tone = 'professionell' | 'lustig' | 'inspirierend' | 'locker' | 'informativ';
type Platform = 'instagram' | 'linkedin' | 'facebook' | 'x-twitter'; // +++ NEU +++
type Goal = 'produkt' | 'rabatt' | 'community' | 'link' | 'inspiration'; // +++ NEU +++
type RefineInstruction = 'kuerzer' | 'emojis' | 'professioneller'; // +++ NEU +++

// +++ NEUE FormData +++
interface FormData {
  platform: Platform;
  goal: Goal;
  keyPoints: string;
  tone: Tone;
  count: number;
}

// +++ NEUES Ergebnis-Objekt ("Post-Kit") +++
export interface SocialPostKit {
  title: string;
  text: string;
  visualSuggestion: string;
  hashtags: string;
  ctaSuggestion: string;
}

// --- Hauptkomponente ---
export default function SocialPostCreatorPage() {
  // +++ NEUER State +++
  const [formData, setFormData] = useState<FormData>({
    platform: 'instagram',
    goal: 'produkt',
    keyPoints: '',
    tone: 'locker',
    count: 3,
  });
  const [variations, setVariations] = useState<SocialPostKit[]>([]); // +++ NEUER Typ +++
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // +++ NEU: Feinschliff-State +++
  const [isRefining, setIsRefining] = useState<{ index: number; type: RefineInstruction } | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  
  // Update für Formular-State
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'count' ? parseInt(value, 10) : value,
    }));
  };

  // +++ NEU: Plattform-Auswahl +++
  const handlePlatformChange = (platform: Platform) => {
    setFormData(prev => ({ ...prev, platform }));
  };

  // API-Aufruf beim Absenden
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setVariations([]);
    setRefineError(null);

    try {
      const response = await fetch('/api/tools/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      
      if (!data.variations || !Array.isArray(data.variations)) {
        throw new Error('Ungültige Antwort vom Server.');
      }
      
      setVariations(data.variations);

    } catch (err: any) {
      setError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  // +++ NEU: Feinschliff-Handler +++
  const handleRefine = async (index: number, instruction: RefineInstruction, postText: string) => {
    if (isRefining) return;

    setIsRefining({ index, type: instruction });
    setRefineError(null);

    const instructionMap: Record<RefineInstruction, string> = {
      'kuerzer': `Mache diesen Social-Media-Post kürzer und prägnanter. ${formData.platform === 'x-twitter' ? '(Maximal 280 Zeichen!)' : ''}`,
      'emojis': 'Füge diesem Text mehr passende und ansprechende Emojis hinzu.',
      'professioneller': `Formuliere diesen Text professioneller und formeller (weniger Emojis, klarere Sprache). Ideal für ${formData.platform === 'linkedin' ? 'LinkedIn' : 'ein Business-Publikum'}.`,
    };

    try {
      const response = await fetch('/api/tools/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: postText,
          instruction: instructionMap[instruction],
        }),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.refinedText) {
        throw new Error('Ungültige Antwort von der "Refine"-API.');
      }

      // Den Text in der richtigen Variante im State aktualisieren
      setVariations(prevVariations =>
        prevVariations.map((item, i) =>
          i === index ? { ...item, text: data.refinedText } : item
        )
      );

    } catch (err: any) {
      setRefineError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsRefining(null);
    }
  };


  // Optionen
  const toneOptions: { value: Tone; label: string }[] = [
    { value: 'professionell', label: 'Professionell' },
    { value: 'locker', label: 'Locker & Lässig' },
    { value: 'lustig', label: 'Lustig & Humorvoll' },
    { value: 'inspirierend', label: 'Inspirierend' },
    { value: 'informativ', label: 'Informativ & Sachlich' },
  ];

  // +++ NEU: Optionen für Plattformen und Ziele +++
  const platformOptions: { value: Platform; label: string; icon: React.ReactNode }[] = [
    { value: 'instagram', label: 'Instagram', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.703.01 5.556 0 5.829 0 8s.01 2.444.048 3.297c.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.445.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.556 15.99 5.829 16 8 16s2.444-.01 3.297-.048c.852-.04 1.433-.174 1.942-.372.526-.205.972-.478 1.417-.923.445-.445.718-.891.923-1.417.198-.509.333-1.09.372-1.942C15.99 10.444 16 10.171 16 8s-.01-2.444-.048-3.297c-.04-.852-.174-1.433-.372-1.942a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.09-.333-1.942-.372C10.444.01 10.171 0 8 0m0 1.442c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.282.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.598.92c-.28.28-.546.453-.92.598-.282.11-.705.24-1.485.276-.843.038-1.096.047-3.232.047s-2.389-.009-3.232-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.598-.92c-.11-.282-.24-.705-.276-1.485C1.442 10.444 1.434 10.17 1.434 8s.008-2.389.047-3.232c.036-.78.166-1.204.276-1.486.145-.373.319-.64.598-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.843-.038 1.096-.047 3.232-.047M8 3.882a4.108 4.108 0 1 0 0 8.216 4.108 4.108 0 0 0 0-8.216m0 6.772a2.664 2.664 0 1 1 0-5.328 2.664 2.664 0 0 1 0 5.328m4.338-7.863a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92"/></svg> },
    { value: 'linkedin', label: 'LinkedIn', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.016-.017.033-.033.05-.05.017-.017.034-.034.05-.05.028-.028.06-.05.093-.07.032-.02.067-.033.102-.043.035-.01.07-.01.107-.01s.07.003.105.01c.036.01.07.024.102.043.033.018.065.04.093.07s.034.034.05.05.033.033.05.05c.027.028.048.06.063.095.016.035.02.07.02.108s-.004.073-.02.108a.6.6 0 0 1-.063.095c-.017.017-.033.033-.05.05s-.034.034-.05.05a.7.7 0 0 1-.093.07c-.032.02-.067.033-.102.043-.035.01-.07.01-.107.01s-.07-.003-.105-.01a.7.7 0 0 1-.102-.043.7.7 0 0 1-.093-.07.7.7 0 0 1-.05-.05.7.7 0 0 1-.05-.05.6.6 0 0 1-.063-.095.6.6 0 0 1-.02-.108c0-.037.004-.073.02-.108.016-.035.037-.06.063-.095zM13.5 13.5h-2.435v-3.53c0-.845-.017-1.932-1.178-1.932-1.178 0-1.36.92-1.36 1.87v3.592H6.072V6.169h2.333v1.018h.033c.307-.582 1.06-1.196 2.226-1.196 2.39 0 2.831 1.572 2.831 3.618v4.2z"/></svg> },
    { value: 'facebook', label: 'Facebook', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0 0 3.603 0 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/></svg> },
    { value: 'x-twitter', label: 'X (Twitter)', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg> },
  ];

  const goalOptions: { value: Goal; label: string }[] = [
    { value: 'produkt', label: 'Ein Produkt/Service bewerben' },
    // +++ HIER WAR DER FEHLER (SyntaxError) +++
    { value: 'rabatt', label: 'Rabatt / Sale ankündigen' },
    { value: 'community', label: 'Community-Frage stellen' },
    { value: 'link', label: 'Einen Link / Blogartikel teilen' },
    { value: 'inspiration', label: 'Inspirierender Post / Zitat' },
  ];

  return (
    <div className="relative isolate h-[100dvh] overflow-hidden bg-neutral-50 text-neutral-900">
      {/* --- Header (VOLLSTÄNDIG) --- */}
      <header className="h-12 sm:h-14 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/80 bg-white/80 border-b border-neutral-200 shadow-sm">
        <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center gap-2">
          {/* Zurück-Button */}
          <Link
            href="/chat" // Link zurück zum Hub
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
                <Link href="/tools/social-post" className="text-sm font-medium bg-neutral-200 text-neutral-900 px-3 py-1.5 rounded-md">Social Media Creator</Link>
                <Link href="/tools/marketing-plan" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">Marketing Planer</Link>
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
                Social Media Post Creator
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 mb-8">
                Gib die Details für deinen Post ein. Die KI generiert dir komplette "Post-Kits".
              </p>

              {/* --- DAS NEUE FORMULAR --- */}
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Plattform-Auswahl */}
                <div>
                  <label className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Plattform
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {platformOptions.map(opt => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handlePlatformChange(opt.value)}
                        className={cls(
                          'flex items-center justify-center gap-2 rounded-md border py-2 px-3 text-sm font-medium transition-colors',
                          formData.platform === opt.value
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                        )}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Ziel-Auswahl */}
                <div>
                  <label htmlFor="goal" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Was ist das Ziel des Posts?
                  </label>
                  <select
                    id="goal"
                    name="goal"
                    className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={formData.goal}
                    onChange={handleFormChange}
                  >
                    {goalOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Stichpunkte */}
                <div>
                  <label htmlFor="keyPoints" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                    Wichtige Infos & Stichpunkte
                  </label>
                  <textarea
                    id="keyPoints"
                    name="keyPoints"
                    rows={4}
                    className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="z.B. Launch unseres neuen Produkts 'SiniBoost', 20% Rabatt nur am Wochenende, Link in Bio..."
                    value={formData.keyPoints}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="tone" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Tonalität
                    </label>
                    <select
                      id="tone"
                      name="tone"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      value={formData.tone}
                      onChange={handleFormChange}
                    >
                      {toneOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="count" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Anzahl Varianten (Max 3)
                    </label>
                    <input
                      type="number"
                      id="count"
                      name="count"
                      min="1"
                      max="3"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      value={formData.count}
                      onChange={handleFormChange}
                    />
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
                    disabled={isLoading || !formData.keyPoints.trim()}
                    className={cls(
                      'flex w-full sm:w-auto justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity',
                      (isLoading || !formData.keyPoints.trim())
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
                    {isLoading ? 'Generiere...' : 'Posts generieren'}
                  </button>
                </div>
              </form>

              {/* --- Ergebnis-Bereich --- */}
              {variations.length > 0 && (
                <div className="mt-12 border-t border-neutral-200 pt-10">
                  <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-6">
                    Erstellte "Post-Kits"
                  </h2>
                  {/* +++ NEU: Fehleranzeige für Feinschliff +++ */}
                  {refineError && (
                    <div className="mb-4 text-sm text-red-900 bg-red-500/10 border border-red-400/30 rounded-lg p-3">
                      <strong>Fehler beim Anpassen:</strong> {refineError}
                    </div>
                  )}
                  <div className="space-y-6">
                    {variations.map((postKit, index) => (
                      <PostResultCard
                        key={index}
                        postKit={postKit}
                        index={index}
                        onRefine={handleRefine}
                        isRefining={isRefining?.index === index ? isRefining.type : null}
                      />
                    ))}
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

// +++ NEUE SUB-KOMPONENTE: PostResultCard +++
interface PostResultCardProps {
  postKit: SocialPostKit;
  index: number;
  onRefine: (index: number, instruction: RefineInstruction, postText: string) => void;
  isRefining: RefineInstruction | null;
}
function PostResultCard({ postKit, index, onRefine, isRefining }: PostResultCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(postKit.text); // Kopiert nur den Post-Text
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
    a: (props: any) => <a {...props} className="underline break-words text-indigo-600" />,
    table: (props: any) => (<div className="max-w-full overflow-auto my-3 border border-neutral-300 rounded-lg"><table {...props} className="w-full text-left border-collapse" /></div>),
    thead: (props: any) => <thead {...props} className="bg-neutral-100" />,
    th: (props: any) => <th {...props} className="p-2 border-b border-neutral-300" />,
    td: (props: any) => <td {...props} className="p-2 border-b border-neutral-300" />,
  };

  const refineButton = (instruction: RefineInstruction, label: string) => (
    <button
      onClick={() => onRefine(index, instruction, postKit.text)}
      disabled={!!isRefining}
      className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRefining === instruction ? (
        <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : null}
      {isRefining === instruction ? 'Moment...' : label}
    </button>
  );

  return (
    <div className="rounded-xl bg-white border border-neutral-200 shadow-sm">
      {/* Header-Karte */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-neutral-200 bg-neutral-50/70 rounded-t-xl">
        <h3 className="text-base sm:text-lg font-semibold text-neutral-900">
          Vorschlag {index + 1}: <span className="text-indigo-600">{postKit.title}</span>
        </h3>
        <button
          onClick={handleCopy}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          disabled={copied}
        >
          {copied ? 'Text kopiert!' : 'Kopieren'}
        </button>
      </div>
      
      {/* Inhalt-Karte */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Sektion 1: Visual */}
        <div>
          <label className="text-xs font-semibold uppercase text-neutral-500">💡 Visual-Tipp</label>
          <p className="text-sm text-neutral-700">{postKit.visualSuggestion}</p>
        </div>

        {/* Sektion 2: Post-Text */}
        <div>
          <label className="text-xs font-semibold uppercase text-neutral-500">✍️ Post-Text</label>
          <div
            className={cls(
              'prose prose-sm sm:prose-base prose-neutral text-neutral-800 prose-a:text-indigo-600 prose-strong:text-neutral-900',
              'prose-p:leading-relaxed', 'prose-code:font-normal', 'max-w-none', 'mt-1',
              'whitespace-pre-wrap' // WICHTIG für Zeilenumbrüche
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {postKit.text}
            </ReactMarkdown>
          </div>
        </div>
        
        {/* Sektion 3: CTA & Hashtags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-neutral-500">👉 Call-to-Action</label>
            <p className="text-sm text-neutral-700">{postKit.ctaSuggestion}</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-neutral-500">🏷️ Hashtags</label>
            <p className="text-sm text-neutral-700 break-words">{postKit.hashtags}</p>
          </div>
        </div>
      </div>
      
      {/* Footer-Karte: Feinschliff */}
      <div className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 sm:px-5 rounded-b-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-600 mr-2 shrink-0">Feinschliff:</span>
          {refineButton('kuerzer', 'Kürzer')}
          {refineButton('emojis', 'Mehr Emojis')}
          {refineButton('professioneller', 'Professioneller')}
        </div>
      </div>
    </div>
  );
}