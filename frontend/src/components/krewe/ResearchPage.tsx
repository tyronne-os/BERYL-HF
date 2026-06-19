import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, X, Plus, RefreshCw, BookMarked, ExternalLink, Tag,
  Calendar, Users, Loader2, Sparkles, FlaskConical,
} from 'lucide-react';
import { API } from '../../api';
import type { ArxivPaper } from './PaperBanner';

interface ResearchPageProps {
  onSelect: (paper: ArxivPaper) => void;
}

function tagColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('lip sync')) return '#00ff88';
  if (t.includes('talking')) return '#00d4ff';
  if (t.includes('diffusion')) return '#c084fc';
  if (t.includes('portrait') || t.includes('face')) return '#f472b6';
  if (t.includes('audio') || t.includes('speech')) return '#86efac';
  if (t.includes('3d') || t.includes('gaussian')) return '#60a5fa';
  if (t.includes('animation')) return '#fbbf24';
  return '#94a3b8';
}

function fmtDate(s: string) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ResearchPage: React.FC<ResearchPageProps> = ({ onSelect }) => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [papers, setPapers] = useState<ArxivPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKw, setSavingKw] = useState(false);
  const [newKw, setNewKw] = useState('');
  const [query, setQuery] = useState(''); // local text filter over results
  const [cached, setCached] = useState(false);

  const loadKeywords = useCallback(async () => {
    try {
      const res = await fetch(`${API}/krewe/research/keywords`);
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch { /* ignore */ }
  }, []);

  const loadPapers = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/krewe/research/papers?limit=120${refresh ? '&refresh=true' : ''}`, {
        signal: AbortSignal.timeout(40_000),
      });
      const data = await res.json();
      setPapers(data.papers || []);
      setCached(!!data.cached);
      if (data.keywords) setKeywords(data.keywords);
    } catch {
      setPapers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeywords(); loadPapers(); }, [loadKeywords, loadPapers]);

  const saveKeywords = async (next: string[]) => {
    setSavingKw(true);
    setKeywords(next);
    try {
      await fetch(`${API}/krewe/research/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: next }),
      });
      await loadPapers(true); // re-fetch with new keyword set
    } catch { /* ignore */ }
    finally { setSavingKw(false); }
  };

  const addKeyword = () => {
    const k = newKw.trim();
    if (!k || keywords.some(x => x.toLowerCase() === k.toLowerCase())) { setNewKw(''); return; }
    saveKeywords([...keywords, k]);
    setNewKw('');
  };

  const removeKeyword = (k: string) => saveKeywords(keywords.filter(x => x !== k));

  const visible = query.trim()
    ? papers.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        (p.summary || '').toLowerCase().includes(query.toLowerCase()) ||
        (p.authors || []).some(a => a.toLowerCase().includes(query.toLowerCase())))
    : papers;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-midnight-950 text-slate-100">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-midnight-800 bg-midnight-900 px-6 py-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-oldgold-500/15 border border-oldgold-500/30 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-oldgold-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                Research Intelligence
                {cached && <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-midnight-950 border border-midnight-800">cached</span>}
              </h1>
              <p className="text-[11px] text-slate-500">Live ArXiv papers matched to your keywords · {papers.length} results</p>
            </div>
          </div>
          <button
            onClick={() => loadPapers(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-oldgold-500/15 hover:bg-oldgold-500/25 border border-oldgold-500/30 text-oldgold-400 font-bold text-xs rounded-xl transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh ArXiv
          </button>
        </div>

        {/* keyword manager */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-2 shrink-0">
            <Tag className="w-3 h-3" /> Keywords
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {keywords.map(k => (
              <span key={k} className="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-midnight-950 border border-midnight-700 text-[12px] text-slate-300">
                {k}
                <button onClick={() => removeKeyword(k)} className="text-slate-600 hover:text-red-400 transition-colors" title="Remove">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {/* add keyword */}
            <div className="flex items-center gap-1 bg-midnight-950 border border-midnight-700 focus-within:border-oldgold-500/50 rounded-full pl-3 pr-1 py-1 transition-colors">
              <input
                value={newKw}
                onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addKeyword(); }}
                placeholder="add keyword…"
                className="bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none w-32"
              />
              <button onClick={addKeyword} className="w-6 h-6 rounded-full bg-oldgold-500/20 hover:bg-oldgold-500/40 text-oldgold-400 flex items-center justify-center transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {savingKw && <Loader2 className="w-4 h-4 text-oldgold-400 animate-spin" />}
          </div>
        </div>

        {/* local filter */}
        <div className="mt-3 flex items-center gap-2 bg-midnight-950 border border-midnight-800 rounded-xl px-3 py-2 max-w-md">
          <Search className="w-4 h-4 text-slate-600 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter these results…"
            className="bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none flex-1"
          />
          {query && <button onClick={() => setQuery('')} className="text-slate-600 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {/* ── RESULTS GRID ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-oldgold-400 animate-spin mb-3" />
            <p className="text-sm text-slate-400">Searching ArXiv for {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}…</p>
            <p className="text-[11px] text-slate-600 mt-1">First fetch can take ~20s</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <BookMarked className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-400">{keywords.length === 0 ? 'Add a keyword to start matching papers.' : 'No papers matched. Try broader keywords or Refresh.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(p => {
              const color = tagColor(p.title);
              return (
                <div
                  key={p.arxiv_id}
                  className="group flex flex-col bg-midnight-900 border border-midnight-800 hover:border-oldgold-500/40 rounded-2xl p-4 transition-all cursor-pointer"
                  onClick={() => onSelect(p)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[8px] font-black tracking-widest px-2 py-1 rounded" style={{ color, background: `${color}16`, border: `1px solid ${color}33` }}>
                      {(p.categories?.[0] || 'cs.CV').toUpperCase()}
                    </span>
                    {p.matched_keyword && (
                      <span className="text-[9px] text-oldgold-400/70 flex items-center gap-1 truncate">
                        <Tag className="w-2.5 h-2.5" /> {p.matched_keyword}
                      </span>
                    )}
                  </div>

                  <h3 className="text-[14px] font-bold text-slate-100 group-hover:text-white leading-snug mb-2 line-clamp-2">
                    {p.title}
                  </h3>

                  {p.summary && (
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3 mb-3 flex-1">
                      {p.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-slate-600 mb-3">
                    {p.authors?.[0] && <span className="flex items-center gap-1 truncate"><Users className="w-3 h-3 shrink-0" />{p.authors[0]}{p.authors.length > 1 ? ` +${p.authors.length - 1}` : ''}</span>}
                    {p.published && <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" />{fmtDate(p.published)}</span>}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-midnight-800">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(p); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-oldgold-500/15 hover:bg-oldgold-500/30 text-oldgold-400 text-[11px] font-bold transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Open · Squad It
                    </button>
                    <a
                      href={p.arxiv_url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-midnight-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors"
                      title="Open on arXiv"
                    >
                      <ExternalLink className="w-3 h-3" /> {p.arxiv_id}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchPage;
