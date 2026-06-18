import React, { useState } from 'react';
import { X, ExternalLink, FileText, Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ArxivPaper } from './PaperBanner';
import { API } from '../../api';

interface PaperOverlayProps {
  paper: ArxivPaper;
  onClose: () => void;
  onSquadIt: (dolls: string[], edges: [string, string][], goal: string, note: string) => void;
}

type SquadStatus = 'idle' | 'loading' | 'success' | 'error';

function tagColor(t: string) {
  const lc = t.toLowerCase();
  if (lc.includes('talking head') || lc.includes('neural talking')) return '#00d4ff';
  if (lc.includes('diffusion')) return '#b24fff';
  if (lc.includes('lip sync') || lc.includes('lip-sync')) return '#00ff88';
  if (lc.includes('streaming') || lc.includes('real-time')) return '#ff9500';
  if (lc.includes('3d') || lc.includes('nerf') || lc.includes('gaussian')) return '#4f9fff';
  if (lc.includes('portrait')) return '#ff6fd0';
  if (lc.includes('avatar')) return '#d4af37';
  if (lc.includes('digital human')) return '#d4af37';
  return '#888';
}

const PaperOverlay: React.FC<PaperOverlayProps> = ({ paper, onClose, onSquadIt }) => {
  const [squadStatus, setSquadStatus] = useState<SquadStatus>('idle');
  const [squadNote, setSquadNote] = useState('');
  const [iframeError, setIframeError] = useState(false);
  const color = tagColor(paper.title);

  const handleSquadIt = async () => {
    setSquadStatus('loading');
    setSquadNote('');
    try {
      const res = await fetch(`${API}/krewe/papers/squad-it`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arxiv_id: paper.arxiv_id,
          title: paper.title,
          summary: paper.summary,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const dolls: string[] = data.dolls ?? ['courier', 'cosmos', 'mechanic', 'streamer'];
      const edges: [string, string][] = data.edges ?? [];
      const goal: string = data.goal ?? `Implement ${paper.title}`;
      const note: string = data.note ?? '';

      setSquadNote(note);
      setSquadStatus('success');

      // Give user a moment to see success before closing
      setTimeout(() => {
        onSquadIt(dolls, edges, goal, note);
        onClose();
      }, 1800);
    } catch {
      setSquadStatus('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 'min(1100px, 96vw)',
          height: 'min(780px, 92vh)',
          background: '#090614',
          border: '1px solid rgba(212,175,55,0.2)',
          boxShadow: '0 0 0 1px #1a0f00, 0 40px 120px rgba(0,0,0,0.9)',
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-midnight-800"
          style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.06), transparent)' }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-oldgold-400" />
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.25em',
                           color: '#b8860b', fontWeight: 'bold' }}>
              ✦ RESEARCH INTELLIGENCE ✦
            </span>
            <span
              className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
            >
              {paper.arxiv_id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-midnight-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body — two-panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — metadata */}
          <div className="w-80 shrink-0 flex flex-col border-r border-midnight-800 overflow-y-auto">
            <div className="p-5 flex flex-col gap-4">
              {/* Title */}
              <div>
                <p className="text-[9px] text-oldgold-600 uppercase tracking-widest mb-1">Title</p>
                <h2 className="text-sm font-semibold text-white leading-snug">{paper.title}</h2>
              </div>

              {/* Authors */}
              <div>
                <p className="text-[9px] text-oldgold-600 uppercase tracking-widest mb-1">Authors</p>
                <div className="flex flex-wrap gap-1">
                  {paper.authors.map((a, i) => (
                    <span key={i} className="text-[10px] text-slate-400 bg-midnight-800 rounded px-1.5 py-0.5">{a}</span>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <p className="text-[9px] text-oldgold-600 uppercase tracking-widest mb-1">Published</p>
                <p className="text-xs text-slate-300">{paper.published}</p>
              </div>

              {/* Abstract */}
              <div>
                <p className="text-[9px] text-oldgold-600 uppercase tracking-widest mb-1">Abstract</p>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-12">{paper.summary}</p>
              </div>

              {/* External links */}
              <div className="flex flex-col gap-2">
                <a
                  href={paper.hf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[10px] text-oldgold-400 hover:text-oldgold-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  HuggingFace Papers
                </a>
                <a
                  href={paper.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  Download PDF (ArXiv)
                </a>
                <a
                  href={paper.arxiv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  ArXiv Abstract
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT — iframe */}
          <div className="flex-1 relative bg-midnight-950 flex flex-col">
            {iframeError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <p className="text-sm text-slate-500">Preview blocked by browser security policy.</p>
                <p className="text-xs text-slate-600">Open the links on the left to view the full paper.</p>
              </div>
            ) : (
              <>
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-midnight-800 bg-midnight-900">
                  <div className="w-2 h-2 rounded-full bg-oldgold-400/40" />
                  <span className="text-[9px] text-slate-600 truncate">{paper.hf_url}</span>
                </div>
                <iframe
                  src={paper.hf_url}
                  title={paper.title}
                  className="flex-1 w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  onError={() => setIframeError(true)}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer — SQUAD IT */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-midnight-800"
          style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.04), transparent)' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {squadStatus === 'success' && (
              <div className="flex items-center gap-2 text-[11px] text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{squadNote || 'Squad applied to canvas — hit SQUAD UP!'}</span>
              </div>
            )}
            {squadStatus === 'error' && (
              <div className="flex items-center gap-2 text-[11px] text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Could not generate squad — check backend connection.</span>
              </div>
            )}
            {squadStatus === 'loading' && (
              <div className="flex items-center gap-2 text-[11px] text-oldgold-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Analyzing paper and designing KREWE squad…</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSquadIt}
            disabled={squadStatus === 'loading' || squadStatus === 'success'}
            className="shrink-0 flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ml-4"
            style={{
              background: squadStatus === 'success'
                ? 'linear-gradient(135deg, #1a5e2a, #2d8a3e)'
                : 'linear-gradient(135deg, #c8960c, #f5d76e, #9a6a08)',
              color: squadStatus === 'success' ? '#7fffa0' : '#150900',
              boxShadow: squadStatus === 'success'
                ? '0 0 20px rgba(0,255,80,0.3)'
                : '0 0 20px rgba(212,175,55,0.4)',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.08em',
            }}
          >
            {squadStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : squadStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {squadStatus === 'success' ? 'SQUAD APPLIED ✦' : squadStatus === 'loading' ? 'ANALYZING…' : '✦ SQUAD IT'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperOverlay;
