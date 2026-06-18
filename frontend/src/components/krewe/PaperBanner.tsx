import React, { useEffect, useRef, useState } from 'react';
import { BookMarked, Loader2, RefreshCw, Wifi } from 'lucide-react';
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

// Derive a colour tag from the paper title
function paperTag(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  if (t.includes('talking head') || t.includes('neural talking'))
    return { label: 'Talking Head', color: '#00d4ff' };
  if (t.includes('diffusion'))
    return { label: 'Diffusion', color: '#b24fff' };
  if (t.includes('lip sync') || t.includes('lip-sync'))
    return { label: 'Lip Sync', color: '#00ff88' };
  if (t.includes('streaming') || t.includes('real-time') || t.includes('realtime'))
    return { label: 'Streaming', color: '#ff9500' };
  if (t.includes('3d') || t.includes('nerf') || t.includes('gaussian'))
    return { label: '3D Avatar', color: '#4f9fff' };
  if (t.includes('portrait') || t.includes('face anim'))
    return { label: 'Portrait', color: '#ff6fd0' };
  if (t.includes('avatar'))
    return { label: 'Avatar', color: '#d4af37' };
  if (t.includes('digital human'))
    return { label: 'Digital Human', color: '#d4af37' };
  return { label: 'Research', color: '#888' };
}

const PaperBanner: React.FC<PaperBannerProps> = ({ onSelect }) => {
  const [papers, setPapers] = useState<ArxivPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPapers = async () => {
    setLoading(true);
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
    }
    setLoading(false);
  };

  useEffect(() => { fetchPapers(); }, []);

  // Duplicate papers for seamless loop
  const track = papers.length > 0 ? [...papers, ...papers] : [];

  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes krewe-banner-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .krewe-banner-track:hover .krewe-banner-inner {
          animation-play-state: paused;
        }
        .krewe-banner-inner {
          animation: krewe-banner-scroll ${Math.max(60, papers.length * 8)}s linear infinite;
        }
      `}</style>

      <div className="shrink-0 flex items-center border-b border-midnight-800 overflow-hidden"
           style={{ height: 42, background: 'linear-gradient(90deg, #0d0614 0%, #0a0412 100%)',
                    boxShadow: '0 1px 0 rgba(212,175,55,0.15)' }}>

        {/* Fixed label */}
        <div className="shrink-0 flex items-center gap-2 px-3 border-r border-midnight-800"
             style={{ height: '100%', background: 'linear-gradient(90deg, rgba(212,175,55,0.06), transparent)' }}>
          <BookMarked className="w-3 h-3 text-oldgold-400" />
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 8, letterSpacing: '0.2em',
                         color: '#b8860b', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            ✦ RESEARCH INTEL ✦
          </span>
          <button onClick={fetchPapers} disabled={loading}
            className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40 ml-1">
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Scrolling track */}
        <div className="flex-1 overflow-hidden krewe-banner-track relative" style={{ height: '100%' }}>
          {loading ? (
            <div className="flex items-center gap-2 h-full px-4">
              <Loader2 className="w-3 h-3 text-oldgold-400 animate-spin" />
              <span className="text-[10px] text-slate-600">Fetching latest avatar research from ArXiv…</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 h-full px-4">
              <Wifi className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-slate-600">Could not reach ArXiv — </span>
              <button onClick={fetchPapers} className="text-[10px] text-oldgold-400 hover:underline">retry</button>
            </div>
          ) : (
            <div className="krewe-banner-inner flex items-center gap-0 h-full"
                 style={{ width: 'max-content' }}>
              {track.map((paper, i) => {
                const tag = paperTag(paper.title);
                const date = paper.published?.slice(0, 10) || '';
                const shortTitle = paper.title.length > 52 ? paper.title.slice(0, 52) + '…' : paper.title;
                const firstAuthor = paper.authors?.[0]?.split(' ').slice(-1)[0] ?? '';

                return (
                  <button
                    key={`${paper.arxiv_id}-${i}`}
                    onClick={() => onSelect(paper)}
                    className="flex items-center gap-2 px-4 h-full border-r border-midnight-800/60 hover:bg-midnight-800/60 transition-colors group shrink-0"
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Tag pill */}
                    <span className="shrink-0 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ color: tag.color, background: `${tag.color}1a`,
                                   border: `1px solid ${tag.color}33`, letterSpacing: '0.05em' }}>
                      {tag.label}
                    </span>

                    {/* Title */}
                    <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors whitespace-nowrap"
                          style={{ maxWidth: 360 }}>
                      {shortTitle}
                    </span>

                    {/* Author + date */}
                    <span className="text-[9px] text-slate-600 whitespace-nowrap shrink-0">
                      {firstAuthor && `${firstAuthor} · `}{date}
                    </span>

                    {/* Separator dot */}
                    <span className="text-slate-700 shrink-0 text-[10px]">·</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Paper count */}
        {!loading && !error && papers.length > 0 && (
          <div className="shrink-0 px-3 border-l border-midnight-800 flex items-center"
               style={{ height: '100%' }}>
            <span className="text-[8px] text-slate-600">{papers.length} papers</span>
          </div>
        )}
      </div>
    </>
  );
};

export default PaperBanner;
