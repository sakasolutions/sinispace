// app/chat/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Role = 'user' | 'assistant' | 'system';
type Model = 'gpt-4o-mini' | 'gemini-1.5-pro';

type Chat = {
  id: string;
  title: string;
  model: Model;
  createdAt: string;
};

type Message = {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  model?: Model;
  createdAt: string;
};

type Usage = { inputTokens?: number; outputTokens?: number; costUsd?: number };

const nowIso = () => new Date().toISOString();
const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');
const byId = <T extends { id: string }>(arr: T[], id: string) => arr.find(x => x.id === id);
const uid = () => `temp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
const firstLine = (s: string) => s.split('\n').map(v => v.trim()).filter(Boolean)[0] ?? 'Neuer Chat';

/** ====== Projekt/Name aus Titel parsen: "Projekt / Name" ====== */
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

/** ===== API ===== */
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

/** ===== Page ===== */
export default function ChatPage() {
  // Layout: fixierte Sidebar → gesamte Seite nicht scrollen, nur Content
  // => h-[100dvh] + overflow-hidden auf Root
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
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

  /** Projekte aus Titeln sammeln */
  const projects = useMemo(() => {
    const set = new Set<string>();
    chats.forEach(c => { const { project } = splitTitle(c.title); if (project) set.add(project); });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [chats]);
  const [projectFilter, setProjectFilter] = useState<string | 'ALL'>('ALL');

  useEffect(() => {
    (async () => {
      try {
        const list = await apiListChats();
        setChats(list);
        if (list.length) {
          setActiveChatId(list[0].id);
          void loadMessages(list[0].id);
        }
      } catch (e: any) { setError(e.message ?? String(e)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const msgs = await apiGetMessages(chatId);
      setMessagesByChat((prev) => ({ ...prev, [chatId]: msgs }));
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, []);

  const handleNewChat = useCallback(async (model?: Model) => {
    setError(null);
    try {
      const created = await apiCreateChat(model ?? 'gpt-4o-mini');
      setChats((prev) => [created, ...prev]);
      setMessagesByChat((prev) => ({ ...prev, [created.id]: [] }));
      setDrafts((prev) => ({ ...prev, [created.id]: '' }));
      setActiveChatId(created.id);
      setSidebarOpen(false);
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, []);

  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId); setSidebarOpen(false);
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
        const next = chats.find(c => c.id !== chatId);
        setActiveChatId(next?.id ?? null);
      }
    } catch (e: any) { setError(e.message ?? String(e)); }
  }, [activeChatId, chats]);

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
    } catch (e: any) { if (e.name !== 'AbortError') setError(e.message ?? String(e)); }
    finally { setIsStreaming(false); abortRef.current = null; }
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

  /** Auto scroll */
  const listRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    const onScroll = () => { const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96; userScrolledUpRef.current = !nearBottom; };
    el.addEventListener('scroll', onScroll); return () => el.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const el = listRef.current; if (!el || userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [activeMessages, isStreaming]);

  /** ===== Render ===== */
  return (
    <div className="relative isolate h-[100dvh] overflow-hidden bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.15),transparent),linear-gradient(180deg,#0b1120_0%,#0b1120_50%,#0e1322_100%)] text-white">
      {/* Header */}
      <header className="h-12 sm:h-14 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/5 bg-white/0 border-b border-white/10">
        <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center gap-2">
          <button
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 hover:bg-white/10"
            aria-label="Menü"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded bg-white/90" />
            <span className="text-sm font-semibold tracking-wide truncate">SiniSpace</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/settings"
              className="hidden sm:inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
              title="Einstellungen"
            >
              ⚙️ Einstellungen
            </Link>

            <select
              className="max-w-[44vw] sm:max-w-none text-xs sm:text-sm rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 outline-none hover:bg-white/10 truncate"
              value={activeChat?.model ?? 'gpt-4o-mini'}
              onChange={(e) => patchChatModel(e.target.value as Model)}
              aria-label="KI-Modell wählen"
              disabled={!activeChat}
            >
              <option value="gpt-4o-mini">GPT-4o-mini</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>

            {isStreaming ? (
              <button onClick={handleStop} className="rounded-lg border border-white/15 bg-white/5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm hover:bg-white/10">
                Stop
              </button>
            ) : (
              <button
                onClick={handleRegenerateLast}
                className="rounded-lg border border-white/15 bg-white/5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm hover:bg-white/10 disabled:opacity-40"
                disabled={!activeChat || (messagesByChat[activeChat?.id ?? ''] ?? []).length === 0}
                title="Letzte Antwort neu generieren"
              >
                Neu
              </button>
            )}

            <button
              onClick={() => handleNewChat()}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-white text-black px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              + Neuer Chat
            </button>
          </div>
        </div>
      </header>

      {/* Body: fixierte Spaltenhöhe, nur mittlere Spalte scrollt */}
      <div className="mx-auto max-w-7xl h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-3.5rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Sidebar Desktop (steht fest) */}
        <aside className="hidden lg:flex h-full border-r border-white/10 flex-col overflow-hidden">
          {/* Sidebar Controls */}
          <div className="p-3 flex items-center gap-2 border-b border-white/10">
            <button
              onClick={() => handleNewChat()}
              className="px-2 py-1 rounded-md text-sm border border-white/15 bg-white/5 hover:bg-white/10"
              aria-label="Neuen Chat erstellen"
            >
              + Neu
            </button>

            <select
              className="ml-auto text-xs rounded-md border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value as any)}
              title="Nach Projekt filtern"
            >
              <option value="ALL">Alle Projekte</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Chat-Liste (eigener Scroll) */}
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

          {usage && (
            <div className="p-3 border-t border-white/10 text-[11px] text-white/70 shrink-0">
              {usage.inputTokens ? `In: ${usage.inputTokens} • ` : ''}
              {usage.outputTokens ? `Out: ${usage.outputTokens} • ` : ''}
              {usage.costUsd ? `Kosten: $${usage.costUsd.toFixed(4)}` : ''}
            </div>
          )}
        </aside>

        {/* Sidebar Drawer Mobile */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-30">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-hidden />
            <aside className="absolute left-0 top-0 h-full w-[88vw] max-w-[340px] bg-[#0b1120] border-r border-white/10 flex flex-col">
              <div className="p-3 flex items-center justify-between border-b border-white/10">
                <h2 className="text-xs uppercase tracking-wider text-white/70">Deine Chats</h2>
                <button onClick={() => setSidebarOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/15 hover:bg-white/10" aria-label="Schließen">✕</button>
              </div>
              <div className="p-3 flex items-center gap-2">
                <button onClick={() => { setSidebarOpen(false); handleNewChat(); }} className="w-full rounded-lg bg-white text-black px-3 py-2 text-sm font-medium hover:opacity-90">+ Neuer Chat</button>
              </div>
              <div className="px-3 pb-2">
                <select
                  className="w-full text-xs rounded-md border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
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

        {/* Main (eigener Scroll) */}
        <section className="h-full flex flex-col overflow-hidden">
          <div className="px-3 sm:px-6 pt-3 shrink-0">
            <div className="text-[11px] sm:text-xs text-white/80 bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-2">
              KI kann Fehler machen. Inhalte prüfen – besonders bei rechtlichen/medizinischen/finanziellen Themen.
            </div>
            {error && <div className="mt-2 text-sm text-red-200 bg-red-500/10 border border-red-400/30 rounded-lg p-2">{error}</div>}
          </div>

          <div ref={listRef} className="flex-1 overflow-auto px-3 sm:px-6 py-4 overscroll-contain scroll-smooth">
            <div className="mx-auto w-full md:max-w-3xl space-y-3 sm:space-y-4">
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

          {/* Composer */}
          <div className="sticky bottom-0 z-10 px-3 sm:px-6 pb-3 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
            <div className="mx-auto w-full md:max-w-3xl rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-2 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]">
              <div className="flex items-end gap-2">
                <button
                  onClick={handlePickFile}
                  className="h-10 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm disabled:opacity-50"
                  title={uploading ? 'Lade hoch…' : 'Datei anhängen'}
                  aria-label="Datei anhängen"
                  disabled={!activeChat || uploading || isStreaming}
                >
                  {uploading ? '⏳' : '📎'}
                </button>
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt" className="hidden" onChange={handleFileChange} />

                <textarea
                  className="flex-1 min-h-10 max-h-40 h-10 resize-y rounded-xl border border-white/15 bg-transparent p-2 text-sm placeholder:text-white/40 focus:outline-none break-words"
                  placeholder={activeChat ? 'Nachricht an die KI …' : 'Erst einen Chat erstellen'}
                  value={draft}
                  onChange={(e) => setActiveDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  disabled={!activeChat || isStreaming}
                  aria-label="Nachricht schreiben"
                />
                <button
                  onClick={handleSend}
                  disabled={!activeChat || !draft.trim() || isStreaming}
                  className={cls('h-10 px-4 rounded-xl text-sm font-medium bg-white text-black', (!!activeChat && !!draft.trim() && !isStreaming) ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed')}
                >
                  {isStreaming ? 'Senden…' : 'Senden'}
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 justify-between text-[11px] text-white/60 px-1">
                <div>Enter = senden • Shift+Enter = Zeilenumbruch</div>
                {usage && (
                  <div className="hidden sm:block rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                    {usage.inputTokens ? `In: ${usage.inputTokens} • ` : ''}
                    {usage.outputTokens ? `Out: ${usage.outputTokens} • ` : ''}
                    {usage.costUsd ? `Kosten: $${usage.costUsd.toFixed(4)}` : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** ===== Sidebar Chat List (mit Projekten, Umbenennen) ===== */
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
    // sort names
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
          <div className="px-2 py-2 text-[11px] uppercase tracking-wider text-white/50 flex items-center justify-between">
            <span>{group === '—' ? 'Ohne Projekt' : group}</span>
          </div>
          <ul className="space-y-1">
            {items.map((c) => {
              const isActive = activeChatId === c.id;
              return (
                <li key={c.id} className={cls('rounded-lg border border-transparent hover:border-white/10')}>
                  <div className={cls('flex items-center gap-1 px-2 py-1.5 rounded-lg', isActive && 'bg-white/10')}>
                    {editingId === c.id ? (
                      <input
                        ref={inputRef}
                        defaultValue={c._name}
                        className="flex-1 bg-transparent outline-none text-sm px-2 py-1 rounded-md border border-white/20"
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
                        className="flex-1 text-left"
                        onClick={() => onSelect(c.id)}
                        title={c._name}
                      >
                        <div className="text-sm font-medium truncate">{c._name}</div>
                        <div className="text-[11px] text-white/60">{c.model}</div>
                      </button>
                    )}

                    {/* Aktionen */}
                    <button
                      onClick={() => setEditingId(prev => prev === c.id ? null : c.id)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/15 hover:bg-white/10"
                      title="Umbenennen"
                      aria-label="Umbenennen"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onMoveProject(c.id, prompt('In welches Projekt verschieben? (leer = ohne Projekt)')?.trim() || null)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/15 hover:bg-white/10"
                      title="Projekt ändern"
                      aria-label="Projekt ändern"
                    >
                      🗂️
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-white/15 hover:bg-white/10"
                      title="Löschen"
                      aria-label="Löschen"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {grouped.length === 0 && (
        <div className="px-3 py-2 text-sm text-white/60">Keine Chats</div>
      )}
    </div>
  );
}

/** ===== Message Bubble (Markdown ohne Überlaufen) ===== */
function MessageBubble({
  message, onCopy, onEdit, isStreaming, grouped,
}: {
  message: Message; onCopy: () => void; onEdit?: () => void; isStreaming?: boolean; grouped?: boolean;
}) {
  const isUser = message.role === 'user';

  const components = {
    pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
      <pre {...props} className={cls(
        'my-3 rounded-lg border border-white/15 bg-black/30 p-3 text-xs leading-relaxed',
        'whitespace-pre-wrap break-words overflow-auto max-w-full'
      )} />
    ),
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return <code {...rest} className={cls(className, 'rounded-md border border-white/15 bg-black/30 px-1.5 py-[2px] text-[0.85em] break-words')}>{children}</code>;
      }
      return <code {...rest} className={cls(className, 'block whitespace-pre-wrap break-words')}>{children}</code>;
    },
    table: (props: any) => (<div className="max-w-full overflow-auto"><table {...props} className="w-full text-left border-collapse" /></div>),
    a: (props: any) => <a {...props} className="underline break-words" />,
    p: (props: any) => <p {...props} className="break-words" />,
    li: (props: any) => <li {...props} className="break-words" />,
  };

  return (
    <div className={cls('w-full', isUser ? 'flex justify-end' : 'flex justify-start')}>
      <div className={cls('max-w-[92%] sm:max-w-[80%] md:max-w-[70%] group')}>
        {!grouped && (
          <div className={cls('mb-1 px-1 flex items-center gap-2', isUser ? 'justify-end' : 'justify-start')}>
            <div className="text-[11px] font-medium text-white/70">{isUser ? 'Du' : 'Assistant'}</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              {onEdit && <button onClick={onEdit} className="text-[11px] underline text-white/70 hover:text-white">Bearbeiten</button>}
              <button onClick={onCopy} className="text-[11px] underline text-white/70 hover:text-white">Kopieren</button>
            </div>
          </div>
        )}
        <div className={cls('rounded-2xl px-4 py-3 border break-words', isUser ? 'bg-blue-500/15 border-blue-400/30' : 'bg-white/5 border-white/15')}>
          <div className="text-sm leading-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {message.content || (isStreaming ? '▍' : '')}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
