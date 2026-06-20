import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Sparkles, Mic, MicOff, Send, Power, Zap, Activity, Shield, Fingerprint,
  Wind, Smile, Wand2, Gauge, GitBranch, Camera, Share2, Cpu, Circle,
  RefreshCw, ChevronRight, X, Clock,
} from 'lucide-react';
import { API } from '../api';

// ── The 13-doll pipeline (science on the back) ───────────────────────────────
const PIPELINE = [
  { key: 'phoenix',  name: 'Phoenix',          role: 'Identity Genesis',     icon: '🔥' },
  { key: 'whisper',  name: 'Cmdr Whisper',     role: 'ASR · Floor Predict',  icon: '🎧' },
  { key: 'cognita',  name: 'Dr. Cognita',      role: 'BitNet Brain',         icon: '🧠' },
  { key: 'memoris',  name: 'Maestra Memoris',  role: 'Memory Layer',         icon: '📚' },
  { key: 'soulfire', name: 'Soulfire',         role: 'Emotion Engine',       icon: '🎭' },
  { key: 'vox',      name: 'Lady Vox',         role: 'TTS · Voice',          icon: '🎤' },
  { key: 'sync',     name: 'Señorita Sync',    role: 'Lip + Body Motion',    icon: '💃' },
  { key: 'longlive', name: 'Madame LongLive',  role: '4D Render',            icon: '🎬' },
  { key: 'anima',    name: 'Anima Soul',       role: 'Identity Lock',        icon: '🎨' },
  { key: 'sentinel', name: 'Officer Sentinel', role: 'Quality Gate',         icon: '🛡️' },
  { key: 'flux',     name: 'Maestro Flux',     role: 'MCP Orchestration',    icon: '🎼' },
  { key: 'curator',  name: 'Madame Curator',   role: 'Gallery',              icon: '🖼️' },
  { key: 'tress',    name: 'Maestra Tress',    role: 'Hair + Accessory Phys', icon: '💇' },
];

const QUALITY_LABELS: Record<string, string> = {
  image_generated: 'Image generated',
  resolution_locked: 'Resolution locked',
  identity_seed_locked: 'Identity seed locked',
  latency_sla_4s: 'Latency SLA (<4s)',
  face_region_present: 'Face region present',
  hands_visible: 'Hands visible',
  no_safety_flag: 'Safety clear',
  prompt_injection_clear: 'Injection clear',
  lip_sync_offset: 'Lip-sync offset',
  av_sync: 'A/V sync',
};

interface LabStatus {
  active: boolean; mode: string; hardware: string | null; rate_per_hr: number;
  target_space: string | null; session_seconds: number; gpu_cost: number;
  inference_cost: number; total_cost: number; frames: number; last_gen_ms: number;
  last_quality: { passed: number; total: number; grade: string; checks: Record<string, any> } | null;
  amanda_seed: number;
}
interface AmandaDNA {
  name: string; seed: number; face_hash: string; hair_type: string; hair_desc: string;
  physics_coeff: number; voice_sig: string; eyes: string; wardrobe: string; framing: string;
}
type Panel = 'inspector' | 'quality' | 'dna' | 'hair' | 'emotion' | 'prompt' | 'latency' | null;
interface ChatMsg { role: 'you' | 'amanda'; text: string; ms?: number }

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const LabPage: React.FC = () => {
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [dna, setDna] = useState<AmandaDNA | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [genMeta, setGenMeta] = useState<{ gen_ms: number; resolution: string; fps: number; model: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [micOn, setMicOn] = useState(false);

  const [panel, setPanel] = useState<Panel>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [activeStage, setActiveStage] = useState(-1);

  const [spaces, setSpaces] = useState<string[]>([]);
  const [targetSpace, setTargetSpace] = useState<string>('');
  const [promptDraft, setPromptDraft] = useState('');
  const [emotion, setEmotion] = useState('warm');
  const [latency, setLatency] = useState<Record<string, number>>({});

  const recogRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Status meter poll ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await axios.get<LabStatus>(`${API}/lab/status`);
        if (alive) setStatus(data);
      } catch { /* backend warming */ }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // ── Load Amanda's DNA + first portrait + space list ────────────────────────
  useEffect(() => {
    axios.get<AmandaDNA>(`${API}/lab/amanda`).then(r => setDna(r.data)).catch(() => {});
    axios.get(`${API}/space/list`).then(r => setSpaces((r.data.spaces || []).map((s: any) => s.id))).catch(() => {});
    generateAmanda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  // ── Generate Amanda ────────────────────────────────────────────────────────
  const generateAmanda = useCallback(async (override?: string) => {
    setGenerating(true); setGenError(null);
    // animate the science running on the back
    let stage = 0;
    const stageTimer = setInterval(() => {
      stage = (stage + 1) % PIPELINE.length;
      setActiveStage(stage);
    }, 220);
    try {
      const { data } = await axios.post(`${API}/lab/generate-avatar`, {
        ...(override ? { prompt: override } : {}),
      }, { timeout: 90000 });
      if (data.image_b64) {
        setImage(`data:${data.mime || 'image/jpeg'};base64,${data.image_b64}`);
        setGenMeta({ gen_ms: data.gen_ms, resolution: data.frame_stats?.resolution, fps: data.frame_stats?.fps_target, model: data.model });
        if (data.prompt) setPromptDraft(data.prompt);
      } else {
        setGenError(data.error || 'No image returned (model may be cold — retry in ~20s)');
      }
    } catch (e: any) {
      setGenError(e?.message || 'Generation failed');
    } finally {
      clearInterval(stageTimer);
      setActiveStage(-1);
      setGenerating(false);
    }
  }, []);

  // ── WAKE / SLEEP ───────────────────────────────────────────────────────────
  const wake = async () => {
    try {
      await axios.post(`${API}/lab/wake`, {
        hardware: 't4-small',
        target_space: targetSpace || null,
      });
    } catch { /* surfaced via meter */ }
  };
  const sleep = async () => { try { await axios.post(`${API}/lab/sleep`); } catch {} };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg) return;
    setMessages(m => [...m, { role: 'you', text: msg }]);
    setInput(''); setThinking(true);
    try {
      const { data } = await axios.post(`${API}/lab/chat`, { message: msg }, { timeout: 60000 });
      setMessages(m => [...m, { role: 'amanda', text: data.reply, ms: data.latency?.llm_ms }]);
      setLatency(data.latency || {});
      setEmotion(data.emotion || 'warm');
    } catch {
      setMessages(m => [...m, { role: 'amanda', text: '(connection warming — try again)' }]);
    } finally { setThinking(false); }
  };

  // ── Mic (browser SpeechRecognition — input only, GPU stays on HF) ──────────
  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not available in this browser.'); return; }
    if (micOn) { recogRef.current?.stop(); setMicOn(false); return; }
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = 'en-US';
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(t); send(t); };
    r.onend = () => setMicOn(false);
    r.onerror = () => setMicOn(false);
    recogRef.current = r; r.start(); setMicOn(true);
  };

  const snapshot = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image; a.download = `amanda_${Date.now()}.jpg`; a.click();
  };

  const sendToKrewe = () => {
    alert('Amanda promoted to KREWE. Open the KREWE page — the 13-doll squad will hold hands on the canvas to show the live pipeline.');
  };

  const hot = status?.active && status?.mode === 'studio';
  const q = status?.last_quality;

  // ── Right-edge tool toggles ─────────────────────────────────────────────────
  const tools: { id: Panel; icon: React.ReactNode; label: string }[] = [
    { id: 'inspector', icon: <Activity className="w-4 h-4" />, label: 'Frame Inspector' },
    { id: 'quality',   icon: <Shield className="w-4 h-4" />,   label: 'Quality Gate' },
    { id: 'dna',       icon: <Fingerprint className="w-4 h-4" />, label: 'Identity DNA' },
    { id: 'hair',      icon: <Wind className="w-4 h-4" />,     label: 'Hair Physics' },
    { id: 'emotion',   icon: <Smile className="w-4 h-4" />,    label: 'Emotion' },
    { id: 'prompt',    icon: <Wand2 className="w-4 h-4" />,    label: 'Prompt / Seed' },
    { id: 'latency',   icon: <Gauge className="w-4 h-4" />,    label: 'Latency Budget' },
  ];

  return (
    <div className="flex flex-col h-full bg-midnight-950 text-slate-100 overflow-hidden">
      {/* ════ TOP HUD: GPU METER + WAKE/SLEEP ════ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-midnight-900 border-b border-midnight-800">
        {/* live cost meter */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5 border ${
            hot ? 'border-oldgold-500/60 bg-oldgold-900/30' : 'border-midnight-800 bg-midnight-950'}`}>
            <span className={`flex items-center justify-center w-6 h-6 rounded-full ${
              hot ? 'bg-oldgold-500/20' : 'bg-midnight-800'}`}>
              <Cpu className={`w-3.5 h-3.5 ${hot ? 'text-oldgold-400' : 'text-slate-500'}`} />
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                {hot ? `${status?.hardware} · $${status?.rate_per_hr?.toFixed(2)}/hr` : 'Serverless · Eco'}
              </span>
              <span className="text-[13px] font-mono font-bold mt-0.5" style={{ color: hot ? '#F4A98A' : '#94a3b8' }}>
                ${ (status?.total_cost ?? 0).toFixed(5) }
              </span>
            </div>
          </div>
          {/* GPU active dot + timer */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className={`relative flex h-2.5 w-2.5`}>
              {hot && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-oldgold-400 opacity-75" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${hot ? 'bg-oldgold-500' : 'bg-slate-600'}`} />
            </span>
            <span className={hot ? 'text-oldgold-400' : 'text-slate-500'}>{hot ? 'GPU HOT' : 'IDLE'}</span>
            {hot && <span className="text-slate-500 ml-1"><Clock className="w-3 h-3 inline -mt-0.5" /> {fmtTime(status?.session_seconds ?? 0)}</span>}
          </div>
        </div>

        {/* title */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-oldgold-400" />
          <span className="text-sm font-black tracking-[0.2em] text-slate-200">THE LAB</span>
          <span className="text-[10px] text-slate-500 font-mono">· Amanda · Light Switch</span>
        </div>

        {/* WAKE / SLEEP */}
        <div className="flex items-center gap-2">
          <select
            value={targetSpace}
            onChange={e => setTargetSpace(e.target.value)}
            className="text-[10px] bg-midnight-950 border border-midnight-800 rounded-md px-2 py-1.5 text-slate-400 max-w-[150px]"
            title="Pick one of your HF Spaces to engage a real T4 GPU ($0.40/hr). Leave blank for Eco/serverless.">
            <option value="">Eco (serverless)</option>
            {spaces.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {status?.active ? (
            <button onClick={sleep}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-slate-700 hover:bg-slate-600 text-white transition-all">
              <Power className="w-3.5 h-3.5" /> SLEEP
            </button>
          ) : (
            <button onClick={wake}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-gradient-to-r from-oldgold-500 to-amber-500 text-midnight-950 hover:shadow-[0_0_18px_rgba(232,131,90,0.5)] transition-all">
              <Zap className="w-3.5 h-3.5" /> WAKE
            </button>
          )}
        </div>
      </div>

      {/* ════ BODY: CHAT | AMANDA | TOOL RAIL ════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Chat box (LEFT) ── */}
        <div className="w-[300px] shrink-0 border-r border-midnight-800 flex flex-col bg-midnight-900/40">
          <div className="px-3 py-2.5 border-b border-midnight-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold text-slate-300">Talk to Amanda</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                Say hello to Amanda, or click the mic. Watch her render in real time on the right —
                the full 13-stage science runs on the back.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-snug ${
                  m.role === 'you'
                    ? 'bg-oldgold-500/15 border border-oldgold-500/30 text-slate-200'
                    : 'bg-midnight-800 border border-midnight-800 text-slate-300'}`}>
                  {m.text}
                  {m.ms !== undefined && <span className="block mt-1 text-[9px] text-slate-500 font-mono">{m.ms}ms</span>}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-midnight-800 rounded-xl px-3 py-2 text-[12px] text-slate-500">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-oldgold-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-oldgold-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-oldgold-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2.5 border-t border-midnight-800">
            <div className="flex items-end gap-2">
              <button onClick={toggleMic}
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  micOn ? 'bg-red-500 text-white animate-pulse' : 'bg-midnight-800 text-slate-400 hover:text-oldgold-400'}`}>
                {micOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Message Amanda…"
                rows={1}
                className="flex-1 resize-none bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-oldgold-500/50 max-h-24" />
              <button onClick={() => send(input)} disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-lg bg-oldgold-500 text-midnight-950 flex items-center justify-center hover:bg-oldgold-600 disabled:opacity-40 transition-all">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Amanda stage (CENTER) ── */}
        <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-midnight-950 to-midnight-900 overflow-hidden">
          {/* subtle studio vignette */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(244,169,138,0.06), transparent 60%)' }} />

          {image ? (
            <img src={image} alt="Amanda"
              className="max-h-[88%] max-w-[88%] object-contain rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-midnight-800" />
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-midnight-800 flex items-center justify-center mb-3">
                <Sparkles className="w-8 h-8 text-slate-700" />
              </div>
              <p className="text-slate-600 text-sm">Amanda is being generated…</p>
            </div>
          )}

          {/* generating overlay — the science running */}
          {generating && (
            <div className="absolute inset-0 bg-midnight-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">{activeStage >= 0 ? PIPELINE[activeStage].icon : '✨'}</div>
                <p className="text-oldgold-400 font-bold text-sm">
                  {activeStage >= 0 ? PIPELINE[activeStage].name : 'Initializing'}
                </p>
                <p className="text-slate-500 text-[11px] mt-1">
                  {activeStage >= 0 ? PIPELINE[activeStage].role : 'pipeline'}
                </p>
                <div className="mt-4 w-48 h-1 bg-midnight-800 rounded-full overflow-hidden mx-auto">
                  <div className="h-full bg-gradient-to-r from-oldgold-500 to-amber-500 animate-pulse"
                       style={{ width: `${((activeStage + 1) / PIPELINE.length) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {genError && !generating && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-900/40 border border-red-500/40 rounded-lg px-4 py-2 text-[11px] text-red-300 max-w-md text-center z-20">
              {genError}
            </div>
          )}

          {/* frame inspector strip (always on, bottom) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-midnight-950/85 backdrop-blur border border-midnight-800 rounded-full px-4 py-1.5 text-[10px] font-mono text-slate-400 z-10">
            <span className="text-emerald-400">● {genMeta?.fps ?? 24}fps</span>
            <span>{genMeta?.resolution ?? '768×1024'}</span>
            <span>gen {genMeta?.gen_ms ?? status?.last_gen_ms ?? 0}ms</span>
            <span className="text-slate-600">frames {status?.frames ?? 0}</span>
            {q && <span className={`font-bold ${q.grade === 'A' ? 'text-emerald-400' : q.grade === 'B' ? 'text-amber-400' : 'text-red-400'}`}>
              gate {q.passed}/{q.total} · {q.grade}</span>}
          </div>

          {/* stage actions (top-right of stage) */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            <button onClick={() => generateAmanda()} disabled={generating}
              className="flex items-center gap-1.5 bg-midnight-950/85 border border-midnight-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:text-oldgold-400 hover:border-oldgold-500/40 disabled:opacity-50 transition-all">
              <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} /> Regenerate
            </button>
            <button onClick={snapshot} disabled={!image}
              className="flex items-center gap-1.5 bg-midnight-950/85 border border-midnight-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:text-oldgold-400 transition-all disabled:opacity-40">
              <Camera className="w-3 h-3" /> Snapshot
            </button>
            <button onClick={sendToKrewe}
              className="flex items-center gap-1.5 bg-gradient-to-r from-oldgold-500/90 to-amber-500/90 rounded-lg px-3 py-1.5 text-[10px] font-bold text-midnight-950 hover:shadow-[0_0_14px_rgba(232,131,90,0.4)] transition-all">
              <Share2 className="w-3 h-3" /> Send to KREWE
            </button>
          </div>
        </div>

        {/* ── Tool rail (RIGHT edge) ── */}
        <div className="w-12 shrink-0 border-l border-midnight-800 bg-midnight-900 flex flex-col items-center py-3 gap-1.5">
          {tools.map(t => (
            <button key={t.id} title={t.label} onClick={() => setPanel(panel === t.id ? null : t.id)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                panel === t.id ? 'bg-oldgold-500 text-midnight-950' : 'text-slate-500 hover:text-oldgold-400 hover:bg-midnight-800'}`}>
              {t.icon}
            </button>
          ))}
          <div className="flex-1" />
          <button title="Pipeline telemetry (13 dolls)" onClick={() => setShowPipeline(v => !v)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              showPipeline ? 'bg-oldgold-500 text-midnight-950' : 'text-slate-500 hover:text-oldgold-400 hover:bg-midnight-800'}`}>
            <GitBranch className="w-4 h-4" />
          </button>
        </div>

        {/* ── Science drawer (slides over from right) ── */}
        {panel && (
          <div className="absolute right-12 top-[57px] bottom-0 w-[300px] bg-midnight-900 border-l border-midnight-800 shadow-2xl z-30 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-midnight-800">
              <span className="text-[11px] font-bold text-oldgold-400">{tools.find(t => t.id === panel)?.label}</span>
              <button onClick={() => setPanel(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 text-[11px] text-slate-300 space-y-3">
              {panel === 'inspector' && (
                <>
                  <Row k="FPS target" v={`${genMeta?.fps ?? 24}`} />
                  <Row k="Resolution" v={genMeta?.resolution ?? '768×1024'} />
                  <Row k="Last gen" v={`${genMeta?.gen_ms ?? 0} ms`} />
                  <Row k="Frames this session" v={`${status?.frames ?? 0}`} />
                  <Row k="Model" v={genMeta?.model?.split('/').pop() ?? 'FLUX.1-dev'} />
                  <Row k="Mode" v={status?.mode ?? 'eco'} />
                </>
              )}
              {panel === 'quality' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Officer Sentinel gate</span>
                    {q && <span className={`font-black ${q.grade === 'A' ? 'text-emerald-400' : 'text-amber-400'}`}>{q.passed}/{q.total} · {q.grade}</span>}
                  </div>
                  {q ? Object.entries(q.checks).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-slate-400">{QUALITY_LABELS[k] || k}</span>
                      {v === true ? <span className="text-emerald-400">✓ pass</span>
                        : v === 'pending' ? <span className="text-slate-500">○ pending</span>
                        : <span className="text-red-400">✗ fail</span>}
                    </div>
                  )) : <p className="text-slate-500">Generate Amanda to run the gate.</p>}
                </div>
              )}
              {panel === 'dna' && dna && (
                <>
                  <Row k="Name" v={dna.name} />
                  <Row k="Seed (locked)" v={`${dna.seed}`} />
                  <Row k="Face hash" v={dna.face_hash} mono />
                  <Row k="Hair type" v={`${dna.hair_type} — ${dna.hair_desc}`} />
                  <Row k="Physics coeff" v={`${dna.physics_coeff}`} />
                  <Row k="Eyes" v={dna.eyes} />
                  <Row k="Voice sig" v={dna.voice_sig} mono />
                  <Row k="Wardrobe" v={dna.wardrobe} />
                  <Row k="Framing" v={dna.framing} />
                </>
              )}
              {panel === 'hair' && (
                <>
                  <p className="text-slate-400 mb-2">MAESTRA TRESS — live physics</p>
                  <Row k="Hair type" v="T4 · fine straight ginger" />
                  <Row k="Sway amplitude" v="HIGH (0.72)" />
                  <Row k="Damping" v="0.44" />
                  <Bar label="Strand motion" v={generating ? 70 : 12} />
                  <Bar label="Earring pendulum" v={generating ? 55 : 6} />
                  <Bar label="Necklace drape" v={generating ? 30 : 4} />
                  <p className="text-[10px] text-slate-600 mt-2">Physics couples to head angular velocity — fires when she turns. Calibrated natural, not excessive.</p>
                </>
              )}
              {panel === 'emotion' && (
                <>
                  <p className="text-slate-400 mb-2">Soulfire — emotional state</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['warm', 'curious', 'joy', 'calm', 'empathy', 'excited', 'contemplative', 'confident', 'surprise', 'attentive'].map(e => (
                      <span key={e} className={`text-center rounded-md py-1.5 text-[10px] font-bold ${
                        emotion === e ? 'bg-oldgold-500 text-midnight-950' : 'bg-midnight-800 text-slate-500'}`}>{e}</span>
                    ))}
                  </div>
                </>
              )}
              {panel === 'prompt' && (
                <>
                  <p className="text-slate-400 mb-1">Generation prompt</p>
                  <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)} rows={8}
                    className="w-full bg-midnight-950 border border-midnight-800 rounded-lg p-2 text-[10px] text-slate-300 resize-none focus:outline-none focus:border-oldgold-500/50" />
                  <Row k="Seed (locked)" v={`${status?.amanda_seed ?? 77707}`} mono />
                  <button onClick={() => generateAmanda(promptDraft)} disabled={generating}
                    className="w-full mt-1 bg-oldgold-500 text-midnight-950 rounded-lg py-2 text-[11px] font-bold hover:bg-oldgold-600 disabled:opacity-50">
                    Regenerate with this prompt
                  </button>
                </>
              )}
              {panel === 'latency' && (
                <>
                  <p className="text-slate-400 mb-2">Latency budget (&lt;500ms target)</p>
                  <Bar label="STT" v={Math.min(100, (latency.stt_ms || 0) / 5)} ms={latency.stt_ms} />
                  <Bar label="LLM" v={Math.min(100, (latency.llm_ms || 0) / 5)} ms={latency.llm_ms} />
                  <Bar label="TTS" v={Math.min(100, (latency.tts_ms || 0) / 5)} ms={latency.tts_ms} />
                  <Bar label="Lip-sync" v={Math.min(100, (latency.lipsync_ms || 0) / 5)} ms={latency.lipsync_ms} />
                  <Bar label="Render" v={Math.min(100, (latency.render_ms || 0) / 5)} ms={latency.render_ms} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════ PIPELINE TELEMETRY RAIL (collapsible, off by default) ════ */}
      {showPipeline && (
        <div className="shrink-0 border-t border-midnight-800 bg-midnight-900 px-3 py-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            <span className="text-[9px] uppercase tracking-wider text-slate-600 font-bold mr-2">Pipeline</span>
            {PIPELINE.map((d, i) => (
              <React.Fragment key={d.key}>
                <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 border transition-all ${
                  activeStage === i ? 'bg-oldgold-500/20 border-oldgold-500/60' : 'bg-midnight-950 border-midnight-800'}`}>
                  <span className="text-[12px]">{d.icon}</span>
                  <div className="flex flex-col leading-none">
                    <span className={`text-[9px] font-bold ${activeStage === i ? 'text-oldgold-400' : 'text-slate-400'}`}>{d.name}</span>
                    <span className="text-[8px] text-slate-600">{d.role}</span>
                  </div>
                </div>
                {i < PIPELINE.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── tiny helpers ─────────────────────────────────────────────────────────────
const Row: React.FC<{ k: string; v: string; mono?: boolean }> = ({ k, v, mono }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-slate-500 shrink-0">{k}</span>
    <span className={`text-slate-300 text-right ${mono ? 'font-mono text-[10px]' : ''}`}>{v}</span>
  </div>
);
const Bar: React.FC<{ label: string; v: number; ms?: number }> = ({ label, v, ms }) => (
  <div>
    <div className="flex items-center justify-between mb-0.5">
      <span className="text-slate-500 text-[10px]">{label}</span>
      <span className="text-slate-400 text-[10px] font-mono">{ms !== undefined ? `${ms}ms` : `${Math.round(v)}%`}</span>
    </div>
    <div className="h-1.5 bg-midnight-800 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-oldgold-500 to-amber-500 rounded-full transition-all" style={{ width: `${Math.max(2, v)}%` }} />
    </div>
  </div>
);

export default LabPage;
