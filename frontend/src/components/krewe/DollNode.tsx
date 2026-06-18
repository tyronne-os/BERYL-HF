import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { AlertCircle, Clock, ChevronDown, Check, Zap } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// DOLL NODE v2 — Real-time connectivity indicators + model-swap dropdown
//
// Anatomy → LLM pipeline:
//   Head  → system instructions / persona
//   Torso → core model / execution engine  (glows while running)
//   Arms  → I/O ports (left=input, right=output)
//   Hands → sequential linkers (the connection handles at the wrists)
//   Purse → tool / function-calling module
//
// Status glow:
//   idle    → no glow
//   running → pulsing gold aura
//   done    → NEON GREEN outline + shadow
//   error   → NEON RED outline + shadow
// ─────────────────────────────────────────────────────────────────────────────

export type UniformKey =
  | 'gala' | 'mechanic' | 'executive' | 'vocalist'
  | 'doctor' | 'artist' | 'courier' | 'athlete'
  | 'librarian' | 'scout' | 'archivist' | 'conductor';

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
  latencyMs?: number;
  errorMsg?: string;
  outputSnippet?: string;
  onOpen?: (id: string, section: 'head' | 'purse' | 'torso') => void;
  onSwapModel?: (id: string, model: string) => void;
  [key: string]: unknown;
}

export type DollNodeType = Node<DollData, 'doll'>;

// ── Uniform palette ──────────────────────────────────────────────────────────
export const UNIFORMS: Record<UniformKey, {
  dress: string; accent: string; skin: string; hair: string;
  label: string; icon: string; crown: 'crown' | 'cap' | 'beret' | 'helmet' | 'none';
}> = {
  gala:      { dress: '#c9a86a', accent: '#1a1f4d', skin: '#6b4226', hair: '#2b1d12', label: 'Gala Gown',  icon: '👑', crown: 'crown'   },
  mechanic:  { dress: '#3b4a5c', accent: '#f59e0b', skin: '#8d5524', hair: '#1a1208', label: 'Coveralls',  icon: '🔧', crown: 'cap'     },
  executive: { dress: '#1e293b', accent: '#94a3b8', skin: '#5c3317', hair: '#0f0a06', label: 'Suit',       icon: '💼', crown: 'none'    },
  vocalist:  { dress: '#7c2d52', accent: '#f9a8d4', skin: '#7a4a2b', hair: '#241008', label: 'Stage',      icon: '🎤', crown: 'none'    },
  doctor:    { dress: '#0d9488', accent: '#e2e8f0', skin: '#c68642', hair: '#3a2a18', label: 'Scrubs',     icon: '⚕️', crown: 'none'    },
  artist:    { dress: '#cbd5e1', accent: '#dc2626', skin: '#8d5524', hair: '#7a3b18', label: 'Atelier',    icon: '🎨', crown: 'beret'   },
  courier:   { dress: '#2563eb', accent: '#1e3a8a', skin: '#6b4226', hair: '#1a1208', label: 'Postal',     icon: '📮', crown: 'cap'     },
  athlete:   { dress: '#1e3a5f', accent: '#22d3ee', skin: '#4a2c14', hair: '#0a0604', label: 'Track',      icon: '🏃', crown: 'none'    },
  librarian: { dress: '#1e3a6e', accent: '#60a5fa', skin: '#7a4a2b', hair: '#1a0a08', label: 'Academic',   icon: '🔗', crown: 'none'    },
  scout:     { dress: '#2d5a27', accent: '#86efac', skin: '#c68642', hair: '#2a1a08', label: 'Scout',      icon: '🤖', crown: 'cap'     },
  archivist: { dress: '#4a1d6e', accent: '#c084fc', skin: '#8d5524', hair: '#2a1808', label: 'Archive',    icon: '🧠', crown: 'none'    },
  conductor: { dress: '#2d1b00', accent: '#fbbf24', skin: '#6b4226', hair: '#0a0604', label: 'Baton',      icon: '🎯', crown: 'beret'   },
};

// ── Role-appropriate model registry ─────────────────────────────────────────
type ModelEntry = { id: string; label: string; type: 'hf' | 'ollama' | 'engine' };

const ROLE_MODELS: Record<string, ModelEntry[]> = {
  'Brain':       [
    { id: 'MiniMaxAI/MiniMax-M3',            label: 'MiniMax M3 427B',     type: 'hf'     },
    { id: 'Qwen/Qwen2.5-72B-Instruct',       label: 'Qwen 2.5 72B',        type: 'hf'     },
    { id: 'ollama/llama3.2',                  label: 'Llama 3.2 (local)',    type: 'ollama' },
    { id: 'ollama/qwen2.5',                   label: 'Qwen 2.5 (local)',     type: 'ollama' },
    { id: 'ollama/deepseek-r1',               label: 'DeepSeek R1 (local)',  type: 'ollama' },
  ],
  'Director':    [
    { id: 'MiniMaxAI/MiniMax-M3',            label: 'MiniMax M3 427B',     type: 'hf'     },
    { id: 'ollama/llama3.2',                  label: 'Llama 3.2 (local)',    type: 'ollama' },
    { id: 'Qwen/Qwen2.5-72B-Instruct',       label: 'Qwen 2.5 72B',        type: 'hf'     },
    { id: 'ollama/mistral',                   label: 'Mistral (local)',       type: 'ollama' },
  ],
  'QA / Safety': [
    { id: 'MiniMaxAI/MiniMax-M3',            label: 'MiniMax M3 427B',     type: 'hf'     },
    { id: 'ollama/llama3.2',                  label: 'Llama 3.2 (local)',    type: 'ollama' },
    { id: 'microsoft/Phi-3-mini-4k-instruct', label: 'Phi-3 Mini',           type: 'hf'     },
    { id: 'ollama/gemma2',                    label: 'Gemma 2 (local)',       type: 'ollama' },
  ],
  'Voice / TTS': [
    { id: 'ove-voice',                        label: 'O.V.E Voice',          type: 'engine' },
    { id: 'facebook/mms-tts-eng',            label: 'Meta MMS-TTS',         type: 'hf'     },
    { id: 'suno/bark-small',                  label: 'Bark Small',           type: 'hf'     },
    { id: 'hexgrad/Kokoro-82M',              label: 'Kokoro 82M',           type: 'hf'     },
  ],
  'GPU Engine':  [
    { id: 'hf-gpu',                           label: 'HF GPU (auto)',        type: 'engine' },
    { id: 'AIBRUH/latentsync',               label: 'LatentSync (L4)',      type: 'engine' },
    { id: 'KwaiVGI/CHAMP',                  label: 'CHAMP (avatar)',        type: 'hf'     },
  ],
  'Face / Visual':[
    { id: 'comfyui',                          label: 'ComfyUI (local)',       type: 'engine' },
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base', type: 'hf'     },
    { id: 'black-forest-labs/FLUX.1-schnell',label: 'FLUX.1 Schnell',       type: 'hf'     },
  ],
  'Trigger / I/O':[
    { id: 'trigger',                          label: 'Manual Trigger',       type: 'engine' },
    { id: 'webhook',                          label: 'Webhook',              type: 'engine' },
    { id: 'cron',                             label: 'Cron Schedule',        type: 'engine' },
  ],
  'Stream / Output':[
    { id: 'edge-stream',                      label: 'Edge Stream (MJPEG)',  type: 'engine' },
    { id: 'webrtc',                           label: 'WebRTC P2P',           type: 'engine' },
  ],
  'Chain Executor':[
    { id: 'langchain-hf',                     label: 'LangChain + HF',       type: 'engine' },
    { id: 'langchain-openai',                 label: 'LangChain + OpenAI',   type: 'engine' },
    { id: 'MiniMaxAI/MiniMax-M3',            label: 'MiniMax M3 direct',    type: 'hf'     },
  ],
  'Micro Agent':  [
    { id: 'smolagents',                       label: 'SmolAgents (HF)',      type: 'engine' },
    { id: 'ollama/mistral',                   label: 'Mistral (local)',       type: 'ollama' },
    { id: 'HuggingFaceH4/zephyr-7b-beta',   label: 'Zephyr 7B',            type: 'hf'     },
  ],
  'Context Store':[
    { id: 'faiss',                            label: 'FAISS (local vector)',  type: 'engine' },
    { id: 'chromadb',                         label: 'ChromaDB',             type: 'engine' },
    { id: 'ollama/nomic-embed-text',         label: 'Nomic Embed (local)',   type: 'ollama' },
  ],
  'Flow Router':  [
    { id: 'logic',                            label: 'Logic Router',         type: 'engine' },
    { id: 'MiniMaxAI/MiniMax-M3',            label: 'AI Router (M3)',        type: 'hf'     },
  ],
};

const TYPE_BADGE: Record<'hf' | 'ollama' | 'engine', { bg: string; text: string; label: string }> = {
  hf:     { bg: 'bg-orange-500/20', text: 'text-orange-300', label: 'HF' },
  ollama: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: '🦙' },
  engine: { bg: 'bg-amber-500/20',   text: 'text-amber-300',   label: '⚡' },
};

// ── Status box-shadow glow ───────────────────────────────────────────────────
const STATUS_SHADOW: Record<string, string> = {
  idle:    '0 4px 20px rgba(0,0,0,0.5)',
  running: '0 0 0 2px #d4af37, 0 0 24px rgba(212,175,55,0.7), 0 0 48px rgba(212,175,55,0.3)',
  done:    '0 0 0 2px #00ff88, 0 0 20px rgba(0,255,136,0.7), 0 0 48px rgba(0,255,136,0.3)',
  error:   '0 0 0 2px #ff2244, 0 0 20px rgba(255,34,68,0.7), 0 0 48px rgba(255,34,68,0.3)',
};

const STATUS_BORDER: Record<string, string> = {
  idle:    'border-midnight-700',
  running: 'border-oldgold-400',
  done:    'border-[#00ff88]',
  error:   'border-[#ff2244]',
};

// ── Headwear sub-component ───────────────────────────────────────────────────
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

// ── Main DollNode component ──────────────────────────────────────────────────
function DollNodeInner({ id, data, selected }: NodeProps<DollNodeType>) {
  const u = UNIFORMS[data.uniform] ?? UNIFORMS.executive;
  const status = data.status ?? 'idle';
  const running = status === 'running';
  const done = status === 'done';
  const error = status === 'error';
  const isGown = data.uniform === 'gala' || data.uniform === 'vocalist';

  const [showModels, setShowModels] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // close dropdown on outside click
  useEffect(() => {
    if (!showModels) return;
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setShowModels(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModels]);

  const models = ROLE_MODELS[data.role] ?? ROLE_MODELS['Brain'];

  const open = (section: 'head' | 'purse' | 'torso') => (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onOpen?.(id, section);
  };

  const swapModel = (modelId: string) => {
    data.onSwapModel?.(id, modelId);
    setShowModels(false);
  };

  // torso glow filter for the SVG only
  const svgFilter = running
    ? 'drop-shadow(0 0 12px rgba(212,175,55,0.8))'
    : done
    ? 'drop-shadow(0 0 8px rgba(0,255,136,0.6))'
    : error
    ? 'drop-shadow(0 0 8px rgba(255,34,68,0.6))'
    : 'none';

  return (
    <div className="relative" style={{ width: 168 }}>
      {/* LEFT HAND = input port */}
      <Handle id="in" type="target" position={Position.Left} style={{
        top: 136, left: -7, width: 17, height: 17, borderRadius: 9999,
        background: error ? 'radial-gradient(circle, #ff2244, #7a0010)' : done ? 'radial-gradient(circle, #00ff88, #006633)' : 'radial-gradient(circle at 35% 30%, #fde68a, #b8860b)',
        border: '2px solid #0d0614',
        boxShadow: error ? '0 0 10px rgba(255,34,68,0.8)' : done ? '0 0 10px rgba(0,255,136,0.8)' : '0 0 8px rgba(212,175,55,0.7)',
      }} />
      {/* RIGHT HAND = output port */}
      <Handle id="out" type="source" position={Position.Right} style={{
        top: 136, right: -7, width: 17, height: 17, borderRadius: 9999,
        background: error ? 'radial-gradient(circle, #ff2244, #7a0010)' : done ? 'radial-gradient(circle, #00ff88, #006633)' : 'radial-gradient(circle at 35% 30%, #fde68a, #b8860b)',
        border: '2px solid #0d0614',
        boxShadow: error ? '0 0 10px rgba(255,34,68,0.8)' : done ? '0 0 10px rgba(0,255,136,0.8)' : '0 0 8px rgba(212,175,55,0.7)',
      }} />

      <div
        className={`rounded-2xl border transition-all duration-300 ${STATUS_BORDER[status]}`}
        style={{
          background: 'linear-gradient(160deg, #13091e 0%, #0d0614 100%)',
          boxShadow: STATUS_SHADOW[status],
        }}
      >
        {/* GPU badge */}
        {data.isGpu && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-[8px] font-black text-midnight-950 tracking-wider shadow-lg">
            HF · GPU
          </div>
        )}

        {/* status indicator dot top-right */}
        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          running ? 'bg-oldgold-400 animate-pulse' :
          done    ? 'bg-[#00ff88]' :
          error   ? 'bg-[#ff2244]' :
          'bg-slate-700'
        }`} style={done || error ? { boxShadow: `0 0 8px ${done ? '#00ff88' : '#ff2244'}` } : {}} />

        {/* running pulse ring */}
        {running && (
          <div className="absolute inset-0 rounded-2xl animate-ping"
               style={{ background: 'rgba(212,175,55,0.08)', animationDuration: '1.4s' }} />
        )}

        {/* DOLL SVG */}
        <div className="px-2 pt-2">
          <svg viewBox="0 0 160 210" className="w-full" style={{ overflow: 'visible', filter: svgFilter }}>
            {/* hair back */}
            <ellipse cx="80" cy="48" rx="26" ry="30" fill={u.hair} />

            {/* HEAD — click to configure persona */}
            <g onClick={open('head')} style={{ cursor: 'pointer' }} className="nodrag">
              <circle cx="80" cy="46" r="20" fill={u.skin} stroke={selected ? '#f5d76e' : 'transparent'} strokeWidth="1.5" />
              <circle cx="73" cy="44" r="2" fill="#1a1208" />
              <circle cx="87" cy="44" r="2" fill="#1a1208" />
              <path d="M74 54 Q80 58 86 54" stroke="#1a1208" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M58 44 Q60 22 80 22 Q100 22 102 44 Q96 34 80 34 Q64 34 58 44 Z" fill={u.hair} />
              <Headwear kind={u.crown} accent={u.accent} />
            </g>

            {/* neck */}
            <rect x="74" y="64" width="12" height="10" fill={u.skin} />

            {/* TORSO — the model/engine */}
            <g onClick={open('torso')} style={{ cursor: 'pointer' }} className="nodrag">
              {isGown ? (
                <path d="M62 74 L98 74 L116 188 L44 188 Z" fill={u.dress} />
              ) : (
                <path d="M60 74 L100 74 L104 170 L56 170 Z" fill={u.dress} />
              )}
              {/* sash */}
              <path d="M64 76 L96 76 L108 110 L76 110 Z" fill="#f5f0e6" opacity="0.9" />
              <text x="86" y="98" fontSize="9" fontWeight="700" fill={u.accent}
                    transform="rotate(46 86 98)" textAnchor="middle" letterSpacing="0.5">
                {data.name.slice(0, 9).toUpperCase()}
              </text>
              <text x="80" y={isGown ? 150 : 140} fontSize="20" textAnchor="middle">{u.icon}</text>
            </g>

            {/* ARMS */}
            <path d="M62 80 Q30 96 12 130" stroke={u.skin} strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M98 80 Q130 96 148 130" stroke={u.skin} strokeWidth="8" fill="none" strokeLinecap="round" />

            {/* PURSE — tools */}
            <g onClick={open('purse')} style={{ cursor: 'pointer' }} className="nodrag">
              <path d="M96 78 Q120 112 110 150" stroke={u.accent} strokeWidth="2" fill="none" opacity="0.7" />
              <rect x="100" y="146" width="26" height="20" rx="4"
                    fill={data.purseActive ? '#f5d76e' : u.accent}
                    stroke="#0d0614" strokeWidth="1.5">
                {data.purseActive && (
                  <animate attributeName="opacity" values="1;0.3;1" dur="0.45s" repeatCount="indefinite" />
                )}
              </rect>
              <path d="M105 146 Q113 138 121 146" stroke="#0d0614" strokeWidth="1.5" fill="none" />
              {data.tools.length > 0 && (
                <text x="113" y="160" fontSize="9" fontWeight="700" textAnchor="middle" fill="#0d0614">
                  {data.tools.length}
                </text>
              )}
            </g>

            {/* done: green checkmark overlay */}
            {done && (
              <circle cx="80" cy="46" r="11" fill="#00ff88" opacity="0.18" />
            )}
            {/* error: red X overlay */}
            {error && (
              <circle cx="80" cy="46" r="11" fill="#ff2244" opacity="0.18" />
            )}
          </svg>
        </div>

        {/* name + role labels */}
        <div className="text-center px-1 pb-1">
          <div className="text-[10px] font-bold text-white leading-tight truncate">{data.name}</div>
          <div className="text-[8px] text-oldgold-400/80 uppercase tracking-wider">{data.role}</div>
        </div>

        {/* latency + error badges */}
        {(done || error) && (
          <div className="px-2 pb-1 flex items-center justify-center gap-1.5">
            {done && data.latencyMs != null && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#00ff88]/10 border border-[#00ff88]/30">
                <Clock className="w-2.5 h-2.5 text-[#00ff88]" />
                <span className="text-[8px] font-mono font-bold text-[#00ff88]">{data.latencyMs}ms</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#ff2244]/10 border border-[#ff2244]/30">
                <AlertCircle className="w-2.5 h-2.5 text-[#ff2244]" />
                <span className="text-[8px] font-bold text-[#ff2244]">ERROR</span>
              </div>
            )}
          </div>
        )}

        {/* output snippet on done */}
        {done && data.outputSnippet && (
          <div className="mx-2 mb-1.5 px-2 py-1 rounded bg-[#00ff88]/5 border border-[#00ff88]/20">
            <p className="text-[8px] text-[#00ff88]/80 leading-snug line-clamp-2 font-mono">
              {data.outputSnippet}
            </p>
          </div>
        )}

        {/* error message on error */}
        {error && data.errorMsg && (
          <div className="mx-2 mb-1.5 px-2 py-1 rounded bg-[#ff2244]/5 border border-[#ff2244]/20">
            <p className="text-[8px] text-[#ff2244]/80 leading-snug line-clamp-2">
              {data.errorMsg}
            </p>
          </div>
        )}

        {/* ── MODEL SWAP DROPDOWN ──────────────────────────────────────── */}
        <div ref={dropRef} className="nodrag nopan nowheel mx-2 mb-2 relative z-30">
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowModels((v) => !v); }}
            className={`w-full flex items-center justify-between gap-1 px-2 py-1 rounded-lg border transition-all text-left ${
              error
                ? 'bg-[#ff2244]/10 border-[#ff2244]/40 hover:border-[#ff2244]/70'
                : 'bg-midnight-800/80 border-midnight-700 hover:border-oldgold-500/50'
            }`}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {error && <Zap className="w-2.5 h-2.5 text-[#ff2244] shrink-0" />}
              <span className="text-[8px] text-slate-300 truncate">{data.model}</span>
            </div>
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${showModels ? 'rotate-180' : ''} ${error ? 'text-[#ff2244]' : 'text-slate-500'}`} />
          </button>

          {showModels && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-midnight-900 border border-oldgold-500/40 rounded-xl shadow-[0_0_24px_rgba(0,0,0,0.8)] overflow-hidden z-50">
              {error && (
                <div className="px-2 py-1.5 bg-[#ff2244]/10 border-b border-[#ff2244]/20">
                  <p className="text-[8px] text-[#ff2244] font-bold">⚡ Swap model to fix error</p>
                </div>
              )}
              <div className="max-h-[180px] overflow-y-auto">
                {models.map((m) => {
                  const b = TYPE_BADGE[m.type];
                  const isCurrent = m.id === data.model;
                  return (
                    <button
                      key={m.id}
                      onMouseDown={(e) => { e.stopPropagation(); swapModel(m.id); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-midnight-800 transition-colors ${isCurrent ? 'bg-oldgold-500/10' : ''}`}
                    >
                      <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${b.bg} ${b.text} shrink-0`}>{b.label}</span>
                      <span className="text-[9px] text-slate-200 truncate flex-1">{m.label}</span>
                      {isCurrent && <Check className="w-2.5 h-2.5 text-oldgold-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* arm port labels */}
      <div className="absolute -left-1 top-[150px] text-[7px] text-oldgold-400/50 font-bold select-none">IN</div>
      <div className="absolute -right-2 top-[150px] text-[7px] text-oldgold-400/50 font-bold select-none">OUT</div>
    </div>
  );
}

export default memo(DollNodeInner);
