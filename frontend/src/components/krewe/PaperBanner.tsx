import React, { useEffect, useState } from 'react';
import { RefreshCw, Radio, ArrowRight } from 'lucide-react';
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
  matched_keyword?: string;
  upvotes?: number;
  trending?: boolean;
}

interface PaperBannerProps {
  onSelect: (paper: ArxivPaper) => void;
  onOpenResearch?: () => void;
}

// Real papers as offline baseline — banner is never empty
const SEED_PAPERS: ArxivPaper[] = [
  { arxiv_id:'2412.09262', title:'LatentSync: Audio Conditioned Latent Diffusion Models for Lip Sync', summary:'', published:'2024-12-12', authors:['Chunyu Li'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2412.09262', arxiv_url:'https://arxiv.org/abs/2412.09262', pdf_url:'https://arxiv.org/pdf/2412.09262' },
  { arxiv_id:'2403.03206', title:'Scaling Rectified Flow Transformers for High-Resolution Image Synthesis', summary:'', published:'2024-03-05', authors:['Patrick Esser'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2403.03206', arxiv_url:'https://arxiv.org/abs/2403.03206', pdf_url:'https://arxiv.org/pdf/2403.03206' },
  { arxiv_id:'2306.07691', title:'StyleTTS 2: Human-Level Text-to-Speech through Style Diffusion', summary:'', published:'2023-06-13', authors:['Yinghao Aaron Li'], categories:['cs.SD'], hf_url:'https://huggingface.co/papers/2306.07691', arxiv_url:'https://arxiv.org/abs/2306.07691', pdf_url:'https://arxiv.org/pdf/2306.07691' },
  { arxiv_id:'2401.07519', title:'InstantID: Zero-shot Identity-Preserving Generation in Seconds', summary:'', published:'2024-01-15', authors:['Qixun Wang'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2401.07519', arxiv_url:'https://arxiv.org/abs/2401.07519', pdf_url:'https://arxiv.org/pdf/2401.07519' },
  { arxiv_id:'2404.01280', title:'Hallo: Hierarchical Audio-Driven Visual Synthesis for Portrait Animation', summary:'', published:'2024-04-01', authors:['Mingwang Xu'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2404.01280', arxiv_url:'https://arxiv.org/abs/2404.01280', pdf_url:'https://arxiv.org/pdf/2404.01280' },
  { arxiv_id:'2410.19838', title:'MuseTalk: Real-Time High Quality Lip Sync with Latent Space Inpainting', summary:'', published:'2024-10-25', authors:['Yue Zhang'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2410.19838', arxiv_url:'https://arxiv.org/abs/2410.19838', pdf_url:'https://arxiv.org/pdf/2410.19838' },
  { arxiv_id:'2412.12342', title:'AniPortrait: Audio-Driven Synthesis of Photorealistic Portrait Animation', summary:'', published:'2024-12-16', authors:['Huawei Wei'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2412.12342', arxiv_url:'https://arxiv.org/abs/2412.12342', pdf_url:'https://arxiv.org/pdf/2412.12342' },
  { arxiv_id:'2406.17177', title:'MEMO: Memory-Guided Diffusion for Expressive Talking Video Generation', summary:'', published:'2024-06-25', authors:['Longtao Zheng'], categories:['cs.CV'], hf_url:'https://huggingface.co/papers/2406.17177', arxiv_url:'https://arxiv.org/abs/2406.17177', pdf_url:'https://arxiv.org/pdf/2406.17177' },
];

function tagFor(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  if (t.includes('lip sync') || t.includes('lip-sync')) return { label: 'LIP SYNC',      color: '#00ff88' };
  if (t.includes('talking'))                             return { label: 'TALKING HEAD',  color: '#00d4ff' };
  if (t.includes('diffusion'))                           return { label: 'DIFFUSION',     color: '#c084fc' };
  if (t.includes('portrait') || t.includes('face'))     return { label: 'PORTRAIT',      color: '#f472b6' };
  if (t.includes('audio') || t.includes('speech'))      return { label: 'AUDIO',         color: '#86efac' };
  if (t.includes('3d') || t.includes('nerf') || t.includes('gaussian')) return { label: '3D', color: '#60a5fa' };
  if (t.includes('animation') || t.includes('animate')) return { label: 'ANIMATION',     color: '#fbbf24' };
  if (t.includes('identity') || t.includes('instant'))  return { label: 'IDENTITY',      color: '#fb923c' };
  return { label: 'RESEARCH', color: '#94a3b8' };
}

const H = 46; // banner height — wider/taller, more prominent

const PaperBanner: React.FC<PaperBannerProps> = ({ onSelect, onOpenResearch }) => {
  const [breaking, setBreaking] = useState<ArxivPaper[]>([]);
  const [matched, setMatched] = useState<ArxivPaper[]>(SEED_PAPERS);
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(`${API}/krewe/papers/feed`, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const data = await res.json();
        const brk = (data?.breaking || []).map((p: ArxivPaper) => ({ ...p, trending: true }));
        const mtc = data?.matched || [];
        if (brk.length) setBreaking(brk);
        if (mtc.length >= 4) { setMatched(mtc); setLive(true); }
        else if (brk.length) setLive(true);
      }
    } catch { /* seed papers remain */ }
    finally { if (manual) setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  // Breaking news first, then keyword matches
  const ordered = [...breaking, ...matched];
  // Duplicate once for a seamless -50% translate loop
  const track = [...ordered, ...ordered];
  // Slow: ~9s per paper, generous minimum so it drifts gently
  const duration = Math.max(140, ordered.length * 9);

  return (
    <>
      <style>{`
        @keyframes beryl-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .beryl-scroll-inner { animation: beryl-scroll ${duration}s linear infinite; will-change: transform; }
        .beryl-scroll-wrap:hover .beryl-scroll-inner { animation-play-state: paused; }
      `}</style>

      <div
        className="shrink-0 flex items-stretch w-full overflow-hidden select-none"
        style={{ height: H, background: 'linear-gradient(180deg,#0b0816 0%,#070510 100%)', borderBottom: '1px solid rgba(212,175,55,0.22)' }}
      >
        {/* ── LEFT BADGE ──────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-2.5 px-4"
          style={{ borderRight: '1px solid rgba(212,175,55,0.2)', background: 'linear-gradient(90deg, rgba(212,175,55,0.14), transparent)', minWidth: 168 }}
        >
          <Radio className="w-3.5 h-3.5 text-oldgold-400 shrink-0" />
          <div className="flex flex-col leading-none">
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#d4af37', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Research Intel
            </span>
            <span className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: live ? '#00ff88' : '#d4af37', boxShadow: `0 0 5px ${live ? '#00ff88' : '#d4af37'}`, animation: 'pulse 1.8s ease-in-out infinite' }} />
              <span style={{ fontSize: 7.5, letterSpacing: '0.14em', color: live ? '#00ff88aa' : '#d4af37aa', fontWeight: 700 }}>
                {live ? 'LIVE · ARXIV' : 'OFFLINE DB'}
              </span>
            </span>
          </div>
          <button onClick={() => load(true)} disabled={refreshing} className="ml-1 text-slate-600 hover:text-oldgold-400 transition-colors disabled:opacity-30" title="Refresh feed">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── SCROLLER (edge-faded) ───────────────────────────────────── */}
        <div
          className="flex-1 overflow-hidden relative beryl-scroll-wrap"
          style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 60px, #000 calc(100% - 60px), transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0, #000 60px, #000 calc(100% - 60px), transparent 100%)' }}
        >
          <div className="beryl-scroll-inner flex items-center h-full" style={{ width: 'max-content' }}>
            {track.map((p, i) => {
              const isBreaking = !!p.trending;
              const tag = tagFor(p.title);
              const yr = p.published?.slice(0, 4) ?? '';
              const auth = p.authors?.[0]?.split(' ').slice(-1)[0] ?? '';
              const title = p.title.length > 78 ? p.title.slice(0, 78) + '…' : p.title;
              return (
                <button
                  key={`${p.arxiv_id}-${i}`}
                  onClick={() => onSelect(p)}
                  className="group flex items-center gap-3 h-full transition-colors hover:bg-white/[0.04] shrink-0"
                  style={{ padding: '0 22px', borderRight: '1px solid rgba(255,255,255,0.05)', background: isBreaking ? 'linear-gradient(180deg, rgba(239,68,68,0.07), transparent)' : undefined }}
                >
                  {isBreaking ? (
                    <span className="shrink-0 font-black tracking-widest flex items-center gap-1" style={{ fontSize: 8, color: '#ff5b5b', background: '#ff5b5b1a', border: '1px solid #ff5b5b55', padding: '3px 7px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ animation: 'pulse 1.4s ease-in-out infinite' }} />
                      BREAKING
                    </span>
                  ) : (
                    <span className="shrink-0 font-black tracking-widest" style={{ fontSize: 8, color: tag.color, background: `${tag.color}18`, border: `1px solid ${tag.color}38`, padding: '3px 7px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                      {tag.label}
                    </span>
                  )}
                  <span className={`text-[13px] font-medium transition-colors whitespace-nowrap ${isBreaking ? 'text-slate-100 group-hover:text-white' : 'text-slate-200 group-hover:text-white'}`}>
                    {title}
                  </span>
                  {isBreaking && typeof p.upvotes === 'number' && p.upvotes > 0 && (
                    <span className="text-[10px] font-bold whitespace-nowrap shrink-0 flex items-center gap-0.5" style={{ color: '#ff8a8a' }}>
                      ▲ {p.upvotes}
                    </span>
                  )}
                  {!isBreaking && (auth || yr) && (
                    <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                      {auth}{auth && yr ? ' · ' : ''}{yr}
                    </span>
                  )}
                  <span className="shrink-0 text-base" style={{ color: isBreaking ? 'rgba(239,68,68,0.4)' : 'rgba(212,175,55,0.35)', lineHeight: 1 }}>◆</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── VIEW ALL ────────────────────────────────────────────────── */}
        {onOpenResearch && (
          <button
            onClick={onOpenResearch}
            className="shrink-0 flex items-center gap-1.5 px-4 transition-colors hover:bg-oldgold-500/10 group"
            style={{ borderLeft: '1px solid rgba(212,175,55,0.18)' }}
            title="Open Research page"
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-oldgold-400/70 group-hover:text-oldgold-400 whitespace-nowrap">
              View All
            </span>
            <ArrowRight className="w-3 h-3 text-oldgold-400/70 group-hover:text-oldgold-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        )}
      </div>
    </>
  );
};

export default PaperBanner;
