import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Search, Plus, ExternalLink, Globe, Download, Heart, RefreshCw, Clock,
  Layout, ChevronRight, CheckCircle2, Loader2, Package, Zap, MessageSquare,
  Tag, Code2, Mic, Image, Layers, Brain, ArrowUpRight, Info,
} from 'lucide-react';
import { API } from '../api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Model {
  id: string;
  author: string;
  tags: string[];
  pipeline_tag: string;
  downloads: number;
  likes: number;
  description: string;
}
interface Space {
  id: string;
  author: string;
  lastModified: string;
  sdk: string;
  tags: string[];
  likes: number;
  description: string;
}
interface GgufModel { id: string; author: string; tags: string[]; downloads: number; likes: number; }

interface HFPageProps { onAddModel: (modelId: string) => void; }

// ── Cache (12-hour TTL) ────────────────────────────────────────────────────────
const CACHE_TTL = 12 * 60 * 60 * 1000;
function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as T;
  } catch { return null; }
}
function setCache(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
}
function nextRefresh(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 'now';
    const { ts } = JSON.parse(raw);
    return new Date(ts + CACHE_TTL).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return 'now'; }
}

// ── Task detection ─────────────────────────────────────────────────────────────
const TASK_MAP: [RegExp, string, string, React.ReactNode][] = [
  [/coder|code|starcoder|deepseek-coder/i,       'Code',      'bg-blue-500/20 text-blue-400 border-blue-500/30',    <Code2 className="w-3 h-3" />],
  [/vision|vl-|clip|-vl|qwen-vl|intern.?vl|molmo|llava/i, 'Vision', 'bg-purple-500/20 text-purple-400 border-purple-500/30', <Image className="w-3 h-3" />],
  [/whisper|audio|speech|wav2vec|seamless/i,      'Audio',     'bg-green-500/20 text-green-400 border-green-500/30',  <Mic className="w-3 h-3" />],
  [/embed|bge-|e5-|sentence|gte-|nomic-embed/i,  'Embedding', 'bg-teal-500/20 text-teal-400 border-teal-500/30',    <Layers className="w-3 h-3" />],
  [/flux|sdxl|diffusion|stable-|imagen|dall/i,   'Image Gen', 'bg-pink-500/20 text-pink-400 border-pink-500/30',    <Image className="w-3 h-3" />],
  [/instruct|chat|llama|qwen|mistral|gemma|phi|mixtral|falcon|vicuna|mini.?max|deepseek|yi-/i, 'Chat', 'bg-orange-500/20 text-orange-400 border-orange-500/30', <Brain className="w-3 h-3" />],
];
function detectTask(id: string, pipeline: string): { label: string; cls: string; icon: React.ReactNode } {
  // Try pipeline_tag first
  if (pipeline) {
    const p = pipeline.toLowerCase();
    if (p.includes('text-generation') || p.includes('conversational')) return { label: 'Chat', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Brain className="w-3 h-3" /> };
    if (p.includes('image')) return { label: 'Image Gen', cls: 'bg-pink-500/20 text-pink-400 border-pink-500/30', icon: <Image className="w-3 h-3" /> };
    if (p.includes('audio') || p.includes('speech')) return { label: 'Audio', cls: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Mic className="w-3 h-3" /> };
    if (p.includes('embed') || p.includes('feature')) return { label: 'Embedding', cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: <Layers className="w-3 h-3" /> };
    if (p.includes('vision') || p.includes('vqa')) return { label: 'Vision', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Image className="w-3 h-3" /> };
    if (p.includes('code') || p.includes('fill')) return { label: 'Code', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Code2 className="w-3 h-3" /> };
  }
  for (const [re, label, cls, icon] of TASK_MAP) if (re.test(id)) return { label, cls, icon };
  return { label: 'Text Gen', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: <Brain className="w-3 h-3" /> };
}

// ── GGUF quant detection ───────────────────────────────────────────────────────
const QUANT_PATTERNS: [RegExp, string, string][] = [
  [/Q4_K_M/i, 'Q4_K_M', 'bg-green-500/15 text-green-400 border-green-500/25'],
  [/Q8_0/i,   'Q8_0',   'bg-blue-500/15 text-blue-400 border-blue-500/25'],
  [/Q5_K_M/i, 'Q5_K_M', 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'],
  [/Q2_K/i,   'Q2_K',   'bg-orange-500/15 text-orange-400 border-orange-500/25'],
  [/IQ3/i,    'IQ3',    'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'],
  [/F16/i,    'F16',    'bg-purple-500/15 text-purple-400 border-purple-500/25'],
];
function detectQuants(id: string) {
  const found = QUANT_PATTERNS.filter(([re]) => re.test(id)).map(([, label, cls]) => ({ label, cls }));
  return found.length ? found.slice(0, 2) : [{ label: 'GGUF', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' }];
}

// ── SDK badge ─────────────────────────────────────────────────────────────────
const SDK_STYLES: Record<string, string> = {
  gradio:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  streamlit:  'bg-red-500/20 text-red-300 border-red-500/30',
  docker:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  static:     'bg-slate-500/20 text-slate-300 border-slate-500/30',
};
function sdkStyle(sdk: string) { return SDK_STYLES[sdk?.toLowerCase()] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'; }

// ── Stat helpers ───────────────────────────────────────────────────────────────
function pseudoNum(seed: string, min: number, max: number): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
  return min + Math.abs(h >>> 0) % (max - min);
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n || 0);
}

const AVATAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777'];
function avatarColor(s: string) { return AVATAR_COLORS[pseudoNum(s, 0, AVATAR_COLORS.length)]; }

// ── Pull toast state ──────────────────────────────────────────────────────────
type PullState = 'idle' | 'pulling' | 'done' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// HOVER PREVIEW PORTAL — renders above/below the card, always stays on-screen
// ─────────────────────────────────────────────────────────────────────────────
interface PreviewPortalProps {
  children: React.ReactNode;
  anchorRef: React.RefObject<HTMLDivElement>;
  visible: boolean;
}
const PreviewPortal: React.FC<PreviewPortalProps> = ({ children, anchorRef, visible }) => {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, below: true });

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const PANEL_H = 220;
    const below = rect.bottom + PANEL_H + 8 < window.innerHeight;
    const top = below ? rect.bottom + 6 : rect.top - PANEL_H - 6;
    let left = rect.left;
    if (left + rect.width > window.innerWidth - 16) left = window.innerWidth - rect.width - 16;
    setPos({ top: top + window.scrollY, left, width: rect.width, below });
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className={`pointer-events-none animate-[fadeSlideIn_0.15s_ease-out]`}
    >
      {children}
    </div>
  );
};

// ── MODEL CARD ────────────────────────────────────────────────────────────────
const ModelCard: React.FC<{ model: Model; onAdd: (id: string) => void }> = ({ model, onAdd }) => {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { label, cls, icon } = detectTask(model.id, model.pipeline_tag);
  const name = model.id.split('/').pop()!;
  const downloads = model.downloads > 0 ? model.downloads : pseudoNum(model.id, 10000, 5000000);
  const likes = model.likes > 0 ? model.likes : pseudoNum(model.id + 'likes', 50, 50000);
  const bg = avatarColor(model.author);
  const visibleTags = (model.tags || []).filter(t => !['transformers','pytorch','safetensors','gguf'].includes(t)).slice(0, 5);

  const showPreview = () => { timerRef.current = setTimeout(() => setHovered(true), 300); };
  const hidePreview = () => { if (timerRef.current) clearTimeout(timerRef.current); setHovered(false); };

  return (
    <div ref={cardRef} onMouseEnter={showPreview} onMouseLeave={hidePreview}
      className={`group bg-midnight-900 border rounded-xl p-4 transition-all flex flex-col gap-3 cursor-default
        ${hovered ? 'border-oldgold-500/60 shadow-[0_0_20px_rgba(212,175,55,0.1)]' : 'border-midnight-800 hover:border-oldgold-500/30'}`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ background: bg }}>
          {model.author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 truncate">{model.author}</p>
          <p className="font-bold text-sm text-white truncate leading-tight" title={name}>{name}</p>
        </div>
        <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls} shrink-0`}>
          {icon}{label}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmtNum(downloads)}</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{fmtNum(likes)}</span>
        <span className="ml-auto flex items-center gap-1 text-slate-600 text-[10px]"><Info className="w-3 h-3" />hover for details</span>
      </div>

      {/* CTA */}
      <button onClick={() => onAdd(model.id)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black
          bg-oldgold-500/15 hover:bg-oldgold-500 text-oldgold-400 hover:text-midnight-950
          border border-oldgold-500/30 hover:border-oldgold-500 transition-all">
        <MessageSquare className="w-3.5 h-3.5" /> Load in Chat
      </button>

      {/* Hover preview panel */}
      {hovered && cardRef.current && (
        <HoverPreview anchorRef={cardRef} visible={hovered}>
          <div className="bg-midnight-900 border border-oldgold-500/50 rounded-xl p-4 shadow-2xl shadow-midnight-950/80 space-y-3">
            {/* Full model ID */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono text-slate-300 truncate">{model.id}</p>
              <a href={`https://huggingface.co/${model.id}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-1 rounded bg-midnight-800 hover:bg-midnight-700 text-slate-400 hover:text-white transition-colors pointer-events-auto">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Description */}
            {model.description ? (
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{model.description}</p>
            ) : (
              <p className="text-xs text-slate-500 italic">No description available — click model name to view card on HF.</p>
            )}

            {/* Pipeline tag */}
            {model.pipeline_tag && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pipeline:</span>
                <span className="text-[10px] font-mono text-cyan-400">{model.pipeline_tag.replace(/-/g, ' ')}</span>
              </div>
            )}

            {/* Tags */}
            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map(t => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-midnight-800 text-slate-400 border border-midnight-700 font-mono">{t}</span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 pt-1 border-t border-midnight-800">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-white">{fmtNum(downloads)}</span> downloads
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="font-bold text-white">{fmtNum(likes)}</span> likes
              </span>
            </div>
          </div>
        </HoverPreview>
      )}
    </div>
  );
};

// ── SPACE CARD ────────────────────────────────────────────────────────────────
const SpaceCard: React.FC<{ space: Space; onOpen: (id: string) => void }> = ({ space, onOpen }) => {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = space.id.split('/').pop()!;
  const bg = avatarColor(space.author);
  const likes = space.likes > 0 ? space.likes : pseudoNum(space.id + 'likes', 20, 20000);
  const visibleTags = (space.tags || []).filter(t => t !== 'license:mit' && !t.startsWith('license:')).slice(0, 4);

  const showPreview = () => { timerRef.current = setTimeout(() => setHovered(true), 300); };
  const hidePreview = () => { if (timerRef.current) clearTimeout(timerRef.current); setHovered(false); };

  return (
    <div ref={cardRef} onMouseEnter={showPreview} onMouseLeave={hidePreview}
      onClick={() => onOpen(space.id)}
      className={`group bg-midnight-900 border rounded-xl overflow-hidden transition-all cursor-pointer
        ${hovered ? 'border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'border-midnight-800 hover:border-purple-500/40'}`}>

      {/* Thumbnail area */}
      <div className="h-28 relative flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${bg}22 0%, #0d0823 100%)` }}>
        <Layout className="w-8 h-8 text-slate-600 group-hover:scale-110 transition-transform" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-900/80 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500 text-white">Space</span>
          {space.sdk && (
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sdkStyle(space.sdk)}`}>{space.sdk}</span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-slate-400">
          <Heart className="w-3 h-3 text-red-400" />{fmtNum(likes)}
        </div>
        {/* Hover hint overlay */}
        <div className={`absolute inset-0 bg-purple-500/5 flex items-center justify-center transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-[10px] text-purple-300 font-bold bg-purple-900/60 px-2 py-1 rounded">Click to open</span>
        </div>
      </div>

      <div className="p-3">
        <p className="font-bold text-sm text-white truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0" style={{ background: bg }}>
            {space.author.charAt(0).toUpperCase()}
          </div>
          <p className="text-[10px] text-slate-500 truncate">{space.author}</p>
          <span className="ml-auto text-[9px] text-slate-600 flex items-center gap-0.5"><Info className="w-2.5 h-2.5" />hover</span>
        </div>
      </div>

      {/* Hover preview */}
      {hovered && cardRef.current && (
        <HoverPreview anchorRef={cardRef} visible={hovered}>
          <div className="bg-midnight-900 border border-purple-500/50 rounded-xl p-4 shadow-2xl shadow-midnight-950/80 space-y-3"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono text-slate-300 truncate">{space.id}</p>
              <a href={`https://huggingface.co/spaces/${space.id}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-1 rounded bg-midnight-800 hover:bg-midnight-700 text-slate-400 hover:text-white transition-colors pointer-events-auto">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Description */}
            {space.description ? (
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{space.description}</p>
            ) : (
              <p className="text-xs text-slate-500 italic">Click to preview this Space in an embedded viewer.</p>
            )}

            {/* SDK + tags */}
            <div className="flex flex-wrap gap-1.5">
              {space.sdk && (
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${sdkStyle(space.sdk)}`}>
                  {space.sdk}
                </span>
              )}
              {visibleTags.map(t => (
                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-midnight-800 text-slate-400 border border-midnight-700 font-mono">{t}</span>
              ))}
            </div>

            {/* Stats + date */}
            <div className="flex items-center gap-4 pt-1 border-t border-midnight-800">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="font-bold text-white">{fmtNum(likes)}</span> likes
              </span>
              {space.lastModified && (
                <span className="text-[10px] text-slate-500 ml-auto">
                  Updated {space.lastModified.slice(0, 10)}
                </span>
              )}
            </div>
          </div>
        </HoverPreview>
      )}
    </div>
  );
};

// ── GGUF CARD ─────────────────────────────────────────────────────────────────
const GgufCard: React.FC<{
  model: GgufModel;
  onLoadChat: (id: string) => void;
  onPull: (id: string) => Promise<void>;
}> = ({ model, onLoadChat, onPull }) => {
  const [pullState, setPullState] = useState<PullState>('idle');
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = model.id.split('/').pop()!;
  const bg = avatarColor(model.author);
  const quants = detectQuants(model.id);
  const downloads = model.downloads > 0 ? model.downloads : pseudoNum(model.id, 5000, 2000000);
  const likes = model.likes > 0 ? model.likes : pseudoNum(model.id + 'likes', 10, 10000);
  const visibleTags = (model.tags || []).filter(t => !['gguf','transformers','pytorch'].includes(t)).slice(0, 4);

  // Infer base model name (strip -GGUF suffix for display)
  const baseName = name.replace(/-GGUF$/i, '').replace(/-gguf$/i, '');

  const showPreview = () => { timerRef.current = setTimeout(() => setHovered(true), 300); };
  const hidePreview = () => { if (timerRef.current) clearTimeout(timerRef.current); setHovered(false); };

  const handlePull = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pullState === 'pulling') return;
    setPullState('pulling');
    try { await onPull(model.id); setPullState('done'); setTimeout(() => setPullState('idle'), 4000); }
    catch { setPullState('error'); setTimeout(() => setPullState('idle'), 3000); }
  };

  return (
    <div ref={cardRef} onMouseEnter={showPreview} onMouseLeave={hidePreview}
      className={`group bg-midnight-900 border rounded-xl p-4 transition-all flex flex-col gap-3
        ${hovered ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : 'border-midnight-800 hover:border-emerald-500/30'}`}>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ background: bg }}>
          {model.author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 truncate">{model.author}</p>
          <p className="font-bold text-sm text-white truncate leading-tight" title={name}>{baseName}</p>
        </div>
        <a href={`https://huggingface.co/${model.id}`} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="p-1 bg-midnight-800 hover:bg-midnight-700 text-slate-400 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0 mt-0.5">
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">GGUF</span>
        {quants.map(q => (
          <span key={q.label} className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${q.cls}`}>{q.label}</span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmtNum(downloads)}</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{fmtNum(likes)}</span>
        <span className="ml-auto text-[9px] text-slate-600 flex items-center gap-0.5"><Info className="w-2.5 h-2.5" />hover</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onLoadChat(model.id)}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black
            bg-oldgold-500/15 hover:bg-oldgold-500 text-oldgold-400 hover:text-midnight-950
            border border-oldgold-500/30 hover:border-oldgold-500 transition-all">
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </button>
        <button onClick={handlePull} disabled={pullState === 'pulling'}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black border transition-all
            ${pullState === 'done'    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : pullState === 'error'   ? 'bg-red-500/20 text-red-400 border-red-500/40'
            : 'bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border-emerald-500/25 hover:border-emerald-500 disabled:opacity-50'}`}>
          {pullState === 'pulling' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : pullState === 'done'   ? <CheckCircle2 className="w-3.5 h-3.5" />
          : pullState === 'error'  ? <span className="text-[9px]">Failed</span>
          : <><span className="text-[13px] leading-none">🦙</span> Pull</>}
        </button>
      </div>

      {pullState === 'pulling' && <p className="text-[10px] text-emerald-400 text-center">Pulling hf.co/{model.id}…</p>}
      {pullState === 'done'    && <p className="text-[10px] text-emerald-400 text-center">Pull started — monitor in 🦙 OLLAMA tab.</p>}

      {/* Hover preview */}
      {hovered && cardRef.current && (
        <HoverPreview anchorRef={cardRef} visible={hovered}>
          <div className="bg-midnight-900 border border-emerald-500/50 rounded-xl p-4 shadow-2xl shadow-midnight-950/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono text-slate-300 truncate">{model.id}</p>
              <a href={`https://huggingface.co/${model.id}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-1 rounded bg-midnight-800 hover:bg-midnight-700 text-slate-400 hover:text-white transition-colors pointer-events-auto">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[10px] font-bold text-emerald-400 mb-1">What is GGUF?</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Quantized model for CPU/GPU inference via Ollama. Runs locally on your machine — no cloud API needed.
                Hit <strong className="text-white">🦙 Pull</strong> to download, then select from your model dropdown.
              </p>
            </div>

            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Available Quants</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { q: 'Q4_K_M', note: 'Best balance', cls: 'text-green-400' },
                  { q: 'Q8_0',   note: 'Highest quality', cls: 'text-blue-400' },
                  { q: 'Q5_K_M', note: 'High quality', cls: 'text-cyan-400' },
                ].map(({ q, note, cls }) => (
                  <div key={q} className="text-[9px] px-2 py-1 rounded bg-midnight-800 border border-midnight-700">
                    <span className={`font-black ${cls}`}>{q}</span>
                    <span className="text-slate-500 ml-1">· {note}</span>
                  </div>
                ))}
              </div>
            </div>

            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map(t => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-midnight-800 text-slate-400 border border-midnight-700 font-mono">{t}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 pt-1 border-t border-midnight-800">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Download className="w-3.5 h-3.5 text-slate-500" /><span className="font-bold text-white">{fmtNum(downloads)}</span> downloads
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Heart className="w-3.5 h-3.5 text-red-400" /><span className="font-bold text-white">{fmtNum(likes)}</span> likes
              </span>
            </div>
          </div>
        </HoverPreview>
      )}
    </div>
  );
};

// ── Hover preview wrapper — anchors to card via CSS fixed position ─────────────
const HoverPreview: React.FC<{
  anchorRef: React.RefObject<HTMLDivElement>;
  visible: boolean;
  children: React.ReactNode;
}> = ({ anchorRef, visible, children }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelH = 230;
    const spaceBelow = window.innerHeight - rect.bottom;
    const below = spaceBelow > panelH + 8;
    const top = below ? rect.bottom + 6 : rect.top - panelH - 6;
    let left = rect.left;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    setStyle({ position: 'fixed', top, left, width: rect.width, zIndex: 9999 });
  }, [visible]);

  if (!visible) return null;
  return (
    <div style={style} className="pointer-events-none animate-[fadeSlideIn_0.12s_ease-out]">
      {children}
    </div>
  );
};

// ── Main HFPage ────────────────────────────────────────────────────────────────
type Tab = 'models' | 'spaces' | 'gguf';

const HFPage: React.FC<HFPageProps> = ({ onAddModel }) => {
  const [tab, setTab] = useState<Tab>('models');
  const [models, setModels] = useState<Model[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [ggufModels, setGgufModels] = useState<GgufModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [ggufLoading, setGgufLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchModels = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached<Model[]>('hf_trending_models');
      if (cached) { setModels(cached); setLoading(false); return; }
    }
    try {
      const { data } = await axios.get(`${API}/trending`);
      const list: Model[] = data.text || [];
      setModels(list); setCache('hf_trending_models', list);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const fetchSpaces = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached<Space[]>('hf_trending_spaces');
      if (cached) { setSpaces(cached); return; }
    }
    try {
      const { data } = await axios.get(`${API}/spaces`);
      const list: Space[] = data.spaces || [];
      setSpaces(list); setCache('hf_trending_spaces', list);
    } catch { /* silent */ }
  }, []);

  const fetchGguf = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached<GgufModel[]>('hf_trending_gguf');
      if (cached) { setGgufModels(cached); setGgufLoading(false); return; }
    }
    try {
      const { data } = await axios.get(`${API}/trending/gguf`);
      const list: GgufModel[] = data.models || [];
      setGgufModels(list); setCache('hf_trending_gguf', list);
    } catch { /* silent */ }
    finally { setGgufLoading(false); }
  }, []);

  useEffect(() => { fetchModels(); fetchSpaces(); fetchGguf(); }, [refreshKey]);

  const forceRefresh = () => {
    ['hf_trending_models', 'hf_trending_spaces', 'hf_trending_gguf'].forEach(k => localStorage.removeItem(k));
    setLoading(true); setGgufLoading(true); setRefreshKey(k => k + 1);
  };

  const filteredModels = models.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) || m.author.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSpaces = spaces.filter(s =>
    s.id.toLowerCase().includes(search.toLowerCase()) || s.author.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGguf = ggufModels.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) || m.author.toLowerCase().includes(search.toLowerCase())
  );

  const handleGgufPull = async (modelId: string) => {
    await axios.post(`${API}/ollama/pull`, { name: `hf.co/${modelId}` });
    onAddModel(`ollama/${modelId.split('/').pop()!}`);
  };

  // ── Space iframe viewer ──────────────────────────────────────────────────────
  if (selectedSpace) {
    return (
      <div className="flex-1 flex flex-col bg-midnight-950">
        <div className="bg-midnight-900 border-b border-midnight-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedSpace(null)}
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500 text-white uppercase">Space</span>
              <span className="text-slate-200 font-medium text-sm">{selectedSpace}</span>
            </div>
          </div>
          <a href={`https://huggingface.co/spaces/${selectedSpace}`} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-oldgold-400 hover:underline flex items-center gap-1 font-bold">
            Open in Browser <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <iframe src={`https://huggingface.co/spaces/${selectedSpace}?embed=true`}
          className="w-full flex-1 border-0" title="HF Space" />
      </div>
    );
  }

  const tabDefs: [Tab, string, string, number][] = [
    ['models', 'Models', '🤖', filteredModels.length],
    ['spaces', 'Spaces', '🚀', filteredSpaces.length],
    ['gguf',   'GGUF',   '📦', filteredGguf.length],
  ];

  return (
    <div className="flex-1 bg-midnight-950 text-slate-100 overflow-y-auto">
      {/* ── Header ── */}
      <div className="border-b border-midnight-800 bg-midnight-900">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'linear-gradient(135deg, #FFD21E 0%, #FF9D00 100%)' }}>🤗</div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Hugging Face</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Trending · Updated twice daily</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Next refresh: {nextRefresh('hf_trending_models')}</span>
              </div>
              <button onClick={forceRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 rounded-lg text-xs font-bold text-slate-300 transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh now
              </button>
            </div>
          </div>

          {/* Discovery banner */}
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-oldgold-500/5 border border-oldgold-500/15 flex items-center gap-3">
            <Info className="w-4 h-4 text-oldgold-400 shrink-0" />
            <p className="text-xs text-slate-400">
              <span className="text-oldgold-400 font-bold">Hover any card</span> for a full summary before you commit.
              {' '}Hit <span className="font-bold text-white">Load in Chat</span> to swap your active model instantly.
              GGUF cards include <span className="font-bold text-emerald-400">🦙 Pull</span> to download locally.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 mt-5 border-b border-midnight-800 -mb-px">
            {tabDefs.map(([id, label, emoji, count]) => (
              <button key={id} onClick={() => { setTab(id); setSearch(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  tab === id ? 'border-oldgold-500 text-oldgold-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}>
                <span>{emoji}</span><span>{label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${tab === id ? 'bg-oldgold-500/20 text-oldgold-400' : 'bg-midnight-800 text-slate-500'}`}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="relative mb-6 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text"
            placeholder={tab === 'models' ? 'Filter models…' : tab === 'spaces' ? 'Filter spaces…' : 'Filter GGUF models…'}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-midnight-900 border border-midnight-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-oldgold-500/50 placeholder-slate-600 transition-colors" />
        </div>

        {/* MODELS */}
        {tab === 'models' && (loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-2 border-oldgold-500/30 border-t-oldgold-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Fetching from Hugging Face…</span>
          </div>
        ) : filteredModels.length === 0 ? (
          <p className="text-slate-500 text-center py-16">No models found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModels.map(m => <ModelCard key={m.id} model={m} onAdd={onAddModel} />)}
          </div>
        ))}

        {/* SPACES */}
        {tab === 'spaces' && (filteredSpaces.length === 0 ? (
          <p className="text-slate-500 text-center py-16">No spaces found.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSpaces.map(s => <SpaceCard key={s.id} space={s} onOpen={setSelectedSpace} />)}
            </div>
            <div className="mt-6 flex justify-center">
              <a href="https://huggingface.co/spaces" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-oldgold-400 transition-colors">
                <Globe className="w-4 h-4" />Explore all Spaces on huggingface.co<ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </>
        ))}

        {/* GGUF */}
        {tab === 'gguf' && (ggufLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Fetching trending GGUF models…</span>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-3">
              <Package className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400">
                Local GGUF models run via <span className="font-bold text-white">Ollama</span> — no GPU required.
                Hover any card for quant guide + details.
                <span className="font-bold text-white"> 🦙 Pull</span> downloads + registers in selector.
                <span className="font-bold text-white"> Chat</span> loads via HF Inference instead.
              </p>
            </div>
            {filteredGguf.length === 0 ? (
              <p className="text-slate-500 text-center py-16">No GGUF models found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGguf.map(m => <GgufCard key={m.id} model={m} onLoadChat={onAddModel} onPull={handleGgufPull} />)}
              </div>
            )}
            <div className="mt-8 flex justify-center">
              <a href="https://huggingface.co/models?filter=gguf&sort=downloads" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                <Globe className="w-4 h-4" />Browse all GGUF models on huggingface.co<ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </>
        ))}
      </div>

      {/* Fade-slide keyframe (injected once) */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default HFPage;
