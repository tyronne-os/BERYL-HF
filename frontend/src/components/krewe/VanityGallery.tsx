import React, { useState } from 'react';
import { Star, BookOpen, Trash2, X, Loader2 } from 'lucide-react';
import { UNIFORMS } from './DollNode';
import type { UniformKey } from './DollNode';

export interface PortfolioEntry {
  id: string;
  created_at: string;
  name: string;
  prompt: string;
  squad: Array<{
    name: string;
    role: string;
    uniform: string;
    model: string;
    status: string;
    latencyMs?: number;
  }>;
  avatar_output: string;
  face_uniform: UniformKey;
  health: { total: number; done: number; failed: number };
  report?: string;
}

interface VanityGalleryProps {
  entries: PortfolioEntry[];
  saving: boolean;
  onDelete: (id: string) => void;
  onViewReport: (entry: PortfolioEntry) => void;
}

const VanityGallery: React.FC<VanityGalleryProps> = ({ entries, saving, onDelete, onViewReport }) => {
  if (entries.length === 0 && !saving) return null;

  return (
    <div className="shrink-0 border-t border-midnight-800 bg-midnight-900/80" style={{ maxHeight: 168 }}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-midnight-800">
        <Star className="w-3 h-3 text-oldgold-400" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Portfolio</span>
        <span className="text-[8px] text-slate-600">· {entries.length} saved</span>
      </div>

      {/* Horizontal card strip */}
      <div className="flex gap-2 overflow-x-auto p-2 pb-2.5" style={{ scrollbarWidth: 'thin' }}>
        {/* Saving placeholder */}
        {saving && (
          <div className="shrink-0 w-[150px] rounded-xl border border-oldgold-500/30 bg-midnight-800 flex items-center justify-center"
               style={{ height: 108 }}>
            <div className="text-center">
              <Loader2 className="w-4 h-4 text-oldgold-400 animate-spin mx-auto mb-1" />
              <span className="text-[8px] text-oldgold-400">Saving…</span>
            </div>
          </div>
        )}

        {entries.map((entry) => {
          const u = UNIFORMS[entry.face_uniform] ?? UNIFORMS.gala;
          const healthColor = entry.health.failed > 0 ? '#ff2244' : '#00ff88';
          const healthPct = entry.health.total > 0
            ? Math.round((entry.health.done / entry.health.total) * 100)
            : 0;
          const date = new Date(entry.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric',
          });

          return (
            <div
              key={entry.id}
              className="shrink-0 w-[150px] rounded-xl border border-midnight-700 bg-midnight-800 overflow-hidden flex flex-col"
              style={{ height: 108 }}
            >
              {/* Card header row */}
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 shrink-0"
                style={{ background: `${u.dress}1a` }}
              >
                <span className="text-base leading-none">{u.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-bold text-white truncate">{entry.name}</div>
                  <div className="text-[7.5px] text-slate-500">{date}</div>
                </div>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="text-slate-700 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Prompt + health */}
              <div className="flex-1 px-2 py-1 min-h-0">
                <p className="text-[8.5px] text-slate-500 leading-snug line-clamp-2">
                  {entry.prompt}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-[3px] rounded-full bg-midnight-700">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${healthPct}%`,
                        background: healthColor,
                        boxShadow: `0 0 4px ${healthColor}88`,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <span className="text-[7.5px] font-bold shrink-0" style={{ color: healthColor }}>
                    {entry.health.done}/{entry.health.total}
                  </span>
                </div>
                {/* Doll icon strip */}
                <div className="flex gap-0.5 mt-1 flex-wrap">
                  {entry.squad.slice(0, 7).map((doll, i) => {
                    const du = UNIFORMS[doll.uniform as UniformKey] ?? UNIFORMS.gala;
                    return (
                      <span key={i} className="text-[10px] leading-none" title={doll.name}>
                        {du.icon}
                      </span>
                    );
                  })}
                  {entry.squad.length > 7 && (
                    <span className="text-[7px] text-slate-600 self-center">+{entry.squad.length - 7}</span>
                  )}
                </div>
              </div>

              {/* Report button */}
              <button
                onClick={() => onViewReport(entry)}
                className="shrink-0 flex items-center justify-center gap-1 py-1 border-t border-midnight-700 text-[7.5px] font-bold text-slate-500 hover:text-oldgold-400 hover:bg-midnight-700/50 transition-colors"
              >
                <BookOpen className="w-2.5 h-2.5" />
                VIEW REPORT
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Full-panel Report Overlay (rendered by KrewePage over the right rail) ──────
export const ReportOverlay: React.FC<{
  entry: PortfolioEntry;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  const u = UNIFORMS[entry.face_uniform] ?? UNIFORMS.gala;
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-midnight-950/97 backdrop-blur-sm overflow-hidden"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(212,175,55,0.2)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-midnight-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">{u.icon}</span>
          <div>
            <div className="text-[11px] font-bold text-white">{entry.name}</div>
            <div className="text-[8px] text-oldgold-400 uppercase tracking-wider">Squad Report</div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Report content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Output line */}
        {entry.avatar_output && (
          <div className="mb-4 px-3 py-2 rounded-lg border border-oldgold-500/20 bg-oldgold-500/5">
            <div className="text-[8px] text-oldgold-400 font-bold uppercase tracking-wider mb-1">Final Output</div>
            <p className="text-[11px] text-slate-200 italic">"{entry.avatar_output}"</p>
          </div>
        )}

        {/* Prompt */}
        <div className="mb-4">
          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-1">Goal Prompt</div>
          <p className="text-[11px] text-slate-400">{entry.prompt}</p>
        </div>

        {/* Report markdown */}
        {entry.report ? (
          <div>
            <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-2">Reporting Agent</div>
            <pre className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-midnight-900 rounded-lg p-3 border border-midnight-700">
              {entry.report}
            </pre>
          </div>
        ) : (
          <div className="text-[10px] text-slate-600 italic">No report generated for this run.</div>
        )}

        {/* Squad breakdown */}
        <div className="mt-4">
          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-2">Squad Breakdown</div>
          <div className="space-y-1">
            {entry.squad.map((doll, i) => {
              const du = UNIFORMS[doll.uniform as UniformKey] ?? UNIFORMS.gala;
              const statusColor = doll.status === 'done' ? '#00ff88' : doll.status === 'error' ? '#ff2244' : '#888';
              return (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span>{du.icon}</span>
                  <span className="text-slate-300 font-medium w-[90px] truncate">{doll.name}</span>
                  <span className="text-slate-500 flex-1 truncate font-mono">{doll.model}</span>
                  <span style={{ color: statusColor, fontSize: 8 }}>
                    {doll.status === 'done' ? '✓' : doll.status === 'error' ? '✗' : '–'}
                    {doll.latencyMs ? ` ${doll.latencyMs}ms` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VanityGallery;
