// app/tools/rezept-bauer/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Hilfsfunktionen ---
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

// --- Typen für dieses Werkzeug ---
type DietType = 'alles' | 'vegetarisch' | 'vegan' | 'glutenfrei';
type TimeFrame = 'schnell' | 'mittel' | 'egal';
type PersonCount = '1' | '2' | '3-4'; // +++ NEU +++

// +++ NEU: FormData verwendet jetzt Arrays +++
interface FormData {
  mainIngredients: string[]; // Wird durch TagInput verwaltet
  pantryItems: string[];     // Wird durch PantryChecklist verwaltet
  diet: DietType;
  timeframe: TimeFrame;
  personCount: PersonCount; // +++ NEU +++
}

// Struktur, die wir von der API als Antwort erwarten
export interface GeneratedRecipe {
  title: string;
  description: string;
  ingredients: string; // Als Markdown-Liste
  instructions: string; // Als Markdown (nummerierte Liste)
  prepTime: string; // z.B. "ca. 15 Minuten"
}

// +++ NEU: Typ für Feinschliff +++
type RefineInstruction = 'neue-idee' | 'einfacher' | 'gesuender';

// --- Hauptkomponente ---
export default function RezeptBauerPage() {
  // +++ ANGEPASSTER State +++
  const [formData, setFormData] = useState<FormData>({
    mainIngredients: [],
    pantryItems: ['Öl', 'Salz', 'Pfeffer', 'Zwiebeln', 'Knoblauch'], // Vorausgewählt
    diet: 'alles',
    timeframe: 'mittel',
    personCount: '2', // +++ NEU (Default 2 Personen) +++
  });
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // +++ NEU: States für Feinschliff & Einkaufsliste +++
  const [isRefining, setIsRefining] = useState<RefineInstruction | null>(null);
  const [shoppingList, setShoppingList] = useState<string | null>(null);
  const [isShoppingListLoading, setIsShoppingListLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null); // Für Refine/Shopping-Fehler
  
  // Update für Dropdowns
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // +++ NEU: Handler für Tag-Eingabe +++
  const handleMainIngredientsChange = (newIngredients: string[]) => {
    setFormData(prev => ({ ...prev, mainIngredients: newIngredients }));
  };
  
  // +++ NEU: Handler für Checkboxen +++
  const handlePantryItemsChange = (newPantryItems: string[]) => {
    setFormData(prev => ({ ...prev, pantryItems: newPantryItems }));
  };

  // API-Aufruf beim Absenden
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || formData.mainIngredients.length === 0) return;

    setIsLoading(true);
    setError(null);
    setRecipe(null);
    setApiError(null);
    setShoppingList(null);

    try {
      const response = await fetch('/api/tools/rezept-bauer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData), // Sendet jetzt die Arrays
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      
      // Wir erwarten ein Objekt { recipe: GeneratedRecipe } von der API
      if (!data.recipe || !data.recipe.title || !data.recipe.ingredients || !data.recipe.instructions) {
        throw new Error('Ungültige Antwort vom Server: "recipe"-Objekt fehlt oder ist unvollständig.');
      }
      
      setRecipe(data.recipe);

    } catch (err: any) {
      setError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  // +++ NEU: Handler für Feinschliff-Buttons +++
  const handleRefine = async (instruction: RefineInstruction) => {
    if (isRefining || !recipe) return;

    setIsRefining(instruction);
    setApiError(null);
    setShoppingList(null); // Einkaufsliste zurücksetzen

    try {
      const response = await fetch('/api/tools/rezept-bauer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData, // Schickt die originalen Zutaten
          refineInstruction: instruction, // Schickt die newe Anweisung
          currentRecipe: JSON.stringify(recipe), // Schickt das aktuelle Rezept als Kontext
        }),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.recipe) {
        throw new Error('Ungültige Antwort vom Server.');
      }
      setRecipe(data.recipe); // Überschreibt das alte Rezept

    } catch (err: any) {
      setApiError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsRefining(null);
    }
  };
  
  // +++ NEU: Handler für Einkaufsliste +++
  const handleShoppingList = async () => {
    if (isShoppingListLoading || !recipe) return;

    setIsShoppingListLoading(true);
    setApiError(null);
    setShoppingList(null);

    const userIngredients = [...formData.mainIngredients, ...formData.pantryItems];
    
    try {
      const response = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIngredients: userIngredients,
          recipeIngredients: recipe.ingredients, // Schickt die Markdown-Liste der Rezept-Zutaten
        }),
      });

      if (!response.ok) {
        throw new Error(`API-Fehler (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.shoppingList) {
        throw new Error('Ungültige Antwort von der Einkaufslisten-API.');
      }
      setShoppingList(data.shoppingList); // Setzt die neue Einkaufsliste

    } catch (err: any) {
      setApiError(err.message ?? 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsShoppingListLoading(false);
    }
  };


  // Optionen
  const dietOptions: { value: DietType; label: string }[] = [
    { value: 'alles', label: 'Alles' },
    { value: 'vegetarisch', label: 'Vegetarisch' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'glutenfrei', label: 'Glutenfrei' },
  ];
  
  const timeOptions: { value: TimeFrame; label: string }[] = [
    { value: 'schnell', label: 'Schnell (unter 20 Min.)' },
    { value: 'mittel', label: 'Mittel (ca. 30-45 Min.)' },
    { value: 'egal', label: 'Zeitaufwand egal' },
  ];

  // +++ NEU: Optionen für Personen +++
  const personOptions: { value: PersonCount; label: string }[] = [
    { value: '1', label: '1 Person' },
    { value: '2', label: '2 Personen' },
    { value: '3-4', label: '3-4 Personen' },
  ];


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
                <Link href="/tools/social-post" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">Social Media Creator</Link>
                <Link href="/tools/marketing-plan" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">Marketing Planer</Link>
                <Link href="/tools/email-assistant" className="text-sm font-medium text-neutral-600 hover:bg-neutral-200/60 px-3 py-1.5 rounded-md">E-Mail Assistent</Link>
                <Link href="/tools/rezept-bauer" className="text-sm font-medium bg-neutral-200 text-neutral-900 px-3 py-1.5 rounded-md">Rezept-Bauer</Link>
             </nav>
          </div>
        </aside>

        {/* Formular-Bereich */}
        <section className="h-full flex flex-col overflow-auto bg-white">
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
                Rezept-Bauer
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 mb-8">
                Was ist im Kühlschrank? Gib deine Zutaten ein und erhalte einen Rezeptvorschlag.
              </p>

              {/* +++ NEUES FORMULAR +++ */}
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* +++ NEU: Tag-Eingabe +++ */}
                <TagInput
                  label="Hauptzutaten (Was muss weg?)"
                  placeholder="Zutat eingeben und Enter drücken..."
                  tags={formData.mainIngredients}
                  onChange={handleMainIngredientsChange}
                />
                
                {/* +++ NEU: Checkbox-Liste +++ */}
                <PantryChecklist
                  label="Vorhandene Standard-Zutaten"
                  selectedItems={formData.pantryItems}
                  onChange={handlePantryItemsChange}
                />
                
                {/* +++ NEU: 3er-Grid für Optionen +++ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor="diet" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Ernährungsform
                    </label>
                    <select
                      id="diet"
                      name="diet"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      value={formData.diet}
                      onChange={handleSelectChange}
                    >
                      {dietOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="timeframe" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Zeitaufwand
                    </label>
                    <select
                      id="timeframe"
                      name="timeframe"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      value={formData.timeframe}
                      onChange={handleSelectChange}
                    >
                      {timeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {/* +++ NEU: Personen-Dropdown +++ */}
                  <div>
                    <label htmlFor="personCount" className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
                      Für wie viele Personen?
                    </label>
                    <select
                      id="personCount"
                      name="personCount"
                      className="block w-full rounded-md border-0 py-2 px-3 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      value={formData.personCount}
                      onChange={handleSelectChange}
                    >
                      {personOptions.map(opt => (
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
                    disabled={isLoading || formData.mainIngredients.length === 0}
                    className={cls(
                      'flex w-full sm:w-auto justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity',
                      (isLoading || formData.mainIngredients.length === 0)
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
                    {isLoading ? 'Suche Rezept...' : 'Rezept generieren'}
                  </button>
                </div>
              </form>

              {/* --- Ergebnis-Bereich --- */}
              {recipe && !isLoading && (
                <div className="mt-12 border-t border-neutral-200 pt-10">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-1">
                    {recipe.title}
                  </h2>
                  <p className="text-neutral-600 mb-2">
                    {recipe.description}
                  </p>
                  <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-medium mb-8">
                    Zubereitungszeit: {recipe.prepTime}
                  </span>
                  
                  {/* +++ NEU: Feinschliff & Einkaufsliste +++ */}
                  <div className="rounded-xl bg-white border border-neutral-200 shadow-sm mb-6 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-neutral-700 mr-2 shrink-0">Aktionen:</span>
                      
                      {/* Einkaufsliste-Button */}
                      <button
                        onClick={handleShoppingList}
                        disabled={!!isRefining || isShoppingListLoading}
                        className="flex items-center justify-center rounded-md bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                         {isShoppingListLoading ? (
                           <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         ) : null}
                        {isShoppingListLoading ? 'Prüfe...' : 'Was fehlt mir?'}
                      </button>
                      
                      {/* Feinschliff-Buttons */}
                      <button onClick={() => handleRefine('neue-idee')} disabled={!!isRefining || isShoppingListLoading} className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isRefining === 'neue-idee' ? (
                           <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        {isRefining === 'neue-idee' ? 'Suche...' : 'Neue Idee'}
                      </button>
                      <button onClick={() => handleRefine('einfacher')} disabled={!!isRefining || isShoppingListLoading} className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isRefining === 'einfacher' ? (
                           <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        {isRefining === 'einfacher' ? 'Vereinfache...' : 'Einfacher'}
                      </button>
                      <button onClick={() => handleRefine('gesuender')} disabled={!!isRefining || isShoppingListLoading} className="flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isRefining === 'gesuender' ? (
                           <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        {isRefining === 'gesuender' ? 'Anpassen...' : 'Gesünder'}
                      </button>
                    </div>

                    {/* API-Fehler (für Aktionen) */}
                    {apiError && (
                      <div className="mt-3 text-xs text-red-900 bg-red-500/10 border border-red-400/30 rounded-md p-2">
                        <strong>Fehler:</strong> {apiError}
                      </div>
                    )}
                    
                    {/* Einkaufsliste-Ergebnis */}
                    {shoppingList && !isShoppingListLoading && (
                      <div className="mt-4 border-t border-neutral-200 pt-4">
                        <h4 className="font-semibold text-neutral-900 mb-2">Einkaufsliste (Was fehlt):</h4>
                        <RecipeResultCard content={shoppingList} contentRaw={shoppingList} />
                      </div>
                    )}
                  </div>
                  
                  {/* Rezept-Karten */}
                  <RecipeResultCard 
                    title="Zutaten"
                    content={recipe.ingredients}
                    contentRaw={recipe.ingredients}
                  />
                  <RecipeResultCard 
                    title="Anleitung"
                    content={recipe.instructions}
                    contentRaw={recipe.instructions}
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

// +++ NEUE SUB-KOMPONENTE: TagInput +++
interface TagInputProps {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}
function TagInput({ label, placeholder, tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/,$/, ''); // Komma am Ende entfernen
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div>
      <label className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-md border-0 p-2 shadow-sm ring-1 ring-inset ring-neutral-300 focus-within:ring-2 focus-within:ring-indigo-600">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 text-indigo-700 px-2 py-1 text-sm font-medium">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-indigo-500 hover:text-indigo-800"
              aria-label={`Entferne ${tag}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border-0 p-1 text-neutral-900 placeholder:text-neutral-400 focus:ring-0 sm:text-sm"
          placeholder={tags.length === 0 ? placeholder : 'Weitere...'}
        />
      </div>
    </div>
  );
}

// +++ NEUE SUB-KOMPONENTE: PantryChecklist +++
const PANTRY_ITEMS = [
  'Öl', 'Salz', 'Pfeffer', 'Zwiebeln', 'Knoblauch', 'Butter',
  'Mehl', 'Zucker', 'Eier', 'Milch', 'Senf', 'Ketchup',
  'Soja-Sauce', 'Essig', 'Reis', 'Nudeln',
];

interface PantryChecklistProps {
  label: string;
  selectedItems: string[];
  onChange: (items: string[]) => void;
}
function PantryChecklist({ label, selectedItems, onChange }: PantryChecklistProps) {
  const handleToggle = (item: string) => {
    if (selectedItems.includes(item)) {
      onChange(selectedItems.filter(i => i !== item));
    } else {
      onChange([...selectedItems, item]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium leading-6 text-neutral-900 mb-2">
        {label}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 rounded-md border border-neutral-200 p-4">
        {PANTRY_ITEMS.map(item => (
          <label key={item} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-600"
              checked={selectedItems.includes(item)}
              onChange={() => handleToggle(item)}
            />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}


// +++ ANGEPASSTE SUB-KOMPONENTE: RecipeResultCard (kann jetzt ohne Titel) +++
function RecipeResultCard({ title, content, contentRaw }: { title?: string; content: string, contentRaw: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(contentRaw); // Kopiert den reinen Markdown-Text
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Markdown-Komponenten
  const components = {
    // HINWEIS: Verwendet kein Syntax-Highlighting, daher wurden die Imports entfernt.
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return <code {...rest} className={cls(className, 'rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.85em] break-words font-normal')} >{children}</code>;
      }
      return <pre className="my-3 rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto max-w-full">{String(children).replace(/\n$/, '')}</pre>;
    },
    a: (props: any) => <a {...props} className="underline break-words text-indigo-600" />,
    p: (props: any) => <p {...props} className="mb-2" />,
    ul: (props: any) => <ul {...props} className="list-disc pl-5 my-2" />,
    ol: (props: any) => <ol {...props} className="list-decimal pl-5 my-2" />,
    li: (props: any) => <li {...props} className="my-1.5" />,
  };

  return (
    <div className="rounded-xl bg-white border border-neutral-200 shadow-sm mb-6 relative">
      {/* Titel nur anzeigen, wenn er übergeben wird (für Einkaufsliste/Rezept) */}
      {title && (
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
      )}
      <div className={cls("p-4 sm:p-5", title ? "" : "pt-5")}>
        {/* Einkaufsliste hat keinen Titel, braucht aber Copy-Button */}
        {!title && (
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            disabled={copied}
          >
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        )}
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