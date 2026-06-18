import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';

// ─────────────────────────────────────────────────────────────────────────────
// DOLL NODE — a KREWE workflow node rendered as a stylized fashion doll.
// Anatomy → LLM pipeline mapping:
//   Head  → system instructions / persona  (click to configure)
//   Torso → core model / execution engine  (glows while running)
//   Arms  → I/O ports (left = input target, right = output source)
//   Hands → sequential linkers (the connection handles at the wrists)
//   Purse → tool / function-calling module  (click to configure, flashes on fire)
// ─────────────────────────────────────────────────────────────────────────────

export type UniformKey =
  | 'gala' | 'mechanic' | 'executive' | 'vocalist'
  | 'doctor' | 'artist' | 'courier' | 'athlete';

export interface DollData {
  name: string;
  role: string;
  uniform: UniformKey;
  model: string;
  systemPrompt: string;
  temperature: number;
  tools: string[];
  isGpu?: boolean;
  status?: 'idle' | 'running' | 'done' | 'error';
  purseActive?: boolean;
  lastOutput?: string;
  onOpen?: (id: string, section: 'head' | 'purse' | 'torso') => void;
  [key: string]: unknown;
}

export type DollNodeType = Node<DollData, 'doll'>;

export const UNIFORMS: Record<UniformKey, {
  dress: string; accent: string; skin: string; hair: string;
  label: string; icon: string; crown: 'crown' | 'cap' | 'beret' | 'helmet' | 'none';
}> = {
  gala:      { dress: '#c9a86a', accent: '#1a1f4d', skin: '#6b4226', hair: '#2b1d12', label: 'Gala Gown',  icon: '👑', crown: 'crown' },
  mechanic:  { dress: '#3b4a5c', accent: '#f59e0b', skin: '#8d5524', hair: '#1a1208', label: 'Coveralls',  icon: '🔧', crown: 'cap' },
  executive: { dress: '#1e293b', accent: '#94a3b8', skin: '#5c3317', hair: '#0f0a06', label: 'Suit',       icon: '💼', crown: 'none' },
  vocalist:  { dress: '#7c2d52', accent: '#f9a8d4', skin: '#7a4a2b', hair: '#241008', label: 'Stage',      icon: '🎤', crown: 'none' },
  doctor:    { dress: '#0d9488', accent: '#e2e8f0', skin: '#c68642', hair: '#3a2a18', label: 'Scrubs',     icon: '⚕️', crown: 'none' },
  artist:    { dress: '#cbd5e1', accent: '#dc2626', skin: '#8d5524', hair: '#7a3b18', label: 'Atelier',    icon: '🎨', crown: 'beret' },
  courier:   { dress: '#2563eb', accent: '#1e3a8a', skin: '#6b4226', hair: '#1a1208', label: 'Postal',     icon: '📮', crown: 'cap' },
  athlete:   { dress: '#1e3a5f', accent: '#22d3ee', skin: '#4a2c14', hair: '#0a0604', label: 'Track',      icon: '🏃', crown: 'none' },
};

const Headwear: React.FC<{ kind: string; accent: string }> = ({ kind, accent }) => {
  switch (kind) {
    case 'crown':
      return <path d="M58 22 L62 12 L70 19 L80 8 L90 19 L98 12 L102 22 Z" fill="#f5d76e" stroke="#b8860b" strokeWidth="1" />;
    case 'cap':
      return <path d="M56 26 Q80 6 104 26 L104 30 L56 30 Z" fill={accent} />;
    case 'beret':
      return <ellipse cx="80" cy="20" rx="26" ry="11" fill={accent} />;
    case 'helmet':
      return <path d="M55 28 Q80 4 105 28 Z" fill={accent} />;
    default:
      return null;
  }
};

function DollNodeInner({ id, data, selected }: NodeProps<DollNodeType>) {
  const u = UNIFORMS[data.uniform] ?? UNIFORMS.executive;
  const running = data.status === 'running';
  const done = data.status === 'done';
  const error = data.status === 'error';
  const isGown = data.uniform === 'gala' || data.uniform === 'vocalist';

  const torsoGlow = running
    ? 'drop-shadow(0 0 14px rgba(212,175,55,0.9))'
    : done
    ? 'drop-shadow(0 0 10px rgba(16,185,129,0.7))'
    : error
    ? 'drop-shadow(0 0 10px rgba(239,68,68,0.8))'
    : selected
    ? 'drop-shadow(0 0 8px rgba(212,175,55,0.5))'
    : 'none';

  const open = (section: 'head' | 'purse' | 'torso') => (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onOpen?.(id, section);
  };

  return (
    <div className="relative" style={{ width: 160 }}>
      {/* LEFT ARM → input port (target handle = left hand) */}
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        style={{
          top: 132, left: -6, width: 16, height: 16, borderRadius: 9999,
          background: 'radial-gradient(circle at 35% 30%, #fde68a, #b8860b)',
          border: '2px solid #0d0614', boxShadow: '0 0 8px rgba(212,175,55,0.7)',
        }}
      />
      {/* RIGHT ARM → output port (source handle = right hand) */}
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        style={{
          top: 132, right: -6, width: 16, height: 16, borderRadius: 9999,
          background: 'radial-gradient(circle at 35% 30%, #fde68a, #b8860b)',
          border: '2px solid #0d0614', boxShadow: '0 0 8px rgba(212,175,55,0.7)',
        }}
      />

      <div
        className={`rounded-2xl border transition-all ${
          selected ? 'border-oldgold-400' : 'border-midnight-700'
        } bg-gradient-to-b from-midnight-900 to-midnight-950 px-2 pt-2 pb-2.5`}
        style={{ filter: torsoGlow }}
      >
        {/* GPU badge for the Mechanic */}
        {data.isGpu && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-[8px] font-black text-midnight-950 tracking-wider shadow-lg">
            HF · GPU
          </div>
        )}

        <svg viewBox="0 0 160 210" className="w-full" style={{ overflow: 'visible' }}>
          {/* status aura behind torso */}
          {running && (
            <ellipse cx="80" cy="120" rx="46" ry="58" fill="rgba(212,175,55,0.12)">
              <animate attributeName="ry" values="56;62;56" dur="1.4s" repeatCount="indefinite" />
            </ellipse>
          )}

          {/* hair behind head */}
          <ellipse cx="80" cy="48" rx="26" ry="30" fill={u.hair} />

          {/* HEAD — click to open persona / system prompt */}
          <g onClick={open('head')} style={{ cursor: 'pointer' }} className="nodrag">
            <circle cx="80" cy="46" r="20" fill={u.skin} stroke={selected ? '#f5d76e' : '#00000033'} strokeWidth="1.5" />
            {/* simple face */}
            <circle cx="73" cy="44" r="2" fill="#1a1208" />
            <circle cx="87" cy="44" r="2" fill="#1a1208" />
            <path d="M74 54 Q80 58 86 54" stroke="#1a1208" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {/* hair front */}
            <path d="M58 44 Q60 22 80 22 Q100 22 102 44 Q96 34 80 34 Q64 34 58 44 Z" fill={u.hair} />
            <Headwear kind={u.crown} accent={u.accent} />
          </g>

          {/* neck */}
          <rect x="74" y="64" width="12" height="10" fill={u.skin} />

          {/* TORSO — the model / execution engine; click for engine config */}
          <g onClick={open('torso')} style={{ cursor: 'pointer' }} className="nodrag">
            {isGown ? (
              <path d="M62 74 L98 74 L116 188 L44 188 Z" fill={u.dress} stroke="#00000033" />
            ) : (
              <path d="M60 74 L100 74 L104 170 L56 170 Z" fill={u.dress} stroke="#00000033" />
            )}
            {/* sash with role */}
            <path d="M64 76 L96 76 L108 110 L76 110 Z" fill="#f5f0e6" opacity="0.92" />
            <text x="86" y="98" fontSize="9" fontWeight="700" fill={u.accent}
                  transform="rotate(46 86 98)" textAnchor="middle" letterSpacing="0.5">
              {data.name.slice(0, 9).toUpperCase()}
            </text>
            {/* role icon on torso */}
            <text x="80" y={isGown ? 150 : 140} fontSize="20" textAnchor="middle">{u.icon}</text>
          </g>

          {/* ARMS reaching to the hand handles */}
          <path d="M62 80 Q30 96 12 130" stroke={u.skin} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M98 80 Q130 96 148 130" stroke={u.skin} strokeWidth="8" fill="none" strokeLinecap="round" />

          {/* PURSE — tool / function-calling module; flashes when firing */}
          <g onClick={open('purse')} style={{ cursor: 'pointer' }} className="nodrag">
            <path d="M96 78 Q120 112 110 150" stroke={u.accent} strokeWidth="2" fill="none" opacity="0.7" />
            <rect x="100" y="146" width="26" height="20" rx="4"
                  fill={data.purseActive ? '#f5d76e' : u.accent}
                  stroke="#0d0614" strokeWidth="1.5">
              {data.purseActive && (
                <animate attributeName="opacity" values="1;0.4;1" dur="0.5s" repeatCount="indefinite" />
              )}
            </rect>
            <path d="M105 146 Q113 138 121 146" stroke="#0d0614" strokeWidth="1.5" fill="none" />
            {data.tools.length > 0 && (
              <text x="113" y="160" fontSize="9" fontWeight="700" textAnchor="middle" fill="#0d0614">
                {data.tools.length}
              </text>
            )}
          </g>
        </svg>

        {/* Engine / model label */}
        <div className="mt-1 text-center">
          <div className="text-[10px] font-bold text-white leading-tight truncate">{data.name}</div>
          <div className="text-[8px] text-oldgold-400/80 uppercase tracking-wider">{data.role}</div>
          <div className="mt-1 inline-flex max-w-full items-center gap-1 px-1.5 py-0.5 rounded bg-midnight-800/80 border border-midnight-700">
            <span className={`w-1.5 h-1.5 rounded-full ${
              running ? 'bg-oldgold-400 animate-pulse' : done ? 'bg-emerald-400' : error ? 'bg-red-500' : 'bg-slate-600'
            }`} />
            <span className="text-[8px] text-slate-300 truncate max-w-[110px]">{data.model}</span>
          </div>
        </div>
      </div>

      {/* hint chips for hands */}
      <div className="absolute -left-1 top-[150px] text-[7px] text-oldgold-400/60 font-bold">IN</div>
      <div className="absolute -right-2 top-[150px] text-[7px] text-oldgold-400/60 font-bold">OUT</div>
    </div>
  );
}

export default memo(DollNodeInner);
