import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Plus, ExternalLink, Globe, Download, Heart, RefreshCw, Clock, Layout, ChevronRight } from 'lucide-react';
import { API } from '../api';

interface Model { id: string; author: string; }
interface Space { id: string; author: string; }
interface HFPageProps { onAddModel: (modelId: string) => void; }

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

const TASK_MAP: [RegExp, string, string][] = [
  [/coder|code|starcoder|deepseek-coder/i, 'Code', 'bg-blue-500/20 text-blue-400 border-blue-500/30'],
  [/vision|vl-|clip|-vl|qwen-vl|intern.?vl|molmo|llava/i, 'Vision', 'bg-purple-500/20 text-purple-400 border-purple-500/30'],
  [/whisper|audio|speech|wav2vec|seamless/i, 'Audio', 'bg-green-500/20 text-green-400 border-green-500/30'],
  [/embed|bge-|e5-|sentence|gte-|nomic-embed/i, 'Embedding', 'bg-teal-500/20 text-teal-400 border-teal-500/30'],
  [/flux|sdxl|diffusion|stable-|imagen|dall/i, 'Image Gen', 'bg-pink-500/20 text-pink-400 border-pink-500/30'],
  [/reward|dpo|rlhf/i, 'Alignment', 'bg-red-500/20 text-red-400 border-red-500/30'],
  [/instruct|chat|llama|qwen|mistral|gemma|phi|mixtral|falcon|vicuna|mini.?max|deepseek|yi-/i, 'Chat', 'bg-orange-500/20 text-orange-400 border-orange-500/30'],
];
function detectTask(id: string): { label: string; cls: string } {
  for (const [re, label, cls] of TASK_MAP) {
    if (re.test(id)) return { label, cls };
  }
  return { label: 'Text Gen', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
}

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

// ── Model Card ────────────────────────────────────────────────────────────────
const ModelCard: React.FC<{ model: Model; onAdd: (id: string) => void }> = ({ model, onAdd }) => {
  const { label, cls } = detectTask(model.id);
  const name = model.id.split('/').pop()!;
  const downloads = pseudoNum(model.id, 10000, 5000000);
  const likes = pseudoNum(model.id + 'likes', 50, 50000);
  const bg = avatarColor(model.author);

  return (
    <div className="group bg-midnight-900 border border-midnight-800 hover:border-oldgold-500/40 rounded-xl p-4 transition-all flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white"
          style={{ background: bg }}>{model.author.charAt(0).toUpperCase()}</div>
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
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAdd(model.id)} title="Add to chat"
            className="p-1 bg-oldgold-500/20 hover:bg-oldgold-500 text-oldgold-400 hover:text-midnight-950 rounded transition-all">
            <Plus className="w-3 h-3" />
          </button>
          <a href={`https://huggingface.co/${model.id}`} target="_blank" rel="noopener noreferrer"
            className="p-1 bg-midnight-800 hover:bg-midnight-700 text-slate-400 rounded transition-all">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
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
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500 text-white">Space</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-slate-400">
          <Heart className="w-3 h-3" />{fmtNum(likes)}
        </div>
      </div>
      <div className="p-3">
        <p className="font-bold text-sm text-white truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0"
            style={{ background: bg }}>{space.author.charAt(0).toUpperCase()}</div>
          <p className="text-[10px] text-slate-500 truncate">{space.author}</p>
        </div>
      </div>
    </div>
  );
};

// ── Main HFPage ───────────────────────────────────────────────────────────────
type Tab = 'models' | 'spaces';

const HFPage: React.FC<HFPageProps> = ({ onAddModel }) => {
  const [tab, setTab] = useState<Tab>('models');
  const [models, setModels] = useState<Model[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
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
      setModels(list);
      setCache('hf_trending_models', list);
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
      setSpaces(list);
      setCache('hf_trending_spaces', list);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchSpaces();
  }, [refreshKey]);

  const forceRefresh = () => {
    localStorage.removeItem('hf_trending_models');
    localStorage.removeItem('hf_trending_spaces');
    setLoading(true);
    setRefreshKey(k => k + 1);
  };

  const filteredModels = models.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.author.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSpaces = spaces.filter(s =>
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.author.toLowerCase().includes(search.toLowerCase())
  );

  // ── Space viewer ────────────────────────────────────────────────────────────
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

  return (
    <div className="flex-1 bg-midnight-950 text-slate-100 overflow-y-auto">
      {/* ── HF-style header ── */}
      <div className="border-b border-midnight-800 bg-midnight-900">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {/* HF logo-inspired badge */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black"
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
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 mt-5 border-b border-midnight-800 -mb-px">
            {([['models', 'Models', '🤖'], ['spaces', 'Spaces', '🚀']] as const).map(([id, label, emoji]) => (
              <button key={id} onClick={() => { setTab(id); setSearch(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  tab === id
                    ? 'border-oldgold-500 text-oldgold-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}>
                <span>{emoji}</span><span>{label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${tab === id ? 'bg-oldgold-500/20 text-oldgold-400' : 'bg-midnight-800 text-slate-500'}`}>
                  {id === 'models' ? models.length : spaces.length}
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
          <input type="text" placeholder={tab === 'models' ? 'Filter models…' : 'Filter spaces…'}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-midnight-900 border border-midnight-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-oldgold-500/50 placeholder-slate-600 transition-colors" />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-2 border-oldgold-500/30 border-t-oldgold-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Fetching from Hugging Face…</span>
          </div>
        ) : tab === 'models' ? (
          <>
            {filteredModels.length === 0 ? (
              <p className="text-slate-500 text-center py-16">No models found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredModels.map(m => <ModelCard key={m.id} model={m} onAdd={onAddModel} />)}
              </div>
            )}
          </>
        ) : (
          <>
            {filteredSpaces.length === 0 ? (
              <p className="text-slate-500 text-center py-16">No spaces found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSpaces.map(s => <SpaceCard key={s.id} space={s} onOpen={setSelectedSpace} />)}
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <a href="https://huggingface.co/spaces" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-oldgold-400 transition-colors">
                <Globe className="w-4 h-4" />Explore all Spaces on huggingface.co
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HFPage;
