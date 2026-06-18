import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Download, Play, Search, RefreshCw, HardDrive, Eye, Code2,
  Wrench, Layers, Tag, ChevronRight, Zap, CheckCircle2,
} from 'lucide-react';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface OllamaMirrorProps {
  onSelectModel: (modelId: string) => void;
  navigateTo: (page: string) => void;
}

// ── Tag detection ────────────────────────────────────────────────────────────
const TAGS: [RegExp, string, string][] = [
  [/vision|vl|llava|bakllava/i, 'vision', 'bg-purple-500/15 text-purple-400 border-purple-500/25'],
  [/coder|code|deepseek-coder|starcoder/i, 'code', 'bg-blue-500/15 text-blue-400 border-blue-500/25'],
  [/embed|nomic|mxbai|bge/i, 'embedding', 'bg-teal-500/15 text-teal-400 border-teal-500/25'],
  [/tool|function|hermes|mistral-nemo/i, 'tools', 'bg-orange-500/15 text-orange-400 border-orange-500/25'],
  [/math|wizard|mathcoder/i, 'math', 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'],
];
function getTags(name: string) {
  const found: { label: string; cls: string }[] = [];
  for (const [re, label, cls] of TAGS) {
    if (re.test(name)) found.push({ label, cls });
  }
  if (found.length === 0) found.push({ label: 'chat', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' });
  return found.slice(0, 2);
}

function fmtSize(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? gb.toFixed(1) + ' GB' : (bytes / 1024 ** 2).toFixed(0) + ' MB';
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso?.slice(0, 10) || '—'; }
}

// ── Model row (ollama.com list style) ────────────────────────────────────────
const ModelRow: React.FC<{
  model: OllamaModel;
  onActivate: (name: string) => void;
}> = ({ model, onActivate }) => {
  const base = model.name.split(':')[0];
  const tag = model.name.split(':')[1] || 'latest';
  const tags = getTags(model.name);

  return (
    <div className="group flex items-center gap-4 px-5 py-4 border-b border-midnight-800/60 hover:bg-midnight-900/60 transition-colors">
      {/* Model name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white text-[15px]">{base}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-slate-400 border border-midnight-700">{tag}</span>
          {tags.map(t => (
            <span key={t.label} className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${t.cls}`}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{fmtSize(model.size)}</span>
          <span>Updated {fmtDate(model.modified_at)}</span>
          <span className="font-mono text-slate-600">{model.digest?.slice(7, 19) || '—'}</span>
        </div>
      </div>
      {/* Activate */}
      <button
        onClick={() => onActivate(model.name)}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-midnight-800 hover:bg-emerald-600 border border-midnight-700 hover:border-emerald-500 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100"
      >
        <Play className="w-3 h-3" /> Use
      </button>
    </div>
  );
};

// ── Main OllamaMirror ────────────────────────────────────────────────────────
const OllamaMirror: React.FC<OllamaMirrorProps> = ({ onSelectModel, navigateTo }) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pullInput, setPullInput] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [daemonUp, setDaemonUp] = useState<boolean | null>(null);

  const fetchModels = async () => {
    try {
      const { data } = await axios.get('http://127.0.0.1:8001/ollama/tags');
      setModels(data.models || []);
      setDaemonUp(true);
    } catch {
      setDaemonUp(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    const t = setInterval(fetchModels, 10000);
    return () => clearInterval(t);
  }, []);

  const handlePull = async () => {
    if (!pullInput.trim()) return;
    setIsPulling(true);
    setPullStatus(null);
    try {
      await axios.post('http://127.0.0.1:8001/ollama/pull', { name: pullInput.trim() });
      setPullStatus({ text: `Pulling ${pullInput.trim()}… check back shortly.`, ok: true });
      setPullInput('');
    } catch {
      setPullStatus({ text: 'Pull failed. Is Ollama running on :11434?', ok: false });
    } finally {
      setIsPulling(false);
    }
  };

  const handleActivate = (name: string) => {
    onSelectModel(`ollama/${name}`);
    navigateTo('chat');
  };

  const filtered = models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 bg-[#0a0a0a] text-slate-100 overflow-y-auto">

      {/* ── Hero ── */}
      <div className="border-b border-[#1a1a1a] px-8 py-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <span className="text-xl">🦙</span>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Ollama</h1>
                <p className="text-xs text-slate-500">Local AI, running on your machine</p>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold ml-2 ${
                daemonUp === null ? 'border-slate-700 text-slate-500' :
                daemonUp ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
                'border-red-500/30 bg-red-500/10 text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${daemonUp ? 'bg-emerald-400 animate-pulse' : daemonUp === false ? 'bg-red-400' : 'bg-slate-500'}`} />
                {daemonUp === null ? 'Checking…' : daemonUp ? 'Daemon up' : 'Daemon offline'}
              </div>
            </div>
            <p className="text-slate-400 text-sm max-w-xl">
              Get up and running with large language models locally. Pull any model from the Ollama library and use it instantly in BERYL's chat.
            </p>
          </div>
          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="text-3xl font-black text-white">{models.length}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Local Models</div>
            </div>
            <div className="w-px h-10 bg-[#2a2a2a]" />
            <div>
              <div className="text-3xl font-black text-emerald-400">{(models.reduce((a, m) => a + m.size, 0) / 1024 ** 3).toFixed(1)}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">GB on Disk</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

        {/* ── Pull box ── */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" /> Pull a model
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm select-none">ollama run</span>
              <input
                type="text"
                placeholder="llama3, qwen2.5-coder:7b, mistral…"
                value={pullInput}
                onChange={e => setPullInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePull()}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl pl-[88px] pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 font-mono placeholder-slate-600 transition-colors"
              />
            </div>
            <button
              onClick={handlePull}
              disabled={isPulling || !pullInput.trim()}
              className="px-5 py-3 bg-white hover:bg-slate-100 disabled:bg-[#222] disabled:text-slate-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 text-sm shrink-0"
            >
              {isPulling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Pull
            </button>
          </div>
          {pullStatus && (
            <div className={`mt-3 flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg ${
              pullStatus.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {pullStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Zap className="w-3.5 h-3.5 shrink-0" />}
              {pullStatus.text}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {['llama3.2', 'qwen2.5-coder:7b', 'mistral', 'phi4', 'gemma3:4b', 'nomic-embed-text'].map(s => (
              <button key={s} onClick={() => setPullInput(s)}
                className="text-[11px] px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-full text-slate-400 hover:text-white transition-all font-mono">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Capability legend ── */}
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          <span className="text-slate-600 font-bold uppercase tracking-widest">Capabilities:</span>
          {[
            { label: 'vision', Icon: Eye, cls: 'text-purple-400' },
            { label: 'code', Icon: Code2, cls: 'text-blue-400' },
            { label: 'embedding', Icon: Layers, cls: 'text-teal-400' },
            { label: 'tools', Icon: Wrench, cls: 'text-orange-400' },
            { label: 'chat', Icon: Tag, cls: 'text-slate-400' },
          ].map(({ label, Icon, cls }) => (
            <span key={label} className={`flex items-center gap-1 font-bold ${cls}`}>
              <Icon className="w-3 h-3" />{label}
            </span>
          ))}
        </div>

        {/* ── Local registry ── */}
        <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <h2 className="font-bold text-white text-sm">Local Models</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-500 w-44 placeholder-slate-600 transition-colors"
                />
              </div>
              <button onClick={fetchModels} className="p-1.5 text-slate-500 hover:text-white hover:bg-[#222] rounded-lg transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3">
              <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-500 font-mono">Connecting to :11434…</span>
            </div>
          ) : daemonUp === false ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-8 gap-3">
              <span className="text-3xl">🦙</span>
              <p className="text-slate-300 font-bold">Ollama daemon not found</p>
              <p className="text-slate-500 text-sm">Install Ollama from <span className="text-emerald-400">ollama.com</span> and run it, then come back here.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-8 gap-3">
              <HardDrive className="w-10 h-10 text-slate-600" />
              <p className="text-slate-300 font-bold">{search ? 'No matches' : 'No local models'}</p>
              <p className="text-slate-500 text-sm">{search ? 'Try a different search term.' : 'Pull a model above to get started.'}</p>
            </div>
          ) : (
            <div>
              {filtered.map((m, i) => <ModelRow key={i} model={m} onActivate={handleActivate} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default OllamaMirror;
