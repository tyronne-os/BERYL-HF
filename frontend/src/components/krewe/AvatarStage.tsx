import React, { useEffect, useRef, useState } from 'react';
import { Radio, Activity, Volume2, Maximize2 } from 'lucide-react';
import { UNIFORMS } from './DollNode';
import type { UniformKey } from './DollNode';

interface AvatarStageProps {
  faceUniform: UniformKey;     // which doll's face is "on camera"
  speaking: boolean;
  line: string;                // current spoken line
  status: 'idle' | 'building' | 'live';
  fps: number;
}

// Live talking-head previewer. Renders a large stylized face that "speaks" (mouth
// + aura animate) while the squad streams. This is the SQUAD UP output surface.
const AvatarStage: React.FC<AvatarStageProps> = ({ faceUniform, speaking, line, status, fps }) => {
  const u = UNIFORMS[faceUniform] ?? UNIFORMS.gala;
  const [mouthOpen, setMouthOpen] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!speaking) { setMouthOpen(0); return; }
    let t = 0;
    const tick = () => {
      t += 0.35;
      // pseudo-random viseme: layered sines → natural mouth motion
      const v = Math.abs(Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.4);
      setMouthOpen(v);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [speaking]);

  const mouthH = 3 + mouthOpen * 14;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-midnight-950 to-black">
      {/* top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-midnight-800 shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-oldgold-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Live Avatar Stage</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'live' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-[8px] font-black text-white tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          )}
          {status === 'building' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-oldgold-500/90 text-[8px] font-black text-midnight-950 tracking-wider">
              <Activity className="w-2.5 h-2.5 animate-pulse" /> RENDERING
            </span>
          )}
          <span className="text-[8px] text-slate-500 font-mono">{fps.toFixed(0)} fps</span>
        </div>
      </div>

      {/* stage */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* backdrop glow */}
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: `radial-gradient(circle at 50% 40%, ${u.accent}33, transparent 60%)` }}
        />
        {speaking && (
          <div className="absolute inset-0 opacity-30 animate-pulse"
               style={{ background: `radial-gradient(circle at 50% 45%, ${u.dress}44, transparent 55%)` }} />
        )}

        {/* the face */}
        <svg viewBox="0 0 240 280" className="relative w-[78%] max-w-[340px]" style={{ filter: speaking ? 'drop-shadow(0 0 22px rgba(212,175,55,0.45))' : 'none' }}>
          {/* hair back */}
          <ellipse cx="120" cy="120" rx="78" ry="92" fill={u.hair} />
          {/* neck + shoulders */}
          <rect x="100" y="180" width="40" height="40" fill={u.skin} />
          <path d="M60 280 Q120 215 180 280 Z" fill={u.dress} />
          {/* face */}
          <ellipse cx="120" cy="130" rx="62" ry="70" fill={u.skin} />
          {/* hair front frame */}
          <path d="M58 130 Q60 50 120 48 Q180 50 182 130 Q168 92 120 92 Q72 92 58 130 Z" fill={u.hair} />
          {/* eyes */}
          <g>
            <ellipse cx="98" cy="125" rx="9" ry={speaking ? 6 : 7} fill="#fff" />
            <ellipse cx="142" cy="125" rx="9" ry={speaking ? 6 : 7} fill="#fff" />
            <circle cx="99" cy="126" r="4.5" fill="#2b1a0e" />
            <circle cx="143" cy="126" r="4.5" fill="#2b1a0e" />
            <circle cx="100.5" cy="124.5" r="1.5" fill="#fff" />
            <circle cx="144.5" cy="124.5" r="1.5" fill="#fff" />
          </g>
          {/* brows */}
          <path d="M88 110 Q98 105 110 109" stroke={u.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M130 109 Q142 105 152 110" stroke={u.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* nose */}
          <path d="M120 130 L116 152 Q120 156 124 152" stroke="#00000022" strokeWidth="2" fill="none" />
          {/* MOUTH — animated viseme */}
          <ellipse cx="120" cy="166" rx="16" ry={mouthH} fill="#7a1f2b" />
          {mouthOpen > 0.4 && <ellipse cx="120" cy={162} rx="11" ry="2.5" fill="#fff" />}
          {/* lips outline */}
          <path d={`M104 166 Q120 ${166 - mouthH - 3} 136 166 Q120 ${166 + mouthH + 3} 104 166 Z`}
                fill="none" stroke="#5c2230" strokeWidth="2" />
          {/* crown for gala */}
          {u.crown === 'crown' && (
            <path d="M88 64 L94 44 L108 58 L120 36 L132 58 L146 44 L152 64 Z" fill="#f5d76e" stroke="#b8860b" strokeWidth="1.5" />
          )}
        </svg>

        {/* idle veil */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight-950/60 backdrop-blur-[1px]">
            <div className="text-center px-4">
              <Maximize2 className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-[11px] text-slate-500 font-medium">Avatar idle</p>
              <p className="text-[9px] text-slate-600 mt-1">Connect a squad and hit <span className="text-oldgold-400 font-bold">SQUAD UP</span></p>
            </div>
          </div>
        )}
      </div>

      {/* caption / spoken line */}
      <div className="shrink-0 border-t border-midnight-800 px-3 py-2.5 min-h-[56px]">
        <div className="flex items-center gap-1.5 mb-1">
          <Volume2 className={`w-3 h-3 ${speaking ? 'text-oldgold-400' : 'text-slate-600'}`} />
          <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Speaking</span>
        </div>
        <p className={`text-[12px] leading-snug ${speaking ? 'text-white' : 'text-slate-500'}`}>
          {line || <span className="italic text-slate-600">— waiting for the squad —</span>}
        </p>
      </div>
    </div>
  );
};

export default AvatarStage;
