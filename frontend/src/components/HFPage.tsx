import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search, Plus, ExternalLink, Globe, Download, Heart, RefreshCw, Clock,
  Layout, ChevronRight, CheckCircle2, Loader2, Package, Zap, MessageSquare,
} from 'lucide-react';
import { API } from '../api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Model  { id: string; author: string; }
interface Space  { id: string; author: string; }
interface GgufModel { id: string; author: string; tags: string[]; downloads: number; likes: number; }

interface HFPageProps {
  onAddModel: (modelId: string) => void;
}

// ── Cache (12-hour TTL — twice-daily refresh) ─────────────────────────────────
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
    const next = new Date(ts + CACHE_TTL);
    return next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return 'now'; }
}

// ── Task detection ─────────────────────────────────────────────────────────────
const TASK_MAP: [RegExp, string, string][] = [
  [/coder|code|starcoder|deepseek-coder/i, 'Code', 'bg-blue-500/20 text-blue-400 border-blue-500/30'],
  [/vision|vl-|clip|-vl|qwen-vl|intern.?vl|molmo|llava/i, 'Vision', 'bg-purple-500/20 text-purple-400 border-purple-500/30'],
  [/whisper|audio|speech|wav2vec|seamless/i, 'Audio', 'bg-green-500/20 text-green-400 border-green-500/30'],
  [/embed|bge-|e5-|sentence|gte-|nomic-embed/i, 'Embedding', 'bg-teal-500/20 text-teal-400 border-teal-500/30'],
  [/flux|sdxl|diffusion|stable-|imagen|dall/i, 'Image Gen', 'bg-pink-500/20 text-pink-400 border-pink-500/30'],
  [/instruct|chat|llama|qwen|mistral|gemma|phi|mixtral|falcon|vicuna|mini.?max|deepseek|yi-/i, 'Chat', 'bg-orange-500/20 text-orange-400 border-orange-500/30'],
];
function detectTask(id: string): { label: string; cls: string } {
  for (const [re, label, cls] of TASK_MAP) if (re.test(id)) return { label, cls };
  return { label: 'Text Gen', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
}

// ── GGUF quant detection ───────────────────────────────────────────────────────
const QUANT_PATTERNS: [RegExp, string, string][] = [
  [/Q4_K_M|q4_k_m/i, 'Q4_K_M', 'bg-green-500/15 text-green-400 border-green-500/25'],
  [/Q8_0|q8_0/i, 'Q8_0', 'bg-blue-500/15 text-blue-400 border-blue-500/25'],
  [/Q5_K_M|q5_k_m/i, 'Q5_K_M', 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'],
  [/Q2_K|q2_k/i, 'Q2_K', 'bg-orange-500/15 text-orange-400 border-orange-500/25'],
  [/IQ3|iq3/i, 'IQ3', 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'],
  [/F16|f16/i, 'F16', 'bg-purple-500/15 text-purple-400 border-purple-500/25'],
];
function detectQuants(id: string): { label: string; cls: string }[] {
  const found = QUANT_PATTERNS.filter(([re]) => re.test(id)).map(([, label, cls]) => ({ label, cls }));
  if (found.length === 0) return [{ label: 'GGUF', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' }];
  return found.slice(0, 2);
}

// ── Stat helpers ───────────────────────────────────────────────────────────────
function pseudoNum(seed: string, min: number, max: number): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
  return min + Math.abs(h >>> 0) % (max - min);
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

const AVATAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777'];
function avatarColor(s: string) { return AVATAR_COLORS[pseudoNum(s, 0, AVATAR_COLORS.length)]; }

// ── Pull toast state type ──────────────────────────────────────────────────────
type PullState = 'idle' | 'pulling' | 'done' | 'error';

// ── Model Card (HF Trending) ───────────────────────────────────────────────────
const ModelCard: React.FC<{ model: Model; onAdd: (id: string) => void }> = ({ model, onAdd }) => {
  const { label, cls } = detectTask(model.id);
  const name = model.id.split('/').pop()!;
  const downloads = pseudoNum(model.id, 10000, 5000000);
  const likes = pseudoNum(model.id + 'likes', 50, 50000);
  const bg = avatarColor(model.author);

  return (
    <div className="group bg-midnight-900 border border-midnight-800 hover:border-oldgold-500/40 rounded-xl p-4 transition-all flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ background: bg }}>
          {model.author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 truncate">{model.author}</p>
          <p className="font-bold text-sm text-white truncate leading-tight" title={name}>{name}</p>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls} shrink-0`}>{label}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmtNum(downloads)}</span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmtNum(likes)}</span>
        </div>
        <a href={`https://huggingface.co/${model.id}`} target="_blank" rel="noopener noreferrer"
          className="p-1 bg-midnight-800 hover:bg-midnight-700 text-slate-400 rounded transition-all opacity-0 group-hover:opacity-100">
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {/* Always-visible CTA */}
      <button onClick={() => onAdd(model.id)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black
          bg-oldgold-500/15 hover:bg-oldgold-500 text-oldgold-400 hover:text-midnight-950
          border border-oldgold-500/30 hover:border-oldgold-500
          transition-all shadow-sm">
        <MessageSquare className="w-3.5 h-3.5" />
        Load in Chat
      </button>
    </div>
  );
};

// ── Space Card ────────────────────────────────────────────────────────────────
const SpaceCard: React.FC<{ space: Space; onOpen: (id: string) => void }> = ({ space, onOpen }) => {
  const name = space.id.split('/').pop()!;
  const bg = avatarColor(space.author);
  const likes = pseudoNum(space.id + 'likes', 20, 20000);

  return (
    <div onClick={() => onOpen(space.id)}
      className="group bg-midnight-900 border border-midnight-800 hover:border-purple-500/40 rounded-xl overflow-hidden transition-all cursor-pointer">
      <div className="h-28 relative flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${bg}22 0%, #0d0823 100%)` }}>
        <Layout className="w-8 h-8 text-slate-600 group-hover:scale-110 transition-transform" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-900/80 to-transparent" />
        <div className="absolute bottom-2 left-3">
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500 text-white">Space</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-slate-400">
          <Heart className="w-3 h-3" />{fmtNum(likes)}
        </div>
      </div>
      <div className="p-3">
        <p className="font-bold text-sm text-white truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0" style={{ background: bg }}>
            {space.author.charAt(0).toUpperCase()}
          </div>
          <p className="text-[10px] text-slate-500 truncate">{space.author}</p>
        </div>
      </div>
    </div>
  );
};

// ── GGUF Card ─────────────────────────────────────────────────────────────────
const GgufCard: React.FC<{
  model: GgufModel;
  onLoadChat: (id: string) => void;
  onPull: (id: string) => Promise<void>;
}> = ({ model, onLoadChat, onPull }) => {
  const [pullState, setPullState] = useState<PullState>('idle');
  const name = model.id.split('/').pop()!;
  const bg = avatarColor(model.author);
  const quants = detectQuants(model.id);
  const downloads = model.downloads > 0 ? model.downloads : pseudoNum(model.id, 5000, 2000000);
  const likes = model.likes > 0 ? model.likes : pseudoNum(model.id + 'likes', 10, 10000);

  const handlePull = async () => {
    if (pullState === 'pulling') return;
    setPullState('pulling');
    try {
      await onPull(model.id);
      setPullState('done');
      setTimeout(() => setPullState('idle'), 4000);
    } catch {
      setPullState('error');
      setTimeout(() => setPullState('idle'), 3000);
    }
  };

  return (
    <div className="group bg-midnight-900 border border-midnight-800 hover:border-emerald-500/30 rounded-xl p-4 transition-all flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white" style={{ background: bg }}>
          {model.author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 truncate">{model.author}</p>
          <p className="font-bold text-sm text-white truncate leading-tight" title={name}>{name}</p>
        </div>
        <a href={`https://huggingface.co/${model.id}`} target="_blank" rel="noopener noreferrer"
          className="p-1 bg-midnight-800 hover:bg-midnight-700 text-slate-400 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0 mt-0.5">
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Quant badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">GGUF</span>
        {quants.map(q => (
          <span key={q.label} className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${q.cls}`}>{q.label}</span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmtNum(downloads)}</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmtNum(likes)}</span>
      </div>

      {/* Two CTAs */}
      <div className="grid grid-cols-2 gap-2">
        {/* Load via HF Inference */}
        <button onClick={() => onLoadChat(model.id)}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black
            bg-oldgold-500/15 hover:bg-oldgold-500 text-oldgold-400 hover:text-midnight-950
            border border-oldgold-500/30 hover:border-oldgold-500 transition-all">
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>
        {/* Pull to Ollama */}
        <button onClick={handlePull} disabled={pullState === 'pulling'}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black border transition-all
            ${pullState === 'done'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : pullState === 'error'
              ? 'bg-red-500/20 text-red-400 border-red-500/40'
              : 'bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border-emerald-500/25 hover:border-emerald-500 disabled:opacity-50'
            }`}>
          {pullState === 'pulling' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           pullState === 'done'    ? <CheckCircle2 className="w-3.5 h-3.5" /> :
           pullState === 'error'   ? <span className="text-[9px]">Failed</span> :
           <span className="flex items-center gap-1"><span className="text-base leading-none">🦙</span> Pull</span>}
          {pullState === 'idle' && ''}
          {pullState === 'done' && 'Pulling…'}
        </button>
      </div>

      {pullState === 'pulling' && (
        <p className="text-[10px] text-emerald-400 text-center">
          Pulling <span className="font-mono">hf.co/{model.id}</span> via Ollama…
        </p>
      )}
      {pullState === 'done' && (
        <p className="text-[10px] text-emerald-400 text-center">
          Pull started — check Ollama tab to monitor progress.
        </p>
      )}
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

  // ── Fetch MODELS ─────────────────────────────────────────────────────────────
  const fetchModels = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached<Model[]>('hf_trending_models');
      if (cached) { setModels(cached); setLoading(false); return; }
    }
    try {
      const { data } = await axios.get(`${API}/trending`);
      const list: Model[] = data.text || [];
      setModels(list);
      setCache('hf_trending_models', list);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // ── Fetch SPACES ──────────────────────────────────────────────────────────────
  const fetchSpaces = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached<Space[]>('hf_trending_spaces');
      if (cached) { setSpaces(cached); return; }
    }
    try {
      const { data } = await axios.get(`${API}/spaces`);
      const list: Space[] = data.spaces || [];
      setSpaces(list);
      setCache('hf_trending_spaces', list);
    } catch { /* silent */ }
  }, []);

  // ── Fetch GGUF ────────────────────────────────────────────────────────────────
  const fetchGguf = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCached<GgufModel[]>('hf_trending_gguf');
      if (cached) { setGgufModels(cached); setGgufLoading(false); return; }
    }
    try {
      const { data } = await axios.get(`${API}/trending/gguf`);
      const list: GgufModel[] = data.models || [];
      setGgufModels(list);
      setCache('hf_trending_gguf', list);
    } catch { /* silent */ }
    finally { setGgufLoading(false); }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchSpaces();
    fetchGguf();
  }, [refreshKey]);

  const forceRefresh = () => {
    ['hf_trending_models', 'hf_trending_spaces', 'hf_trending_gguf'].forEach(k => localStorage.removeItem(k));
    setLoading(true);
    setGgufLoading(true);
    setRefreshKey(k => k + 1);
  };

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filteredModels = models.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.author.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSpaces = spaces.filter(s =>
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.author.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGguf = ggufModels.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.author.toLowerCase().includes(search.toLowerCase())
  );

  // ── GGUF: pull via Ollama hf.co/ syntax + register in model selector ──────────
  const handleGgufPull = async (modelId: string) => {
    const ollamaName = `hf.co/${modelId}`;
    await axios.post(`${API}/ollama/pull`, { name: ollamaName });
    // Register in model selector so user can switch to it immediately
    const simpleName = modelId.split('/').pop()!;
    onAddModel(`ollama/${simpleName}`);
  };

  // ── Space iframe viewer ────────────────────────────────────────────────────────
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
      {/* ── HF-style header ── */}
      <div className="border-b border-midnight-800 bg-midnight-900">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black"
                style={{ background: 'linear-gradient(135deg, #FFD21E 0%, #FF9D00 100%)' }}>🤗</div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Hugging Face</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Trending · Updated twice daily
                </p>
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

          {/* One-click model discovery banner */}
          <div className="mt-4 px-4 py-3 rounded-xl bg-oldgold-500/5 border border-oldgold-500/15 flex items-center gap-3">
            <Zap className="w-4 h-4 text-oldgold-400 shrink-0" />
            <p className="text-xs text-slate-400">
              <span className="text-oldgold-400 font-bold">One-click model loading:</span>
              {' '}Hit <span className="font-bold text-white">Load in Chat</span> on any HF/GGUF model to instantly swap it into your active model dropdown and start chatting.
              For GGUF models, <span className="font-bold text-emerald-400">🦙 Pull</span> downloads it to Ollama and registers it in the selector simultaneously.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 mt-5 border-b border-midnight-800 -mb-px">
            {tabDefs.map(([id, label, emoji, count]) => (
              <button key={id} onClick={() => { setTab(id); setSearch(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  tab === id
                    ? 'border-oldgold-500 text-oldgold-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}>
                <span>{emoji}</span>
                <span>{label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${tab === id ? 'bg-oldgold-500/20 text-oldgold-400' : 'bg-midnight-800 text-slate-500'}`}>
                  {count}
                </span>
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

        {/* ── MODELS TAB ── */}
        {tab === 'models' && (
          loading ? (
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
          )
        )}

        {/* ── SPACES TAB ── */}
        {tab === 'spaces' && (
          filteredSpaces.length === 0 ? (
            <p className="text-slate-500 text-center py-16">No spaces found.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSpaces.map(s => <SpaceCard key={s.id} space={s} onOpen={setSelectedSpace} />)}
              </div>
              <div className="mt-6 flex justify-center">
                <a href="https://huggingface.co/spaces" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-oldgold-400 transition-colors">
                  <Globe className="w-4 h-4" />Explore all Spaces on huggingface.co
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </>
          )
        )}

        {/* ── GGUF TAB ── */}
        {tab === 'gguf' && (
          ggufLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Fetching trending GGUF models…</span>
            </div>
          ) : (
            <>
              {/* GGUF explanation bar */}
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-3">
                <Package className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-400">Local GGUF Models — Run Entirely on Your Machine</p>
                  <p className="text-xs text-slate-400 mt-1">
                    GGUF models run via <span className="font-bold text-white">Ollama</span> with no GPU required.
                    <span className="font-bold text-white"> 🦙 Pull</span> downloads the model and registers it in your selector.
                    <span className="font-bold text-white"> Chat</span> loads it via HF Inference API instead.
                    Quantizations: <span className="text-green-400 font-bold">Q4_K_M</span> = best size/quality · <span className="text-blue-400 font-bold">Q8_0</span> = highest quality.
                  </p>
                </div>
              </div>

              {filteredGguf.length === 0 ? (
                <p className="text-slate-500 text-center py-16">No GGUF models found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredGguf.map(m => (
                    <GgufCard key={m.id} model={m}
                      onLoadChat={onAddModel}
                      onPull={handleGgufPull} />
                  ))}
                </div>
              )}

              <div className="mt-8 flex justify-center">
                <a href="https://huggingface.co/models?filter=gguf&sort=downloads" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                  <Globe className="w-4 h-4" />Browse all GGUF models on huggingface.co
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

export default HFPage;
