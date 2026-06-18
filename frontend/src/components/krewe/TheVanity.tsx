import React, { useEffect, useRef, useState } from 'react';
import { Radio, Activity, Volume2, Send, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { UNIFORMS } from './DollNode';
import type { UniformKey } from './DollNode';
import { API } from '../../api';

export interface TheVanityProps {
  faceUniform: UniformKey;
  speaking: boolean;
  line: string;
  status: 'idle' | 'building' | 'live';
  fps: number;
  avatarContext: string;
  onSpeakLine: (line: string) => void;
}

interface VanityMsg {
  role: 'user' | 'avatar';
  text: string;
}

// Baroque corner ornament (fleur-de-lis inspired)
const CornerFleur = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const scaleX = pos.endsWith('r') ? -1 : 1;
  const scaleY = pos.startsWith('b') ? -1 : 1;
  const style: React.CSSProperties = {
    position: 'absolute',
    width: 24, height: 24,
    top: pos.startsWith('t') ? -1 : undefined,
    bottom: pos.startsWith('b') ? -1 : undefined,
    left: pos.endsWith('l') ? -1 : undefined,
    right: pos.endsWith('r') ? -1 : undefined,
    zIndex: 3,
    pointerEvents: 'none',
  };
  return (
    <svg style={style} viewBox="0 0 24 24">
      <g transform={`translate(12,12) scale(${scaleX},${scaleY}) translate(-12,-12)`}>
        <circle cx="5" cy="5" r="3" fill="#f5d76e" />
        <path d="M5 8 L5 16 Q5 18 7 18 L15 18" stroke="#f5d76e" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M3 5 L1 5 Q0 5 0 6 L0 14" stroke="#f5d76e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55" />
        <circle cx="7.5" cy="15.5" r="1.5" fill="#f5d76e" opacity="0.7" />
      </g>
    </svg>
  );
};

const TheVanity: React.FC<TheVanityProps> = ({
  faceUniform, speaking, line, status, fps, avatarContext, onSpeakLine,
}) => {
  const u = UNIFORMS[faceUniform] ?? UNIFORMS.gala;
  const [mouthOpen, setMouthOpen] = useState(0);
  const raf = useRef<number>(0);
  const [chatInput, setChatInput] = useState('');
  const [vChat, setVChat] = useState<VanityMsg[]>([]);
  const [chatting, setChatting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Viseme animation
  useEffect(() => {
    if (!speaking) { setMouthOpen(0); return; }
    let t = 0;
    const tick = () => {
      t += 0.35;
      setMouthOpen(Math.abs(Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.4));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [speaking]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [vChat]);

  const mouthH = 3 + mouthOpen * 14;

  const sendToAvatar = async () => {
    const text = chatInput.trim();
    if (!text || chatting) return;
    setVChat((c) => [...c, { role: 'user', text }]);
    setChatInput('');
    setChatting(true);
    try {
      const res = await fetch(`${API}/krewe/vanity-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: avatarContext, uniform: faceUniform }),
      });
      const data = res.ok ? await res.json() : null;
      const reply = data?.reply || 'Darling, the signal is a bit weak. Try me again?';
      setVChat((c) => [...c, { role: 'avatar', text: reply }]);
      onSpeakLine(reply);
    } catch {
      setVChat((c) => [...c, { role: 'avatar', text: 'Connection lost for a moment — say that again?' }]);
    }
    setChatting(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-midnight-950 overflow-hidden">
      {/* ── STATUS BAR ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-midnight-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-oldgold-400" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Preview</span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'live' && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-600/90 text-[7px] font-black text-white">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          )}
          {status === 'building' && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-oldgold-500/90 text-[7px] font-black text-midnight-950">
              <Activity className="w-2 h-2 animate-pulse" /> BUILD
            </span>
          )}
          {fps > 0 && <span className="text-[8px] text-slate-600 font-mono">{fps.toFixed(0)}fps</span>}
          <button
            onClick={() => setShowChat((s) => !s)}
            title="Talk to the avatar"
            className={`p-1 rounded transition-colors ${showChat ? 'text-oldgold-400 bg-midnight-800' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── STAGE AREA ── */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-3 relative overflow-hidden">
        {/* ambient glow */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at 50% 35%, ${u.accent}22, transparent 70%)` }} />

        {/* ── ORNATE PICTURE FRAME ── */}
        <div
          className="relative w-full"
          style={{
            maxWidth: 262,
            padding: 10,
            background: 'linear-gradient(135deg, #f5d76e 0%, #9a6a08 18%, #e8c040 36%, #7a5000 54%, #e0b830 72%, #f5d76e 100%)',
            boxShadow: [
              '0 0 0 1px #2a1800',
              '0 0 0 2px rgba(245,215,110,0.3)',
              '0 20px 60px rgba(0,0,0,0.9)',
              '0 0 80px rgba(212,175,55,0.1)',
            ].join(', '),
          }}
        >
          {/* Title plaque — overlaps top edge of the gold frame */}
          <div
            className="absolute -top-[14px] left-1/2 -translate-x-1/2 z-10 whitespace-nowrap"
            style={{
              padding: '2px 14px',
              background: 'linear-gradient(90deg, #c8960c, #f5d76e, #d4af37, #f5d76e, #c8960c)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            <span style={{ fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.32em', color: '#150900' }}>
              ✦ THE VANITY ✦
            </span>
          </div>

          {/* Inner dark canvas */}
          <div
            className="relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #080312 0%, #0d0618 55%, #060210 100%)',
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.85)',
            }}
          >
            {/* Corner baroque ornaments */}
            <CornerFleur pos="tl" />
            <CornerFleur pos="tr" />
            <CornerFleur pos="bl" />
            <CornerFleur pos="br" />

            {/* Subtle inner border */}
            <div className="absolute inset-[7px] pointer-events-none"
                 style={{ border: '1px solid rgba(212,175,55,0.12)' }} />

            {/* ── AVATAR FACE ── */}
            <div className="flex items-center justify-center pt-6 pb-2 px-3">
              <svg
                viewBox="0 0 240 280"
                className="w-[88%]"
                style={{
                  filter: speaking
                    ? `drop-shadow(0 0 20px ${u.accent}88) drop-shadow(0 0 40px ${u.accent}44)`
                    : 'drop-shadow(0 6px 16px rgba(0,0,0,0.7))',
                  transition: 'filter 0.3s ease',
                }}
              >
                {/* Hair back */}
                <ellipse cx="120" cy="120" rx="78" ry="92" fill={u.hair} />
                {/* Neck + shoulders */}
                <rect x="100" y="180" width="40" height="40" fill={u.skin} />
                <path d="M60 280 Q120 215 180 280 Z" fill={u.dress} />
                {/* Face */}
                <ellipse cx="120" cy="130" rx="62" ry="70" fill={u.skin} />
                {/* Hair front */}
                <path d="M58 130 Q60 50 120 48 Q180 50 182 130 Q168 92 120 92 Q72 92 58 130 Z" fill={u.hair} />
                {/* Eyes */}
                <ellipse cx="98" cy="125" rx="9" ry={speaking ? 6 : 7} fill="#fff" />
                <ellipse cx="142" cy="125" rx="9" ry={speaking ? 6 : 7} fill="#fff" />
                <circle cx="99" cy="126" r="4.5" fill="#2b1a0e" />
                <circle cx="143" cy="126" r="4.5" fill="#2b1a0e" />
                <circle cx="100.5" cy="124.5" r="1.5" fill="#fff" />
                <circle cx="144.5" cy="124.5" r="1.5" fill="#fff" />
                {/* Brows */}
                <path d="M88 110 Q98 105 110 109" stroke={u.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
                <path d="M130 109 Q142 105 152 110" stroke={u.hair} strokeWidth="3" fill="none" strokeLinecap="round" />
                {/* Nose */}
                <path d="M120 130 L116 152 Q120 156 124 152" stroke="#00000022" strokeWidth="2" fill="none" />
                {/* Mouth (animated viseme) */}
                <ellipse cx="120" cy="166" rx="16" ry={mouthH} fill="#7a1f2b" />
                {mouthOpen > 0.4 && <ellipse cx="120" cy={162} rx="11" ry="2.5" fill="#fff" />}
                <path
                  d={`M104 166 Q120 ${166 - mouthH - 3} 136 166 Q120 ${166 + mouthH + 3} 104 166 Z`}
                  fill="none" stroke="#5c2230" strokeWidth="2"
                />
                {/* Crown */}
                {u.crown === 'crown' && (
                  <path d="M88 64 L94 44 L108 58 L120 36 L132 58 L146 44 L152 64 Z"
                        fill="#f5d76e" stroke="#b8860b" strokeWidth="1.5" />
                )}
                {/* Speaking aura pulse */}
                {speaking && (
                  <>
                    <ellipse cx="120" cy="140" rx="74" ry="86" fill="none"
                             stroke={u.accent} strokeWidth="1.5" opacity="0.25">
                      <animateTransform attributeName="transform" type="scale"
                        values="1;1.015;1" dur="1.4s" repeatCount="indefinite" additive="sum"
                        calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
                    </ellipse>
                    <ellipse cx="120" cy="140" rx="82" ry="94" fill="none"
                             stroke={u.accent} strokeWidth="0.8" opacity="0.12">
                      <animateTransform attributeName="transform" type="scale"
                        values="1;1.02;1" dur="1.8s" repeatCount="indefinite" additive="sum"
                        calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
                    </ellipse>
                  </>
                )}
              </svg>
            </div>

            {/* Caption line inside the frame */}
            <div className="px-4 pb-5 min-h-[46px]">
              <div className="flex items-start gap-1.5">
                <Volume2 className={`w-3 h-3 mt-0.5 shrink-0 transition-colors ${speaking ? 'text-oldgold-400' : 'text-slate-700'}`} />
                <p className={`text-[11px] leading-snug italic transition-colors ${speaking ? 'text-slate-100' : 'text-slate-600'}`}>
                  {line || <span className="not-italic text-slate-700">— awaiting the squad —</span>}
                </p>
              </div>
            </div>

            {/* Idle overlay */}
            {status === 'idle' && vChat.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-midnight-950/55 backdrop-blur-[2px]">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">Stage is dark</p>
                  <p className="text-[9px] text-slate-700 mt-1">
                    Hit <span className="text-oldgold-400 font-bold">SQUAD UP</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom ornament strip on the gold frame */}
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.35))' }} />
            <span style={{ fontSize: '7px', color: '#2a1400', fontWeight: 'bold', letterSpacing: '0.15em' }}>✦ ✦ ✦</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), transparent)' }} />
          </div>
        </div>

        {/* ── VANITY CHAT — below the frame ── */}
        <div className={`w-full mt-3 transition-all duration-200 ${showChat ? 'opacity-100 max-h-[200px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}
             style={{ maxWidth: 262 }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '8px', color: '#b8860b', letterSpacing: '0.2em' }}>
              ✦ SPEAK TO HER ✦
            </span>
          </div>

          {/* Chat history */}
          {vChat.length > 0 && (
            <div ref={chatRef} className="max-h-[90px] overflow-y-auto mb-2 space-y-1.5 pr-1">
              {vChat.slice(-6).map((m, i) => (
                <div key={i} className={`text-[10px] px-2 py-1.5 rounded-lg leading-snug ${
                  m.role === 'user'
                    ? 'bg-oldgold-500/15 text-oldgold-200 text-right ml-6 border border-oldgold-500/20'
                    : 'bg-midnight-800 text-slate-300 mr-6 border border-midnight-700'
                }`}>
                  {m.role === 'avatar' && <span className="text-oldgold-400 mr-1">✦</span>}
                  {m.text}
                </div>
              ))}
              {chatting && (
                <div className="text-[9px] text-oldgold-400 animate-pulse pl-1">✦ thinking…</div>
              )}
            </div>
          )}

          <div className="flex gap-1.5">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendToAvatar(); }}
              placeholder="Say something to her…"
              className="flex-1 bg-midnight-900 border border-oldgold-500/25 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-700 focus:border-oldgold-500 outline-none"
            />
            <button
              onClick={sendToAvatar}
              disabled={chatting || !chatInput.trim()}
              className="p-2 rounded-lg bg-oldgold-500 text-midnight-950 hover:bg-oldgold-400 disabled:opacity-40 transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TheVanity;
