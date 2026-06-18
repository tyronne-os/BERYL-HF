import React, { useMemo, useState } from 'react';
import { X, Search, Download, Filter, Trophy, CheckCircle, AlertTriangle, BookOpen, Tag } from 'lucide-react';
import { UNIFORMS } from './DollNode';
import { CATEGORY_LABELS, VOICE_PROFILE_LABELS } from './persona_library';
import type { AssemblyEntry, QualityGrade, PersonaCategory } from './types';
import type { PortfolioEntry } from './VanityGallery';
import { ReportOverlay } from './VanityGallery';

// Accept both manual saves (PortfolioEntry) and assembly entries (AssemblyEntry)
type AnyEntry = PortfolioEntry | AssemblyEntry;

function isAssembly(e: AnyEntry): e is AssemblyEntry {
  return 'quality_grade' in e;
}

const GRADE_STYLE: Record<QualityGrade, { color: string; bg: string; label: string; Icon: React.FC<{ className?: string }> }> = {
  A: { color: '#00ff88', bg: 'rgba(0,255,136,0.08)', label: '🏆 CERTIFIED A', Icon: Trophy },
  B: { color: '#d4af37', bg: 'rgba(212,175,55,0.08)', label: '✓ APPROVED B', Icon: CheckCircle },
  C: { color: '#ff6644', bg: 'rgba(255,102,68,0.08)', label: '△ REVIEW C', Icon: AlertTriangle },
};

interface GalleryViewProps {
  entries: AnyEntry[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ entries, onClose, onDelete }) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<PersonaCategory | 'all'>('all');
  const [filterGrade, setFilterGrade] = useState<QualityGrade | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'grade' | 'fastest' | 'category'>('newest');
  const [reportEntry, setReportEntry] = useState<AnyEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const a = entries.filter((e) => isAssembly(e) && (e as AssemblyEntry).quality_grade === 'A').length;
    const b = entries.filter((e) => isAssembly(e) && (e as AssemblyEntry).quality_grade === 'B').length;
    const c = entries.filter((e) => isAssembly(e) && (e as AssemblyEntry).quality_grade === 'C').length;
    const certified = entries.filter((e) => isAssembly(e) && (e as AssemblyEntry).certified).length;
    return { total: entries.length, a, b, c, certified };
  }, [entries]);

  // All unique tags across assembly entries
  const allTags = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => {
      if (isAssembly(e)) e.persona_tags?.forEach((t) => s.add(t));
    });
    return [...s].sort();
  }, [entries]);

  const [filterTag, setFilterTag] = useState('');

  // Filtered + sorted
  const visible = useMemo(() => {
    let out = [...entries];

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((e) => {
        const a = isAssembly(e);
        return (
          e.name.toLowerCase().includes(q) ||
          e.prompt.toLowerCase().includes(q) ||
          (a && (e as AssemblyEntry).use_case?.toLowerCase().includes(q)) ||
          (a && (e as AssemblyEntry).persona_tags?.some((t) => t.includes(q)))
        );
      });
    }

    if (filterCategory !== 'all') {
      out = out.filter((e) => isAssembly(e) && (e as AssemblyEntry).category === filterCategory);
    }

    if (filterGrade !== 'all') {
      out = out.filter((e) => isAssembly(e) && (e as AssemblyEntry).quality_grade === filterGrade);
    }

    if (filterTag) {
      out = out.filter((e) => isAssembly(e) && (e as AssemblyEntry).persona_tags?.includes(filterTag));
    }

    out.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'grade') {
        const gMap = { A: 0, B: 1, C: 2 };
        const ga = isAssembly(a) ? gMap[(a as AssemblyEntry).quality_grade] ?? 3 : 3;
        const gb = isAssembly(b) ? gMap[(b as AssemblyEntry).quality_grade] ?? 3 : 3;
        return ga - gb;
      }
      if (sortBy === 'fastest') {
        const la = isAssembly(a) ? (a as AssemblyEntry).total_latency_ms ?? 99999 : 99999;
        const lb = isAssembly(b) ? (b as AssemblyEntry).total_latency_ms ?? 99999 : 99999;
        return la - lb;
      }
      if (sortBy === 'category') {
        const ca = isAssembly(a) ? (a as AssemblyEntry).category ?? '' : '';
        const cb = isAssembly(b) ? (b as AssemblyEntry).category ?? '' : '';
        return ca.localeCompare(cb);
      }
      return 0;
    });

    return out;
  }, [entries, search, filterCategory, filterGrade, filterTag, sortBy]);

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `beryl-gallery-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-midnight-950/98 backdrop-blur-sm flex flex-col">
      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-midnight-800"
           style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.06), transparent)' }}>
        {/* Title plaque */}
        <div style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.2em', fontSize: 11, color: '#d4af37', fontWeight: 'bold' }}>
          ✦ PERSONA GALLERY ✦
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-1.5 ml-2">
          <Chip label="Total" val={stats.total} color="#888" />
          <Chip label="🏆 Certified" val={stats.certified} color="#00ff88" />
          <Chip label="A" val={stats.a} color="#00ff88" />
          <Chip label="B" val={stats.b} color="#d4af37" />
          <Chip label="C" val={stats.c} color="#ff6644" />
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-midnight-900 border border-midnight-700 rounded-full px-3 py-1.5 w-[220px]">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, use case, tags…"
            className="flex-1 bg-transparent text-[11px] text-slate-200 placeholder:text-slate-600 outline-none"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-midnight-900 border border-midnight-700 rounded-full px-3 py-1.5 text-[10px] text-slate-300 outline-none"
        >
          <option value="newest">Newest</option>
          <option value="grade">Best Grade</option>
          <option value="fastest">Fastest</option>
          <option value="category">Category</option>
        </select>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-colors ${
            showFilters ? 'border-oldgold-500 text-oldgold-400 bg-oldgold-500/10' : 'border-midnight-700 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Filter className="w-3 h-3" /> Filters
        </button>

        {/* Export */}
        <button
          onClick={exportAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-midnight-700 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Download className="w-3 h-3" /> Export
        </button>

        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors ml-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── FILTER BAR ── */}
      {showFilters && (
        <div className="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-midnight-800 bg-midnight-900/50 flex-wrap">
          {/* Category */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider">Category:</span>
            {(['all', 'news', 'finance', 'health', 'education', 'entertainment', 'tech', 'retail', 'lifestyle'] as const).map((c) => (
              <button key={c}
                onClick={() => setFilterCategory(c as any)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-colors ${
                  filterCategory === c ? 'bg-oldgold-500 text-midnight-950' : 'bg-midnight-800 text-slate-400 hover:text-slate-200'
                }`}>
                {c === 'all' ? 'All' : CATEGORY_LABELS[c]?.split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-midnight-700" />
          {/* Grade */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider">Grade:</span>
            {(['all', 'A', 'B', 'C'] as const).map((g) => (
              <button key={g}
                onClick={() => setFilterGrade(g)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-colors ${
                  filterGrade === g
                    ? g === 'all' ? 'bg-slate-600 text-white' : `text-midnight-950`
                    : 'bg-midnight-800 text-slate-400 hover:text-slate-200'
                }`}
                style={filterGrade === g && g !== 'all' ? { background: GRADE_STYLE[g as QualityGrade].color } : {}}>
                {g === 'all' ? 'All Grades' : GRADE_STYLE[g as QualityGrade].label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-midnight-700" />
          {/* Tag filter */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-slate-500" />
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="bg-midnight-800 border border-midnight-700 rounded px-2 py-0.5 text-[10px] text-slate-300 outline-none"
            >
              <option value="">All Tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={() => { setFilterCategory('all'); setFilterGrade('all'); setFilterTag(''); }}
            className="text-[9px] text-slate-600 hover:text-red-400 transition-colors ml-auto">
            Clear
          </button>
        </div>
      )}

      {/* ── GALLERY GRID ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No personas match your filters</p>
            <p className="text-[11px] mt-1">Run the assembly line to produce your talent roster</p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {visible.map((entry) => (
              <PersonaCard
                key={entry.id}
                entry={entry}
                onReport={() => setReportEntry(entry)}
                onDelete={() => onDelete(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── RESULT COUNT ── */}
      <div className="shrink-0 px-6 py-1.5 border-t border-midnight-800 flex items-center gap-2">
        <span className="text-[9px] text-slate-600">
          Showing {visible.length} of {entries.length} personas
        </span>
        {filterCategory !== 'all' || filterGrade !== 'all' || filterTag || search ? (
          <button onClick={() => { setSearch(''); setFilterCategory('all'); setFilterGrade('all'); setFilterTag(''); }}
            className="text-[9px] text-oldgold-500 hover:text-oldgold-400">
            Clear all filters
          </button>
        ) : null}
      </div>

      {/* Report overlay */}
      {reportEntry && (
        <div className="fixed inset-0 z-60 bg-midnight-950/90 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl h-full max-h-[80vh] relative">
            <ReportOverlay entry={reportEntry as any} onClose={() => setReportEntry(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Persona Card ──────────────────────────────────────────────────────────────
const PersonaCard: React.FC<{
  entry: AnyEntry;
  onReport: () => void;
  onDelete: () => void;
}> = ({ entry, onReport, onDelete }) => {
  const ae = isAssembly(entry) ? entry as AssemblyEntry : null;
  const u = UNIFORMS[(entry as any).face_uniform ?? 'gala'] ?? UNIFORMS.gala;
  const grade = ae?.quality_grade;
  const gs = grade ? GRADE_STYLE[grade] : null;
  const healthColor = entry.health.failed > 0 ? '#ff2244' : '#00ff88';
  const healthPct = entry.health.total > 0 ? Math.round((entry.health.done / entry.health.total) * 100) : 0;
  const date = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const [showTags, setShowTags] = useState(false);

  return (
    <div
      className="rounded-2xl border bg-midnight-900 overflow-hidden flex flex-col transition-all hover:border-oldgold-500/40 group"
      style={{
        borderColor: gs ? `${gs.color}33` : '#2a1e3f',
        boxShadow: ae?.certified ? `0 0 0 1px ${gs!.color}22, 0 4px 24px rgba(0,0,0,0.6)` : '0 4px 24px rgba(0,0,0,0.4)',
        background: gs ? gs.bg : undefined,
      }}
    >
      {/* Card header */}
      <div className="flex items-start gap-2 p-3 pb-2" style={{ background: `${u.dress}18` }}>
        <span className="text-2xl leading-none shrink-0 pt-0.5">{u.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-white leading-snug">{entry.name}</div>
          {ae && (
            <div className="text-[8.5px] text-slate-500 mt-0.5 truncate">{ae.use_case}</div>
          )}
        </div>
        {gs && (
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <span
              className="text-[8px] font-black px-1.5 py-0.5 rounded"
              style={{ color: gs.color, background: `${gs.color}18`, letterSpacing: '0.05em' }}
            >
              {grade}
            </span>
            {ae?.certified && (
              <Trophy className="w-3 h-3" style={{ color: gs.color }} />
            )}
          </div>
        )}
      </div>

      {/* Quality bar */}
      {ae && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-[3px] rounded-full bg-midnight-700">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${ae.quality_score}%`, background: gs?.color ?? '#888', boxShadow: `0 0 4px ${gs?.color ?? '#888'}66` }} />
            </div>
            <span className="text-[8px] font-bold shrink-0" style={{ color: gs?.color ?? '#888' }}>
              {ae.quality_score}/100
            </span>
          </div>
        </div>
      )}

      {/* Avatar output quote */}
      <div className="px-3 py-2">
        <p className="text-[10px] text-slate-400 italic leading-snug line-clamp-3">
          "{entry.avatar_output || 'No output recorded'}"
        </p>
      </div>

      {/* Pipeline health */}
      <div className="px-3 pb-1.5 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: healthColor, boxShadow: `0 0 4px ${healthColor}` }} />
          <span className="text-[8px] font-bold" style={{ color: healthColor }}>
            {entry.health.done}/{entry.health.total} dolls
          </span>
        </div>
        {ae?.total_latency_ms && (
          <span className="text-[8px] text-slate-600">{(ae.total_latency_ms / 1000).toFixed(1)}s</span>
        )}
        {ae?.version && ae.version > 1 && (
          <span className="text-[8px] text-oldgold-600 ml-auto">v{ae.version}</span>
        )}
        <span className="text-[8px] text-slate-600 ml-auto">{date}</span>
      </div>

      {/* Category + voice chips */}
      {ae && (
        <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
          {ae.category && (
            <span className="text-[7.5px] px-1.5 py-0.5 rounded-full bg-midnight-700 text-slate-400">
              {CATEGORY_LABELS[ae.category]?.split(' ').slice(0, 2).join(' ')}
            </span>
          )}
          {ae.voice_profile && (
            <span className="text-[7.5px] px-1.5 py-0.5 rounded-full bg-midnight-700 text-slate-400">
              {VOICE_PROFILE_LABELS[ae.voice_profile]?.split(' ').slice(0, 2).join(' ')}
            </span>
          )}
        </div>
      )}

      {/* Tags (expandable) */}
      {ae && ae.persona_tags && ae.persona_tags.length > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowTags((s) => !s)}
            className="flex items-center gap-1 text-[7.5px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            <Tag className="w-2.5 h-2.5" />
            {ae.persona_tags.length} tags {showTags ? '▴' : '▾'}
          </button>
          {showTags && (
            <div className="flex flex-wrap gap-1 mt-1">
              {ae.persona_tags.map((t) => (
                <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-midnight-800 text-slate-400 border border-midnight-700">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DNA */}
      {ae?.persona_dna && (
        <div className="px-3 pb-1">
          <span className="text-[7px] text-slate-700 font-mono">DNA:{ae.persona_dna.slice(0, 12)}…</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex border-t border-midnight-800">
        <button
          onClick={onReport}
          className="flex-1 flex items-center justify-center gap-1 py-2 text-[8px] font-bold text-slate-500 hover:text-oldgold-400 hover:bg-midnight-800/50 transition-colors"
        >
          <BookOpen className="w-3 h-3" /> REPORT
        </button>
        <div className="w-px bg-midnight-800" />
        <button
          onClick={onDelete}
          className="px-3 py-2 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// Small stat chip
const Chip: React.FC<{ label: string; val: number; color: string }> = ({ label, val, color }) => (
  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-midnight-900 border border-midnight-800">
    <span className="text-[8px] text-slate-500">{label}</span>
    <span className="text-[10px] font-bold" style={{ color }}>{val}</span>
  </div>
);

export default GalleryView;
