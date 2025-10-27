// app/chat/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { signOut } from 'next-auth/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ... (Alle Typen und API-Funktionen bleiben 1:1 gleich) ...
type Role = 'user' | 'assistant' | 'system';
type Model = 'gpt-4o' | 'gpt-4o-mini' | 'gemini-2.5-pro';
type Chat = { id: string; title: string; model: Model; createdAt: string; };
type Message = { id: string; chatId: string; role: Role; content: string; model?: Model; createdAt: string; };
type Usage = { inputTokens?: number; outputTokens?: number; costUsd?: number };
const nowIso = () => new Date().toISOString();
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');
const byId = <T extends { id: string }>(arr: T[], id: string) => arr.find(x => x.id === id);
const uid = () => `temp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
const firstLine = (s: string) => s.split('\n').map(v => v.trim()).filter(Boolean)[0] ?? 'Neuer Chat';
function splitTitle(title: string): { project: string | null; name: string } {
  const parts = (title || '').split('/').map(s => s.trim());
  if (parts.length >= 2) {
    return { project: parts[0] || null, name: parts.slice(1).join(' / ') || 'Unbenannt' };
  }
  return { project: null, name: title || 'Neuer Chat' };
}
function joinTitle(project: string | null, name: string) {
  const cleanName = name.trim() || 'Neuer Chat';
  return project ? `${project.trim()} / ${cleanName}` : cleanName;
}
async function apiCreateChat(model: Model): Promise<Chat> {
  const r = await fetch('/api/chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
  if (!r.ok) throw new Error(`Chat anlegen fehlgeschlagen (${r.status})`);
  return r.json();
}
async function apiListChats(): Promise<Chat[]> {
  const r = await fetch('/api/chats', { cache: 'no-store' });
  if (!r.ok) throw new Error(`Chats laden fehlgeschlagen (${r.status})`);
  return r.json();
}
async function apiGetMessages(chatId: string): Promise<Message[]> {
  const r = await fetch(`/api/chats/${chatId}/messages`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Nachrichten laden fehlgeschlagen (${r.status})`);
  return r.json();
}
async function apiPatchChat(chatId: string, patch: Partial<Pick<Chat, 'title' | 'model'>>): Promise<Chat> {
  const r = await fetch(`/api/chats/${chatId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`Chat aktualisieren fehlgeschlagen (${r.status})`);
  return r.json();
}
async function apiDeleteChat(chatId: string): Promise<void> {
  const r = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`Chat löschen fehlgeschlagen (${r.status})`);
}
async function streamAssistant({
  chatId, model, messages, signal, onDelta, onUsage,
}: {
  chatId: string; model?: Model; messages: Message[];
  signal: AbortSignal; onDelta: (chunk: string) => void; onUsage?: (u: Usage) => void;
}) {
  const r = await fetch(`/api/chats/${chatId}/messages/stream`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: messages.map(m => ({ role: m.role, content: m.content, id: m.id })) }),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`Streaming fehlgeschlagen (${r.status})`);
  const reader = r.body.getReader(); const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const trimmed = line.trim(); if (!trimmed) continue;
      if (trimmed.startsWith('data:')) {
        try {
          const payload = JSON.parse(trimmed.slice(5));
          if (payload.type === 'delta') onDelta(payload.text ?? '');
          if (payload.type === 'usage' && onUsage) onUsage(payload.usage ?? {});
        } catch { onDelta(trimmed.replace(/^data:/, '')); }
      } else onDelta(trimmed);
    }
  }
}
async function uploadFile(file: File) {
  const fd = new FormData(); fd.append('file', file);
  const r = await fetch('/api/uploads', { method: 'POST', body: fd });
  if (!r.ok) {
    let msg = `Upload failed (${r.status})`; try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<{ url: string; name: string; size: number; mime: string }>;
}

// ===== Page Component =====
export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null); // <-- Startet jetzt als null
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeChat = useMemo(() => (activeChatId ? byId(chats, activeChatId) ?? null : null), [activeChatId, chats]);
  const activeMessages = useMemo(() => (activeChatId ? (messagesByChat[activeChatId] ?? []) : []), [messagesByChat, activeChatId]);
  const draft = drafts[activeChatId ?? ''] ?? '';
  const projects = useMemo(() => {
    const set = new Set<string>();
    chats.forEach(c => { const { project } = splitTitle(c.title); if (project) set.add(project); });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [chats]);
  const [projectFilter, setProjectFilter] = useState<string | 'ALL'>('ALL');

  // ===== MODIFIZIERTER HOOK =====
  // Lädt Chats, aber wählt nicht mehr automatisch den ersten aus.
  useEffect(() => {
    (async () => {
      try {
        const list = await apiListChats();
        setChats(list);
        // App startet jetzt mit activeChatId = null, um den Hub anzuzeigen
      } catch (e: any) { setError(e.message ?? String(e)); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const msgs = await apiGetMessages(chatId);
      setMessagesByChat((prev) => ({ ...prev, [chatId]: msgs }));
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, []);

  const handleNewChat = useCallback(async (model?: Model) => {
    setError(null);
    try {
      const created = await apiCreateChat(model ?? 'gpt-4o');
      setChats((prev) => [created, ...prev]);
      setMessagesByChat((prev) => ({ ...prev, [created.id]: [] }));
      setDrafts((prev) => ({ ...prev, [created.id]: '' }));
      setActiveChatId(created.id); // <-- Dieser Aufruf wechselt die Ansicht zum Chat
      setSidebarOpen(false);
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, []);

  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId); // <-- Dieser Aufruf wechselt die Ansicht zum Chat
    setSidebarOpen(false);
    if (!messagesByChat[chatId]) await loadMessages(chatId);
  }, [messagesByChat, loadMessages]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    const chat = byId(chats, chatId);
    const name = chat ? splitTitle(chat.title).name : 'Chat';
    if (!confirm(`„${name}“ wirklich löschen?`)) return;
    try {
      await apiDeleteChat(chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
      setMessagesByChat(prev => { const cp = { ...prev }; delete cp[chatId]; return cp; });
      if (activeChatId === chatId) {
        // Kehrt zum Hub zurück, da kein Chat mehr aktiv ist
        setActiveChatId(null); 
      }
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, [activeChatId, chats]); // <- chats hinzugefügt, da es im "if (activeChatId === chatId)"-Block verwendet wird

  const setActiveDraft = useCallback((val: string) => {
    if (!activeChatId) return;
    setDrafts((prev) => ({ ...prev, [activeChatId]: val }));
  }, [activeChatId]);

  const patchChatModel = useCallback(async (model: Model) => {
    if (!activeChat) return;
    try {
      const updated = await apiPatchChat(activeChat.id, { model });
      setChats((prev) => prev.map(c => (c.id === updated.id ? updated : c)));
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, [activeChat]);

  const patchChatTitle = useCallback(async (title: string) => {
    if (!activeChat) return;
    try {
      const updated = await apiPatchChat(activeChat.id, { title });
      setChats((prev) => prev.map(c => (c.id === updated.id ? updated : c)));
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, [activeChat]);

  const renameChatInline = useCallback(async (chatId: string, newName: string) => {
    const c = byId(chats, chatId); if (!c) return;
    const { project } = splitTitle(c.title);
    await apiPatchChat(chatId, { title: joinTitle(project, newName) });
    setChats(prev => prev.map(x => x.id === chatId ? { ...x, title: joinTitle(project, newName) } : x));
  }, [chats]);

  const moveChatToProject = useCallback(async (chatId: string, project: string | null) => {
    const c = byId(chats, chatId); if (!c) return;
    const { name } = splitTitle(c.title);
    await apiPatchChat(chatId, { title: joinTitle(project, name) });
    setChats(prev => prev.map(x => x.id === chatId ? { ...x, title: joinTitle(project, name) } : x));
  }, [chats]);

  const appendMessage = useCallback((chatId: string, msg: Message) => {
    setMessagesByChat((prev) => ({ ...prev, [chatId]: [...(prev[chatId] ?? []), msg] }));
  }, []);

  const patchLastAssistant = useCallback((chatId: string, updater: (prev: Message) => Message) => {
    setMessagesByChat((prev) => {
      const list = [...(prev[chatId] ?? [])];
      for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'assistant') { list[i] = updater(list[i]); break; }
      return { ...prev, [chatId]: list };
    });
  }, []);

  const startStreaming = useCallback(async (opts: { chatId: string; context: Message[] }) => {
    const { chatId, context } = opts;
    setIsStreaming(true); setUsage(null); setError(null);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      await streamAssistant({
        chatId, model: activeChat?.model, messages: context, signal: ac.signal,
        onDelta: (chunk) => patchLastAssistant(chatId, (prev) => ({ ...prev, content: prev.content + chunk })),
        onUsage: (u) => setUsage(u),
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message ?? String(e));
    } finally { setIsStreaming(false); abortRef.current = null; }
  }, [patchLastAssistant, activeChat?.model]);

  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  const handleSend = useCallback(async () => {
    if (!activeChat || !activeChatId) return;
    const text = (draft ?? '').trim(); if (!text) return;
    if (!activeChat.title || splitTitle(activeChat.title).name.toLowerCase().startsWith('neuer chat')) {
      const { project } = splitTitle(activeChat.title);
      void patchChatTitle(joinTitle(project, firstLine(text).slice(0, 60)));
    }
    const userMsg: Message = { id: uid(), chatId: activeChatId, role: 'user', content: text, createdAt: nowIso() };
    appendMessage(activeChatId, userMsg);
    const assistantMsg: Message = { id: uid(), chatId: activeChatId, role: 'assistant', content: '', createdAt: nowIso(), model: activeChat.model };
    appendMessage(activeChatId, assistantMsg);
    setActiveDraft('');
    const context = (messagesByChat[activeChatId] ?? []).concat([userMsg]);
    await startStreaming({ chatId: activeChatId, context });
  }, [activeChat, activeChatId, draft, appendMessage, messagesByChat, startStreaming, patchChatTitle, setActiveDraft]);

  const handleRegenerateLast = useCallback(async () => {
    if (!activeChat || !activeChatId) return;
    const msgs = messagesByChat[activeChatId] ?? [];
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user'); if (!lastUser) return;
    const placeholder: Message = { id: uid(), chatId: activeChatId, role: 'assistant', content: '', createdAt: nowIso(), model: activeChat.model };
    appendMessage(activeChatId, placeholder);
    await startStreaming({ chatId: activeChatId, context: msgs.slice(0, msgs.lastIndexOf(lastUser) + 1) });
  }, [activeChat, activeChatId, messagesByChat, appendMessage, startStreaming]);

  const handleEditAndResend = useCallback(async (messageId: string) => {
    if (!activeChatId || !activeChat) return;
    const msgs = messagesByChat[activeChatId] ?? [];
    const idx = msgs.findIndex((m) => m.id === messageId && m.role === 'user'); if (idx < 0) return;
    const edited = prompt('Nachricht bearbeiten & erneut senden:', msgs[idx].content); if (edited == null) return;
    const newUser: Message = { ...msgs[idx], content: edited, createdAt: nowIso(), id: uid() };
    setMessagesByChat((prev) => { const list = [...(prev[activeChatId] ?? [])]; list.splice(idx, 1, newUser); return { ...prev, [activeChatId]: list }; });
    appendMessage(activeChatId, { id: uid(), chatId: activeChatId, role: 'assistant', content: '', createdAt: nowIso(), model: activeChat.model });
    await startStreaming({ chatId: activeChatId, context: msgs.slice(0, idx + 1).concat([newUser]) });
  }, [activeChatId, activeChat, messagesByChat, appendMessage, startStreaming]);

  const copyText = useCallback(async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} }, []);
  const handlePickFile = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    setUploading(true);
    try {
      let md = draft || '';
      for (const f of Array.from(files)) {
        const res = await uploadFile(f);
        const isImage = res.mime.startsWith('image/');
        const token = isImage ? `![${res.name}](${res.url})` : `[${res.name}](${res.url})`;
        md = (md ? md + '\n' : '') + token;
      }
      setActiveDraft(md);
    } catch (err: any) { setError(err.message ?? 'Upload fehlgeschlagen'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }, [draft, setActiveDraft]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    const onScroll = () => { const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96; userScrolledUpRef.current = !nearBottom; };
    el.addEventListener('scroll', onScroll); return () => el.removeEventListener('scroll', onScroll);
  }, [activeChat]); // <-- Abhängigkeit auf activeChat geändert, damit es neu bindet, wenn die Chat-UI eingeblendet wird

  useEffect(() => {
    const el = listRef.current; if (!el || userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [activeMessages, isStreaming]);

  // ===== Render =====
  return (
    <div className="relative isolate h-[100dvh] overflow-hidden bg-neutral-50 text-neutral-900">
      <header className="h-12 sm:h-14 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/80 bg-white/80 border-b border-neutral-200 shadow-sm">
        <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center gap-2">
          <button
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 hover:bg-neutral-100"
            aria-label="Menü"
            onClick={() => setSidebarOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded bg-neutral-900" />
            <span className="text-sm font-semibold tracking-wide truncate">SiniSpace</span>
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
            
            {/* Header-Buttons werden nur angezeigt, wenn ein Chat aktiv ist */}
            {activeChat && (
              <>
                <select
                  className="max-w-[44vw] sm:max-w-none text-xs sm:text-sm rounded-lg border border-neutral-300 bg-white px-2 py-1.5 outline-none hover:bg-neutral-100 truncate"
                  value={activeChat.model}
                  onChange={(e) => patchChatModel(e.target.value as Model)}
                  aria-label="KI-Modell wählen"
                >
                  <option value="gpt-4o">GPT-4o (Stark)</option>
                  <option value="gpt-4o-mini">GPT-4o-mini (Schnell)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Aktuell)</option>
                </select>
                {isStreaming ? (
                  <button onClick={handleStop} className="rounded-lg border border-neutral-300 bg-white px-2 sm:px-3 py-1.5 text-xs sm:text-sm hover:bg-neutral-100">
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleRegenerateLast}
                    className="rounded-lg border border-neutral-300 bg-white px-2 sm:px-3 py-1.5 text-xs sm:text-sm hover:bg-neutral-100 disabled:opacity-40"
                    disabled={(messagesByChat[activeChat.id] ?? []).length === 0}
                    title="Letzte Antwort neu generieren"
                  >
                    Neu
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => handleNewChat()}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              + Neuer Chat
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-3.5rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:flex h-full border-r border-neutral-200 flex-col overflow-hidden bg-neutral-100">
          <div className="p-3 flex items-center gap-2 border-b border-neutral-200">
            <button
              onClick={() => handleNewChat()}
              className="px-2 py-1 rounded-md text-sm border border-neutral-300 bg-white hover:bg-neutral-200"
              aria-label="Neuen Chat erstellen"
            >
              + Neu
            </button>
            <select
              className="ml-auto text-xs rounded-md border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-200"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value as any)}
              title="Nach Projekt filtern"
            >
              <option value="ALL">Alle Projekte</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-auto">
            <SidebarChatList
              chats={chats}
              activeChatId={activeChatId}
              onSelect={handleSelectChat}
              onDelete={handleDeleteChat}
              onRename={renameChatInline}
              onMoveProject={moveChatToProject}
              projectFilter={projectFilter}
            />
          </div>
          {usage && activeChat && ( // <-- Nur anzeigen, wenn ein Chat aktiv ist
            <div className="p-3 border-t border-neutral-200 text-[11px] text-neutral-600 shrink-0">
              {usage.inputTokens ? `In: ${usage.inputTokens} • ` : ''}
              {usage.outputTokens ? `Out: ${usage.outputTokens} • ` : ''}
              {usage.costUsd ? `Kosten: $${usage.costUsd.toFixed(4)}` : ''}
            </div>
          )}
        </aside>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-30">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-hidden />
            <aside className="absolute left-0 top-0 h-full w-[88vw] max-w-[340px] bg-neutral-100 border-r border-neutral-200 flex flex-col">
              <div className="p-3 flex items-center justify-between border-b border-neutral-200">
                <h2 className="text-xs uppercase tracking-wider text-neutral-600">Deine Chats</h2>
                <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-neutral-300 hover:bg-neutral-200" aria-label="Schließen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-3 flex items-center gap-2">
                <button onClick={() => { setSidebarOpen(false); handleNewChat(); }} className="w-full rounded-lg bg-neutral-900 text-white px-3 py-2 text-sm font-medium hover:opacity-90">+ Neuer Chat</button>
              </div>
              <div className="px-3 pb-2">
                <select
                  className="w-full text-xs rounded-md border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-100"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value as any)}
                >
                  <option value="ALL">Alle Projekte</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex-1 overflow-auto">
                <SidebarChatList
                  chats={chats}
                  activeChatId={activeChatId}
                  onSelect={(id) => { setSidebarOpen(false); handleSelectChat(id); }}
                  onDelete={handleDeleteChat}
                  onRename={renameChatInline}
                  onMoveProject={moveChatToProject}
                  projectFilter={projectFilter}
                />
              </div>
            </aside>
          </div>
        )}

        {/* ===== MODIFIZIERTER HAUPTBEREICH ===== */}
        <section className="h-full flex flex-col overflow-hidden bg-white">
          {!activeChat ? (
            // ----- 1. TOOL HUB (Wird angezeigt, wenn kein Chat aktiv ist) -----
            <div className="flex-1 overflow-auto scroll-smooth">
              <ToolHub onStartFreeChat={handleNewChat} />
            </div>

          ) : (

            // ----- 2. CHAT INTERFACE (Wird angezeigt, wenn ein Chat aktiv ist) -----
            <>
              <div className="px-3 sm:px-6 pt-3 shrink-0">
                <div className="text-xs text-yellow-900 bg-yellow-400/20 border border-yellow-400/30 rounded-lg p-2">
                  KI kann Fehler machen. Inhalte prüfen – besonders bei rechtlichen/medizinischen/finanziellen Themen.
                </div>
                {error && <div className="mt-2 text-sm text-red-900 bg-red-500/10 border border-red-400/30 rounded-lg p-2">{error}</div>}
              </div>

              <div ref={listRef} className="flex-1 overflow-auto px-3 sm:px-6 py-4 overscroll-contain scroll-smooth">
                <div className="mx-auto w-full md:max-w-3xl space-y-4 sm:space-y-5">
                  {activeMessages.length === 0 && (
                    <div className="text-center text-sm text-neutral-500 pt-8">
                      Beginne dein Gespräch.
                    </div>
                  )}
                  {activeMessages.map((m, i) => {
                    const prev = activeMessages[i - 1]; const grouped = !!(prev && prev.role === m.role);
                    return (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        onCopy={() => copyText(m.content)}
                        onEdit={m.role === 'user' ? () => handleEditAndResend(m.id) : undefined}
                        isStreaming={isStreaming && m.role === 'assistant' && m === activeMessages[activeMessages.length - 1]}
                        grouped={grouped}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="sticky bottom-0 z-10 px-3 sm:px-6 pb-3 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                <div className="mx-auto w-full md:max-w-3xl rounded-2xl border border-neutral-300 bg-white p-2 shadow-xl shadow-neutral-400/20">
                  <div className="flex items-end gap-2">
                    <button
                      onClick={handlePickFile}
                      className="h-10 w-10 flex items-center justify-center rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-sm disabled:opacity-50"
                      title={uploading ? 'Lade hoch…' : 'Datei anhängen'}
                      aria-label="Datei anhängen"
                      disabled={uploading || isStreaming}
                    >
                      {/* ... (Upload-Icon unverändert) ... */}
                      {uploading ? (
                        <svg className="animate-spin h-5 w-5 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94a3 3 0 1 1 4.243 4.242l-9.88 9.88a1.5 1.5 0 0 1-2.12-2.12l6.364-6.364m-6.364 0 .636-.636m-6.364 0 .636.636" />
                        </svg>
                      )}
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt" className="hidden" onChange={handleFileChange} />
                    <textarea
                      className="flex-1 min-h-10 max-h-40 h-10 resize-y rounded-xl border border-neutral-300 bg-white p-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-50 break-words"
                      placeholder={'Nachricht an die KI …'}
                      value={draft}
                      onChange={(e) => setActiveDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                      disabled={isStreaming}
                      aria-label="Nachricht schreiben"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!draft.trim() || isStreaming}
                      className={cls('h-10 px-4 rounded-xl text-sm font-medium bg-neutral-900 text-white', (!!draft.trim() && !isStreaming) ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed')}
                    >
                      {isStreaming ? 'Senden…' : 'Senden'}
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 justify-between text-[10px] text-neutral-500 px-1">
                    <div>Enter = senden • Shift+Enter = Zeilenumbruch</div>
                    {usage && (
                      <div className="hidden sm:block rounded-full border border-neutral-300 bg-white px-2 py-0.5">
                        {usage.inputTokens ? `In: ${usage.inputTokens} • ` : ''}
                        {usage.outputTokens ? `Out: ${usage.outputTokens} • ` : ''}
                        {usage.costUsd ? `Kosten: $${usage.costUsd.toFixed(4)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ===== NEUE SUB-KOMPONENTE: ToolHub =====
// (Definition der Werkzeuge)
const TOOLS_CONFIG = [
  {
    key: 'social-post',
    title: 'Social Media Post Creator',
    description: 'Erstellt Posts für verschiedene Plattformen.',
    href: '/tools/social-post',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688 0-1.25-.563-1.25-1.25 0-.688.562-1.25 1.25-1.25s1.25.563 1.25 1.25c0 .688-.562 1.25-1.25 1.25m0 0H7.5m3.188 0q.538 0 1.024.11m-1.024-.11a2.5 2.5 0 1 0-4.132 1.87m4.132-1.87q.488.11 1.024.11m-1.024-.11c.688 0 1.25.563 1.25 1.25 0 .688-.562 1.25-1.25 1.25m0 0h3.188m-3.188 0q-.538 0-1.024-.11a2.5 2.5 0 1 1 4.132-1.87m-4.132 1.87q-.488-.11-1.024-.11" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-5.23-4.27-9.5-9.5-9.5S.5 6.77.5 12s4.27 9.5 9.5 9.5 9.5-4.27 9.5-9.5m-1.625 0a7.875 7.875 0 1 1-15.75 0 7.875 7.875 0 0 1 15.75 0" />
      </svg>
    ),
  },
  {
    key: 'marketing-plan',
    title: 'Marketing Planer',
    description: 'Entwirft eine grundlegende Marketingstrategie.',
    href: '/tools/marketing-plan',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6m0 0A7.5 7.5 0 1 0 3 13.5h7.5V6m0 0A7.5 7.5 0 1 0 18 13.5h-7.5V6m0 0v1.5m0 0v3m0 0v3m0 0v3m0 0v1.5m0 0H9m1.5 0H12m0 0h1.5m0 0h1.5m0 0H15m0 0h1.5m0 0H18m0 0h1.5m0 0h1.5m0 0H21" />
      </svg>
    ),
  },
  {
    key: 'email-assistant',
    title: 'E-Mail Assistent',
    description: 'Hilft beim Verfassen professioneller E-Mails.',
    href: '/tools/email-assistant',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    key: 'rezept-bauer',
    title: 'Rezept-Bauer',
    description: 'Kreiert Rezepte basierend auf Zutaten.',
    href: '/tools/rezept-bauer',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
];

// (Die ToolHub-Komponente)
function ToolHub({ onStartFreeChat }: { onStartFreeChat: (model: Model) => Promise<void> }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFreeChatClick = async () => {
    setIsLoading(true);
    try {
      await onStartFreeChat('gpt-4o'); // Standardmodell für neuen Chat
    } catch (e) {
      console.error(e);
      setIsLoading(false); // Nur im Fehlerfall Loading-Status zurücksetzen
    }
    // Bei Erfolg wechselt die übergeordnete Komponente die Ansicht
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-8">Womit möchtest du starten?</h1>
      
      {/* Freier Chat Karte */}
      <div className="mb-10">
        <button
          onClick={handleFreeChatClick}
          disabled={isLoading}
          className="w-full md:w-2/3 lg:w-1/2 p-5 border border-neutral-300 rounded-xl bg-white hover:bg-neutral-50 shadow-sm hover:shadow-md transition-all flex items-center gap-5 text-left disabled:opacity-60"
        >
          <div className="h-12 w-12 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0v-4.5m0 4.5v.375m0-.375c-1.563 0-2.625.62-2.625 1.5V15m0-3.375c1.563 0 2.625.62 2.625 1.5V15m0-3.375h.375m-3.375 0h.375m-3.375 0h.375m0 0v-4.5m0 4.5v.375m0-.375c-1.563 0-2.625.62-2.625 1.5V15m0-3.375c1.563 0 2.625.62 2.625 1.5V15m0-3.375h.375m-3.375 0h.375m-3.375 0h.375M16.125 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0m0 0v-4.5m0 4.5v.375m0-.375c-1.563 0-2.625.62-2.625 1.5V15m0-3.375c1.563 0 2.625.62 2.625 1.5V15m0-3.375h.375m-3.375 0h.375m-3.375 0h.375m0 0v-4.5m0 4.5v.375m0-.375c-1.563 0-2.625.62-2.625 1.5V15m0-3.375c1.563 0 2.625.62 2.625 1.5V15m0-3.375h.375m-3.375 0h.375m-3.375 0h.375" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 12 10.125A2.625 2.625 0 0 0 12 4.875m0 0H12m0 0v.375m0-.375v-.375m0 .375v.375m0-.375h.375m-.375 0h-.375M12 4.875v.375m0-.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h.375m-.375 0h-.375m0 0v.375m0-.375v-.375m0 .375v.375m0-3v.375m0-.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0 0h.375m-.375 0h-.375m0 0v.375m0-.375v-.375m0 .375v.375" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-neutral-900">Freier Chat</h2>
            <p className="text-sm text-neutral-600">Starte ein offenes Gespräch mit der KI zu einem beliebigen Thema.</p>
          </div>
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-neutral-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-neutral-500 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Werkzeug-Grid */}
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-5">Spezialisierte Werkzeuge</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS_CONFIG.map(tool => (
            <Link 
              key={tool.key} 
              href={tool.href} 
              className="block p-5 border border-neutral-200 rounded-xl bg-white shadow-sm hover:bg-neutral-50 hover:shadow-lg transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:bg-indigo-200 transition-colors">
                {tool.icon}
              </div>
              <h3 className="font-semibold text-neutral-900 mb-1">{tool.title}</h3>
              <p className="text-sm text-neutral-600">{tool.description}</p>
            </Link>
          ))}
          {/* Hier kannst du einfach weitere Tools zur TOOLS_CONFIG-Liste hinzufügen */}
          <div className="p-5 border border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center text-center bg-neutral-50/70">
             <div className="h-10 w-10 rounded-lg bg-neutral-200 text-neutral-500 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
              </svg>
             </div>
             <h3 className="font-semibold text-neutral-700 mb-1 text-sm">Neues Werkzeug</h3>
             <p className="text-xs text-neutral-500">Weitere Tools folgen in Kürze...</p>
          </div>
        </div>
      </div>
    </div>
  );
}


// ===== Sub-Komponenten (SidebarChatList & MessageBubble bleiben unverändert) =====
function SidebarChatList({
  chats, activeChatId, onSelect, onDelete, onRename, onMoveProject, projectFilter,
}: {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onMoveProject: (id: string, project: string | null) => void;
  projectFilter: string | 'ALL';
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Array<Chat & { _name: string }>>();
    for (const c of chats) {
      const { project, name } = splitTitle(c.title);
      const key = project ?? '—';
      if (projectFilter !== 'ALL' && key !== projectFilter) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ ...c, _name: name });
    }
    for (const arr of map.values()) arr.sort((a,b)=>a._name.localeCompare(b._name));
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }, [chats, projectFilter]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editingId && inputRef.current) inputRef.current.focus(); }, [editingId]);

  return (
    <div className="px-2 pb-4 space-y-4">
      {grouped.map(([group, items]) => (
        <div key={group}>
          <div className="px-2 py-2 text-[11px] uppercase tracking-wider text-neutral-500 flex items-center justify-between">
            <span>{group === '—' ? 'Ohne Projekt' : group}</span>
          </div>
          <ul className="space-y-1">
            {items.map((c) => {
              const isActive = activeChatId === c.id;
              return (
                <li key={c.id}>
                  <div className={cls('flex items-center gap-1 px-2 py-1.5 rounded-lg', isActive ? 'bg-neutral-200' : 'hover:bg-neutral-200/60')}>
                    {editingId === c.id ? (
                      <input
                        ref={inputRef}
                        defaultValue={c._name}
                        className="flex-1 bg-white outline-none text-sm px-2 py-1 rounded-md border border-neutral-300 ring-1 ring-indigo-500"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            setEditingId(null);
                            await onRename(c.id, val);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        onBlur={async (e) => { const val = e.target.value; setEditingId(null); await onRename(c.id, val); }}
                      />
                    ) : (
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => onSelect(c.id)}
                        title={c._name}
                      >
                        <div className="text-sm font-medium truncate">{c._name}</div>
                        <div className="text-[11px] text-neutral-500">{c.model}</div>
                      </button>
                    )}
                    <button
                      onClick={() => setEditingId(prev => prev === c.id ? null : c.id)}
                      className={cls("h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md border border-transparent text-neutral-500 hover:text-neutral-900", isActive ? "hover:bg-neutral-300" : "hover:bg-neutral-200")}
                      title="Umbenennen"
                      aria-label="Umbenennen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onMoveProject(c.id, prompt('In welches Projekt verschieben? (leer = ohne Projekt)')?.trim() || null)}
                      className={cls("h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md border border-transparent text-neutral-500 hover:text-neutral-900", isActive ? "hover:bg-neutral-300" : "hover:bg-neutral-200")}
                      title="Projekt ändern"
                      aria-label="Projekt ändern"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.188l.003.174a2.25 2.25 0 0 0 1.883 2.188c.112.017.227.026.344.026h15.812c.117 0 .232-.009.344.026a2.25 2.25 0 0 0 1.883-2.188l-.003-.174a2.25 2.25 0 0 0-1.883-2.188m-16.5 0c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m0 0C21.66 9.713 22.5 8.288 22.5 6.75c0-1.538-.84-2.963-2.094-3.69M3.75 9.776c.112-.017.227-.026.344-.026M3.75 9.776c-.112.017-.227.026-.344-.026C2.34 9.713 1.5 8.288 1.5 6.75c0-1.538.84-2.963 2.094-3.69m0 0C2.34 3.037 3.75 3 5.25 3h13.5c1.5 0 2.91.037 3.906.31" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className={cls("h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md border border-transparent text-neutral-500 hover:text-neutral-900", isActive ? "hover:bg-neutral-300" : "hover:bg-neutral-200")}
                      title="Löschen"
                      aria-label="Löschen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.5 0c-.342.052-.682.107-1.022.166m11.48 0A48.1 48.1 0 0 0 8.026 5.39m7.408 0a48.1 48.1 0 0 1-3.478-.397m-4.437 0c-.342.052-.682.107-1.022.166" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {grouped.length === 0 && (
        <div className="px-3 py-2 text-sm text-neutral-500">
          Noch keine Chats. Starte einen <button onClick={() => onSelect('NEW')} className="underline">neuen Chat</button> oder wähle ein Werkzeug.
        </div>
      )}
    </div>
  );
}

// ===== Sub-Komponente: MessageBubble (unverändert) =====
function MessageBubble({
  message, onCopy, onEdit, isStreaming, grouped,
}: {
  message: Message; onCopy: () => void; onEdit?: () => void; isStreaming?: boolean; grouped?: boolean;
}) {
  const isUser = message.role === 'user';

  const components = {
    pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
      <pre {...props} className={cls(isUser ? 'my-3 rounded-lg border border-indigo-400/50 bg-black/20 p-0' : 'my-3 rounded-lg border border-neutral-200 bg-neutral-100 p-0', 'whitespace-pre-wrap break-words overflow-auto max-w-full')} />
    ),
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return <code {...rest} className={cls(className, isUser ? 'rounded border border-indigo-300/50 bg-black/20 px-1 py-0.5 text-[0.85em] break-words font-normal' : 'rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.85em] break-words font-normal')} >{children}</code>;
      }
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : '';
      return <SyntaxHighlighter {...rest} style={oneLight} language={lang} PreTag="div" className="my-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto max-w-full">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>;
    },
    a: (props: any) => <a {...props} className="underline break-words" />,
    table: (props: any) => (<div className="max-w-full overflow-auto my-3 border border-neutral-300 rounded-lg"><table {...props} className="w-full text-left border-collapse" /></div>),
    thead: (props: any) => <thead {...props} className="bg-neutral-100" />,
    th: (props: any) => <th {...props} className="p-2 border-b border-neutral-300" />,
    td: (props: any) => <td {...props} className="p-2 border-b border-neutral-300" />,
  };

  return (
    <div className={cls('w-full flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cls('group', 'max-w-[90%]')}>
        {!grouped && (
          <div className={cls('mb-1.5 px-1 flex items-center gap-2', isUser ? 'justify-end' : 'justify-start')}>
            <div className="text-[11px] font-medium text-neutral-700">{isUser ? 'Du' : 'Assistant'}</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              {onEdit && <button onClick={onEdit} className="text-[11px] underline text-neutral-600 hover:text-neutral-900">Bearbeiten</button>}
              <button onClick={onCopy} className="text-[11px] underline text-neutral-600 hover:text-neutral-900">Kopieren</button>
            </div>
          </div>
        )}
        {isUser ? (
          <div className={cls('rounded-2xl px-3.5 py-2.5 break-words', 'bg-indigo-600 text-white')}>
            <div className="prose prose-sm sm:prose-base prose-invert max-w-none prose-code:font-normal">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {message.content || (isStreaming ? '▍' : '')}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className={cls('rounded-2xl px-3.5 py-2.5 break-words', 'bg-neutral-100 border border-neutral-200')}>
            <div
              className={cls(
                'prose prose-sm sm:prose-base prose-neutral text-neutral-800 prose-a:text-indigo-600 prose-strong:text-neutral-900',
                'prose-headings:font-semibold prose-headings:text-neutral-900 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
                'prose-p:leading-relaxed',
                'prose-blockquote:border-l prose-blockquote:border-neutral-300 prose-blockquote:pl-4 prose-blockquote:text-neutral-600',
                'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
                'prose-img:rounded-lg',
                'prose-code:font-normal',
                'prose-pre:bg-transparent prose-pre:p-0'
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {message.content || (isStreaming ? '▍' : '')}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}