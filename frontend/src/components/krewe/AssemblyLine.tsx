import React, { useCallback, useRef, useState } from 'react';
import {
  Play, Square, Loader2, Plus, Upload, Trash2, ChevronUp,
  ChevronDown, BarChart3, Zap, AlertTriangle, CheckCircle2,
  Clock, Target, Star,
} from 'lucide-react';
import { UNIFORMS } from './DollNode';
import {
  PERSONA_LIBRARY, SQUAD_TEMPLATE_LABELS, CATEGORY_LABELS,
  VOICE_PROFILE_LABELS, QUALITY_STANDARDS,
} from './persona_library';
import type {
  PersonaBrief, AssemblyEntry, AssemblyStats, AssemblyEvent,
  PersonaCategory, VoiceProfile, SquadTemplate,
} from './types';
import { API } from '../../api';

interface AssemblyLineProps {
  onEntryProduced: (entry: AssemblyEntry) => void;
  onStatsUpdate: (stats: AssemblyStats) => void;
}

const GRADE_COLORS = { A: '#00ff88', B: '#d4af37', C: '#ff6644' };
const GRADE_LABELS = { A: '🏆 CERTIFIED A', B: '✓ APPROVED B', C: '△ REVIEW C' };

// Default blank brief for the form
const BLANK: Omit<PersonaBrief, 'id'> = {
  name: '', use_case: '', category: 'news', persona_tags: [],
  appearance: 'executive', voice_profile: 'authoritative',
  squad_template: 'news_anchor', goal_prompt: '', priority: 5,
};

const AssemblyLine: React.FC<AssemblyLineProps> = ({ onEntryProduced, onStatsUpdate }) => {
  const [queue, setQueue] = useState<PersonaBrief[]>([]);
  const [running, setRunning] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stats, setStats] = useState<AssemblyStats>({
    queued: 0, running: 0, done: 0, failed: 0,
    success_rate: 0, avg_latency_ms: 0, throughput_per_hour: 0, certified_count: 0,
  });
  const [log, setLog] = useState<Array<{ name: string; grade?: string; ok: boolean; ms?: number }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [form, setForm] = useState<Omit<PersonaBrief, 'id'>>(BLANK);
  const [tagInput, setTagInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const latencies = useRef<number[]>([]);

  // ── Queue management ──────────────────────────────────────────────────────
  const enqueue = useCallback((briefs: Omit<PersonaBrief, 'id'>[]) => {
    const withIds = briefs.map((b) => ({ ...b, id: `brief_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }));
    setQueue((q) => {
      const merged = [...q, ...withIds].sort((a, b) => b.priority - a.priority);
      return merged;
    });
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => q.filter((b) => b.id !== id));
  }, []);

  const loadStarterLibrary = useCallback(() => {
    enqueue(PERSONA_LIBRARY);
  }, [enqueue]);

  const addFromForm = useCallback(() => {
    if (!form.name.trim() || !form.goal_prompt.trim()) return;
    enqueue([form]);
    setForm(BLANK);
    setTagInput('');
    setShowForm(false);
  }, [form, enqueue]);

  const importBulk = useCallback(() => {
    try {
      const parsed = JSON.parse(importJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      enqueue(items);
      setImportJson('');
      setShowImport(false);
    } catch {
      alert('Invalid JSON — paste an array of persona brief objects.');
    }
  }, [importJson, enqueue]);

  // ── Assembly runner (SSE stream) ──────────────────────────────────────────
  const startAssembly = useCallback(async () => {
    if (running || queue.length === 0) return;
    setRunning(true);
    setLog([]);
    latencies.current = [];
    startTimeRef.current = Date.now();
    abortRef.current = new AbortController();

    const updStats = (patch: Partial<AssemblyStats>) => {
      setStats((s) => {
        const next = { ...s, ...patch };
        onStatsUpdate(next);
        return next;
      });
    };

    updStats({ queued: queue.length, running: 1, done: 0, failed: 0 });

    try {
      const res = await fetch(`${API}/krewe/assembly/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefs: queue }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const ev: AssemblyEvent = JSON.parse(line.slice(5).trim());
            if (ev.status === 'starting') {
              setCurrentName(ev.name);
              setCurrentIdx(ev.index);
              updStats({ running: 1 });
            } else if (ev.status === 'done') {
              const ms = ev.entry.total_latency_ms;
              latencies.current.push(ms);
              const avg = Math.round(latencies.current.reduce((a, b) => a + b, 0) / latencies.current.length);
              const elapsed = (Date.now() - startTimeRef.current) / 1000 / 3600;
              setLog((l) => [...l, { name: ev.entry.name, grade: ev.entry.quality_grade, ok: true, ms }]);
              onEntryProduced(ev.entry);
              updStats((s) => ({
                done: s.done + 1,
                running: ev.index < ev.total - 1 ? 1 : 0,
                success_rate: Math.round(((s.done + 1) / (s.done + 1 + s.failed)) * 100),
                avg_latency_ms: avg,
                throughput_per_hour: elapsed > 0 ? Math.round((s.done + 1) / elapsed) : 0,
                certified_count: s.certified_count + (ev.entry.certified ? 1 : 0),
              }) as any);
            } else if (ev.status === 'failed') {
              setLog((l) => [...l, { name: ev.name, ok: false }]);
              updStats((s) => ({
                failed: s.failed + 1,
                success_rate: Math.round((s.done / (s.done + s.failed + 1)) * 100),
              }) as any);
            } else if (ev.status === 'complete') {
              setCurrentName('');
              setRunning(false);
              setQueue([]);
              updStats({ running: 0, queued: 0 });
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setLog((l) => [...l, { name: '(connection error)', ok: false }]);
      }
    }

    setRunning(false);
    setCurrentName('');
  }, [running, queue, onEntryProduced, onStatsUpdate]);

  const stopAssembly = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentName('');
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const gradeColor = (g?: string) => GRADE_COLORS[g as keyof typeof GRADE_COLORS] ?? '#888';

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">

      {/* ── STATS BAR ── */}
      <div className="shrink-0 grid grid-cols-2 gap-1 p-2 border-b border-midnight-800 bg-midnight-900/60">
        {[
          ['Queue', queue.length, '#d4af37'],
          ['Done', stats.done, '#00ff88'],
          ['Failed', stats.failed, '#ff2244'],
          ['Certified 🏆', stats.certified_count, '#00ff88'],
          ['Success', `${stats.success_rate}%`, '#d4af37'],
          ['Avg ms', stats.avg_latency_ms, '#888'],
        ].map(([label, val, color]) => (
          <div key={label as string} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-midnight-800/60">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider leading-none">{label}</span>
            <span className="text-[11px] font-bold leading-none ml-auto" style={{ color: color as string }}>
              {val}
            </span>
          </div>
        ))}
      </div>

      {/* ── CURRENT RUNNING ── */}
      {running && currentName && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-oldgold-500/10 border-b border-oldgold-500/30">
          <Loader2 className="w-3 h-3 text-oldgold-400 animate-spin shrink-0" />
          <span className="text-[10px] text-oldgold-300 truncate">
            #{currentIdx + 1} — {currentName}
          </span>
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="shrink-0 flex flex-col gap-1.5 p-2 border-b border-midnight-800">
        <button
          onClick={loadStarterLibrary}
          disabled={running}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-midnight-800 border border-midnight-700 hover:border-oldgold-500/50 text-[10px] font-bold text-slate-300 hover:text-oldgold-400 transition-all disabled:opacity-40"
        >
          <Star className="w-3 h-3" /> LOAD STARTER LIBRARY (30 PERSONAS)
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={() => { setShowForm((s) => !s); setShowImport(false); }}
            disabled={running}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-midnight-800 border border-midnight-700 hover:border-oldgold-500/50 text-[10px] font-bold text-slate-400 hover:text-oldgold-400 transition-all disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> ADD PERSONA
          </button>
          <button
            onClick={() => { setShowImport((s) => !s); setShowForm(false); }}
            disabled={running}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-midnight-800 border border-midnight-700 hover:border-oldgold-500/50 text-[10px] font-bold text-slate-400 hover:text-oldgold-400 transition-all disabled:opacity-40"
          >
            <Upload className="w-3 h-3" /> BULK IMPORT
          </button>
        </div>
      </div>

      {/* ── ADD PERSONA FORM ── */}
      {showForm && (
        <div className="shrink-0 p-2.5 border-b border-midnight-800 bg-midnight-900/50 space-y-2">
          {[
            ['name', 'Name (e.g. Sarah Chen — News Anchor)', 'text'],
            ['use_case', 'Use Case', 'text'],
            ['goal_prompt', 'Goal Prompt (squad goal)', 'textarea'],
          ].map(([k, ph, t]) => (
            <div key={k}>
              <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">{ph}</label>
              {t === 'textarea' ? (
                <textarea
                  rows={3}
                  value={(form as any)[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  placeholder={ph as string}
                  className="w-full resize-none bg-midnight-950 border border-midnight-700 rounded px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-700 focus:border-oldgold-500 outline-none"
                />
              ) : (
                <input
                  value={(form as any)[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  placeholder={ph as string}
                  className="w-full bg-midnight-950 border border-midnight-700 rounded px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-700 focus:border-oldgold-500 outline-none"
                />
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['category', Object.keys(CATEGORY_LABELS)],
              ['appearance', Object.keys(UNIFORMS)],
              ['voice_profile', ['authoritative', 'warm', 'crisp', 'energetic', 'calm', 'deep']],
              ['squad_template', Object.keys(SQUAD_TEMPLATE_LABELS)],
            ].map(([k, opts]) => (
              <div key={k}>
                <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">{k.replace('_', ' ')}</label>
                <select
                  value={(form as any)[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="w-full bg-midnight-950 border border-midnight-700 rounded px-2 py-1.5 text-[10px] text-slate-200 focus:border-oldgold-500 outline-none"
                >
                  {(opts as string[]).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* Tags */}
          <div>
            <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">Tags</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {form.persona_tags.map((t) => (
                <span key={t} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-midnight-700 text-[9px] text-slate-300">
                  {t}
                  <button onClick={() => setForm((f) => ({ ...f, persona_tags: f.persona_tags.filter((x) => x !== t) }))}
                    className="text-slate-600 hover:text-red-400">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    setForm((f) => ({ ...f, persona_tags: [...f.persona_tags, tagInput.trim()] }));
                    setTagInput('');
                  }
                }}
                placeholder="add tag…"
                className="flex-1 bg-midnight-950 border border-midnight-700 rounded px-2 py-1 text-[10px] text-slate-200 focus:border-oldgold-500 outline-none"
              />
              <div className="flex items-center gap-1">
                <label className="text-[8px] text-slate-500">Priority</label>
                <input
                  type="number" min={0} max={10} value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 5 }))}
                  className="w-10 bg-midnight-950 border border-midnight-700 rounded px-1 py-1 text-[10px] text-slate-200 text-center focus:border-oldgold-500 outline-none"
                />
              </div>
            </div>
          </div>
          <button onClick={addFromForm}
            disabled={!form.name.trim() || !form.goal_prompt.trim()}
            className="w-full py-2 rounded-lg bg-oldgold-500 text-midnight-950 font-bold text-[10px] hover:bg-oldgold-400 disabled:opacity-40 transition-colors">
            + ADD TO QUEUE
          </button>
        </div>
      )}

      {/* ── BULK IMPORT ── */}
      {showImport && (
        <div className="shrink-0 p-2.5 border-b border-midnight-800 bg-midnight-900/50">
          <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">
            Paste JSON array of PersonaBrief objects
          </label>
          <textarea
            rows={5}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"name":"...", "goal_prompt":"...", "category":"news", ...}]'
            className="w-full resize-none bg-midnight-950 border border-midnight-700 rounded px-2 py-1.5 text-[10px] text-slate-300 font-mono placeholder:text-slate-700 focus:border-oldgold-500 outline-none"
          />
          <button onClick={importBulk}
            className="mt-1.5 w-full py-1.5 rounded-lg bg-midnight-700 text-slate-200 text-[10px] font-bold hover:bg-midnight-600 transition-colors">
            IMPORT
          </button>
        </div>
      )}

      {/* ── QUEUE LIST ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {queue.length === 0 && log.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 text-slate-600">
            <Target className="w-7 h-7 mx-auto mb-2 opacity-40" />
            <p className="text-[10px]">Queue empty</p>
            <p className="text-[9px] mt-1">Load the starter library or add personas manually</p>
          </div>
        )}

        {/* Pending queue */}
        {queue.length > 0 && (
          <div className="p-2 space-y-1">
            <div className="text-[8px] text-slate-600 uppercase tracking-wider px-1 mb-1">
              {queue.length} pending · sorted by priority
            </div>
            {queue.map((b, i) => {
              const u = UNIFORMS[b.appearance] ?? UNIFORMS.gala;
              return (
                <div key={b.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-midnight-800/50 border border-midnight-700/50 group">
                  <span className="text-sm shrink-0">{u.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-200 truncate">{b.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] text-slate-600">{CATEGORY_LABELS[b.category]?.split(' ')[0]}</span>
                      <span className="text-[8px] text-oldgold-600">P{b.priority}</span>
                      <span className="text-[8px] text-slate-700">{b.squad_template}</span>
                    </div>
                  </div>
                  <button onClick={() => removeFromQueue(b.id)}
                    disabled={running}
                    className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all disabled:hidden">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Run log */}
        {log.length > 0 && (
          <div className="p-2 pt-1 border-t border-midnight-800 space-y-0.5">
            <div className="text-[8px] text-slate-600 uppercase tracking-wider px-1 mb-1">Run Log</div>
            {log.slice(-20).map((l, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px]">
                {l.ok
                  ? <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: gradeColor(l.grade) }} />
                  : <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                <span className={`flex-1 truncate ${l.ok ? 'text-slate-400' : 'text-red-400'}`}>{l.name}</span>
                {l.grade && (
                  <span className="text-[7.5px] font-bold" style={{ color: gradeColor(l.grade) }}>
                    {l.grade}
                  </span>
                )}
                {l.ms && <span className="text-[7.5px] text-slate-600">{l.ms}ms</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RUN CONTROLS ── */}
      <div className="shrink-0 p-2 border-t border-midnight-800 flex gap-1.5">
        {!running ? (
          <button
            onClick={startAssembly}
            disabled={queue.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[11px] bg-gradient-to-r from-oldgold-500 to-amber-500 text-midnight-950 hover:brightness-110 disabled:opacity-40 transition-all shadow-[0_0_16px_rgba(212,175,55,0.3)]"
          >
            <Play className="w-3.5 h-3.5" />
            START ASSEMBLY ({queue.length})
          </button>
        ) : (
          <button
            onClick={stopAssembly}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[11px] bg-red-600/80 text-white hover:bg-red-500 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            STOP ASSEMBLY
          </button>
        )}
      </div>

      {/* Quality standards reference */}
      <details className="shrink-0 border-t border-midnight-800">
        <summary className="px-3 py-1.5 text-[8px] font-bold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-400 flex items-center gap-1">
          <BarChart3 className="w-3 h-3" /> Quality Standards (10)
        </summary>
        <div className="px-3 pb-2 space-y-0.5">
          {QUALITY_STANDARDS.map((s) => (
            <div key={s.key} className="flex items-start gap-1.5 text-[9px] text-slate-500">
              <span className="text-oldgold-600 shrink-0">✦</span>
              <span>{s.label}</span>
            </div>
          ))}
          <div className="mt-1.5 text-[8px] text-slate-600 border-t border-midnight-800 pt-1.5">
            A (85-100) = 🏆 Certified · B (65-84) = ✓ Approved · C (&lt;65) = △ Review
          </div>
        </div>
      </details>
    </div>
  );
};

export default AssemblyLine;
