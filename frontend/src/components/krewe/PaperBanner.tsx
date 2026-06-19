import React, { useEffect, useState } from 'react';
import { RefreshCw, Radio } from 'lucide-react';
import { API } from '../../api';

export interface ArxivPaper {
  arxiv_id: string;
  title: string;
  summary: string;
  published: string;
  authors: string[];
  categories: string[];
  hf_url: string;
  arxiv_url: string;
  pdf_url: string;
}

interface PaperBannerProps {
  onSelect: (paper: ArxivPaper) => void;
}

function paperTag(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  if (t.includes('talking head') || t.includes('neural talking')) return { label: 'TALKING HEAD', color: '#00d4ff' };
  if (t.includes('lip sync') || t.includes('lip-sync'))             return { label: 'LIP SYNC',    color: '#00ff88' };
  if (t.includes('diffusion'))                                       return { label: 'DIFFUSION',   color: '#b24fff' };
  if (t.includes('streaming') || t.includes('real-time'))           return { label: 'REAL-TIME',   color: '#ff9500' };
  if (t.includes('3d') || t.includes('nerf') || t.includes('gaussian')) return { label: '3D AVATAR', color: '#4f9fff' };
  if (t.includes('portrait') || t.includes('face anim'))            return { label: 'PORTRAIT',    color: '#ff6fd0' };
  if (t.includes('avatar'))                                          return { label: 'AVATAR',      color: '#d4af37' };
  if (t.includes('digital human'))                                   return { label: 'DIGITAL HUMAN', color: '#d4af37' };
  if (t.includes('audio'))                                           return { label: 'AUDIO DRIVEN', color: '#aaffcc' };
  return { label: 'RESEARCH', color: '#778899' };
}

const TICKER_HEIGHT = 34;

const PaperBanner: React.FC<PaperBannerProps> = ({ onSelect }) => {
  const [papers, setPapers] = useState<ArxivPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchPapers = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API}/krewe/papers`);
      const data = res.ok ? await res.json() : null;
      if (data?.papers?.length) {
        setPapers(data.papers);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => { fetchPapers(); }, []);

  // Duplicate for seamless loop — need at least 2 copies
  const track = papers.length > 0 ? [...papers, ...papers, ...papers] : [];
  const speed = Math.max(80, papers.length * 12); // seconds for one full pass

  return (
    <>
      <style>{`
        @keyframes beryl-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .beryl-ticker-inner {
          animation: beryl-ticker ${speed}s linear infinite;
          will-change: transform;
        }
        .beryl-ticker-wrap:hover .beryl-ticker-inner {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="shrink-0 flex items-stretch w-full overflow-hidden select-none"
        style={{
          height: TICKER_HEIGHT,
          background: '#08060f',
          borderBottom: '1px solid rgba(212,175,55,0.2)',
        }}
      >
        {/* ── LIVE badge ────────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-2 px-3"
          style={{
            borderRight: '1px solid rgba(212,175,55,0.25)',
            background: 'linear-gradient(90deg, rgba(212,175,55,0.12) 0%, transparent 100%)',
            minWidth: 136,
          }}
        >
          <Radio className="w-3 h-3 text-oldgold-400 shrink-0" />
          <span
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 9,
              letterSpacing: '0.22em',
              color: '#b8860b',
              fontWeight: 900,
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
            }}
          >
            RESEARCH INTEL
          </span>
          <button
            onClick={() => fetchPapers(true)}
            disabled={loading || retrying}
            className="ml-1 text-slate-700 hover:text-oldgold-400 transition-colors disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${retrying ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── Scrolling ticker ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative beryl-ticker-wrap">

          {loading && (
            <div className="flex items-center gap-2 h-full px-5">
              <span className="w-1.5 h-1.5 rounded-full bg-oldgold-400 animate-pulse" />
              <span className="text-[11px] text-slate-500 tracking-wide">
                Scanning ArXiv for avatar research…
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-3 h-full px-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[11px] text-slate-500">ArXiv unreachable.</span>
              <button
                onClick={() => fetchPapers(true)}
                className="text-[11px] text-oldgold-400 hover:text-oldgold-300 underline underline-offset-2 transition-colors"
              >
                {retrying ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

          {!loading && !error && papers.length > 0 && (
            <div
              className="beryl-ticker-inner flex items-center h-full"
              style={{ width: 'max-content' }}
            >
              {track.map((paper, i) => {
                const tag = paperTag(paper.title);
                const yr  = paper.published?.slice(0, 4) ?? '';
                const title = paper.title.length > 68
                  ? paper.title.slice(0, 68) + '…'
                  : paper.title;
                const author = paper.authors?.[0]?.split(' ').slice(-1)[0] ?? '';

                return (
                  <button
                    key={`${paper.arxiv_id}-${i}`}
                    onClick={() => onSelect(paper)}
                    className="flex items-center h-full group shrink-0 transition-colors hover:bg-white/[0.03]"
                    style={{ padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {/* tag pill */}
                    <span
                      className="shrink-0 font-black mr-3"
                      style={{
                        fontSize: 8,
                        letterSpacing: '0.1em',
                        color: tag.color,
                        background: `${tag.color}18`,
                        border: `1px solid ${tag.color}40`,
                        padding: '2px 6px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tag.label}
                    </span>

                    {/* title */}
                    <span
                      className="text-slate-200 group-hover:text-white transition-colors whitespace-nowrap font-medium"
                      style={{ fontSize: 12 }}
                    >
                      {title}
                    </span>

                    {/* author + year */}
                    {(author || yr) && (
                      <span
                        className="ml-3 shrink-0 whitespace-nowrap"
                        style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}
                      >
                        {author && `${author}`}{author && yr && ' · '}{yr}
                      </span>
                    )}

                    {/* bullet separator */}
                    <span
                      className="ml-4 shrink-0"
                      style={{ fontSize: 16, color: 'rgba(212,175,55,0.3)', lineHeight: 1 }}
                    >
                      ◆
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Paper count chip ──────────────────────────────────────────── */}
        {!loading && !error && papers.length > 0 && (
          <div
            className="shrink-0 flex items-center px-3"
            style={{ borderLeft: '1px solid rgba(212,175,55,0.15)' }}
          >
            <span
              className="font-mono"
              style={{ fontSize: 9, color: 'rgba(212,175,55,0.5)', letterSpacing: '0.08em' }}
            >
              {papers.length} papers
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default PaperBanner;
