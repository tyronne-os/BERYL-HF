import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Mic, MicOff, Terminal, Eye, Sparkles, Activity, Volume2, X, Send,
  Loader2, Radio, Brain, Crosshair, Layers, Trash2, Zap,
} from 'lucide-react';
import { API } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface VoiceAgentProps {
  onArtifactCreated: (artifact: any) => void;
  isOpen: boolean;
  onClose: () => void;
  currentArtifact?: { type: string; title: string; content: string } | null;
  embedded?: boolean;  // when true, fills its container inline (no fixed overlay) — used in KREWE right-panel tab
}

interface Turn { who: 'user' | 'ove'; text: string; }

interface ClickOverlay { x: number; y: number; id: number; }

// ─── Session ID (CORTEX) ──────────────────────────────────────────────────────
const getOrCreateSessionId = (): string => {
  const key = 'ove_session_id';
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
};

// ─── Patch Applicator (SCULPTOR) ─────────────────────────────────────────────
const applyPatches = (html: string, patches: any[]): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    for (const p of patches) {
      const el = doc.querySelector(p.selector) as HTMLElement | null;
      if (!el) continue;
      if (p.property === 'textContent') el.textContent = p.value;
      else if (p.property === 'innerHTML') el.innerHTML = p.value;
      else if (p.property === 'remove') el.remove();
      else el.style.setProperty(p.property, p.value);
    }
    return doc.documentElement.outerHTML;
  } catch { return html; }
};

// ─── Wake Word Detector (SPECTER) ────────────────────────────────────────────
const WAKE_PHRASES = ['hey ove', 'hey o.v.e', 'o.v.e', 'hey eve', 'hey ov'];

const VoiceAgent: React.FC<VoiceAgentProps> = ({
  onArtifactCreated, isOpen, onClose, currentArtifact, embedded = false,
}) => {
  const [isListening, setIsListening]       = useState(false);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [transcript, setTranscript]         = useState<Turn[]>([]);
  const [lastAction, setLastAction]         = useState<string | null>(null);
  const [shellOutput, setShellOutput]       = useState<string | null>(null);
  const [inputText, setInputText]           = useState('');
  const [micLevel, setMicLevel]             = useState(0);

  // CORTEX
  const [sessionId]                         = useState<string>(getOrCreateSessionId);
  const [turnCount, setTurnCount]           = useState(0);

  // CYCLOPS
  const [visionThumb, setVisionThumb]       = useState<string | null>(null);

  // SPECTER — wake word
  const [wakeEnabled, setWakeEnabled]       = useState(false);
  const [isWakeActive, setIsWakeActive]     = useState(false);

  // CROSSHAIR — click overlay
  const [clickOverlays, setClickOverlays]   = useState<ClickOverlay[]>([]);
  const overlayCounter                      = useRef(0);

  const audioRef                = useRef<HTMLAudioElement>(null);
  const logRef                  = useRef<HTMLDivElement>(null);
  const mediaRecorderRef        = useRef<MediaRecorder | null>(null);
  const chunksRef               = useRef<Blob[]>([]);
  const streamRef               = useRef<MediaStream | null>(null);
  const analyserRef             = useRef<AnalyserNode | null>(null);
  const rafRef                  = useRef<number | null>(null);
  const wakeRecogRef            = useRef<any>(null);
  const wakeAutoRestartRef      = useRef(false);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [transcript, shellOutput]);

  useEffect(() => () => { stopTracks(); stopWakeWord(); }, []);

  // ── Mic helpers ──────────────────────────────────────────────────────────
  const stopTracks = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const monitorLevel = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setMicLevel(Math.min(data.reduce((a, b) => a + b, 0) / data.length / 128, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* best-effort */ }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      monitorLevel(stream);
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stopTracks();
        setMicLevel(0);
        if (blob.size > 0) await submitAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsListening(true);
    } catch {
      addOveMessage('Microphone access denied. Use text input below.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    setIsListening(false);
  };

  const toggleListening = () => (isListening ? stopRecording() : startRecording());

  // ── SPECTER — Wake Word ───────────────────────────────────────────────────
  const startWakeWord = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { addOveMessage('Wake word not available in this browser. Use Chrome.'); return; }
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.onresult = (e: any) => {
      const text = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript.toLowerCase())
        .join(' ');
      if (WAKE_PHRASES.some((w) => text.includes(w))) {
        recog.stop();
        setIsWakeActive(false);
        setTimeout(() => { startRecording(); }, 300);
      }
    };
    recog.onend = () => {
      if (wakeAutoRestartRef.current) {
        setTimeout(() => {
          try { recog.start(); setIsWakeActive(true); } catch { /* ignore */ }
        }, 500);
      } else {
        setIsWakeActive(false);
      }
    };
    recog.onerror = () => { /* silent */ };
    try {
      recog.start();
      wakeRecogRef.current = recog;
      wakeAutoRestartRef.current = true;
      setIsWakeActive(true);
    } catch { /* ignore */ }
  }, []);

  const stopWakeWord = useCallback(() => {
    wakeAutoRestartRef.current = false;
    wakeRecogRef.current?.stop();
    wakeRecogRef.current = null;
    setIsWakeActive(false);
  }, []);

  useEffect(() => {
    if (wakeEnabled) startWakeWord();
    else stopWakeWord();
  }, [wakeEnabled]);

  // ── CROSSHAIR — spawn ripple overlay, auto-remove after 1.5s ─────────────
  const spawnClickOverlay = (x: number, y: number) => {
    const id = ++overlayCounter.current;
    setClickOverlays((p) => [...p, { x, y, id }]);
    setTimeout(() => setClickOverlays((p) => p.filter((o) => o.id !== id)), 1500);
  };

  // ── Response handler ──────────────────────────────────────────────────────
  const addOveMessage = (text: string) => setTranscript((p) => [...p, { who: 'ove', text }]);

  const handleResponse = (data: any) => {
    if (data.transcription) setTranscript((p) => [...p, { who: 'user', text: data.transcription }]);

    if (data.speech) { setTranscript((p) => [...p, { who: 'ove', text: data.speech }]); setLastAction(data.speech); }

    // CYCLOPS — vision thumbnail
    if (data.vision_thumbnail_b64) setVisionThumb(data.vision_thumbnail_b64);

    // CORTEX — update turn count
    if (data.session_id) setTurnCount((t) => t + 1);

    // SCULPTOR — patch canvas
    if (data.patches && currentArtifact?.content) {
      const patched = applyPatches(currentArtifact.content, data.patches);
      onArtifactCreated({ ...currentArtifact, content: patched });
      setLastAction(`Canvas patched (${data.patches.length} change${data.patches.length !== 1 ? 's' : ''}).`);
    }

    // new artifact
    if (data.artifact) {
      onArtifactCreated(data.artifact);
      setLastAction('New artifact built in Canvas.');
    }

    // shell
    if (data.shell_output) { setShellOutput(data.shell_output); setLastAction('PowerShell executed.'); }

    // CROSSHAIR — show overlay at click coords
    if (data.computer_action?.type === 'click') {
      spawnClickOverlay(data.computer_action.x, data.computer_action.y);
    }

    // TTS playback
    if (data.audio_base64 && audioRef.current) {
      audioRef.current.src = `data:audio/wav;base64,${data.audio_base64}`;
      audioRef.current.play().catch(() => {});
    }
  };

  // ── Submit helpers ────────────────────────────────────────────────────────
  const buildFormData = (extra: Record<string, string | Blob>) => {
    const fd = new FormData();
    fd.append('session_id', sessionId);
    if (currentArtifact?.content) fd.append('current_canvas_html', currentArtifact.content);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return fd;
  };

  const submitAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setLastAction(null); setShellOutput(null);
    try {
      const { data } = await axios.post(`${API}/voice/orchestrate`, buildFormData({ audio: blob }));
      handleResponse(data);
    } catch {
      addOveMessage('Connection to O.V.E core lost.');
    } finally { setIsProcessing(false); }
  };

  const submitText = async (text: string) => {
    if (!text.trim()) return;
    setInputText('');
    setIsProcessing(true);
    setLastAction(null); setShellOutput(null);
    setTranscript((p) => [...p, { who: 'user', text }]);
    try {
      const { data } = await axios.post(`${API}/voice/orchestrate`, buildFormData({ text_fallback: text }));
      if (data.speech) { setTranscript((p) => [...p, { who: 'ove', text: data.speech }]); setLastAction(data.speech); }
      if (data.vision_thumbnail_b64) setVisionThumb(data.vision_thumbnail_b64);
      if (data.session_id) setTurnCount((t) => t + 1);
      if (data.patches && currentArtifact?.content) {
        onArtifactCreated({ ...currentArtifact, content: applyPatches(currentArtifact.content, data.patches) });
      }
      if (data.artifact) onArtifactCreated(data.artifact);
      if (data.shell_output) setShellOutput(data.shell_output);
      if (data.computer_action?.type === 'click') spawnClickOverlay(data.computer_action.x, data.computer_action.y);
      if (data.audio_base64 && audioRef.current) {
        audioRef.current.src = `data:audio/wav;base64,${data.audio_base64}`;
        audioRef.current.play().catch(() => {});
      }
    } catch {
      addOveMessage('Connection to O.V.E core lost.');
    } finally { setIsProcessing(false); }
  };

  const clearMemory = async () => {
    try { await axios.delete(`${API}/voice/session/${sessionId}`); } catch { /* ignore */ }
    setTranscript([]);
    setTurnCount(0);
    setLastAction(null);
    setShellOutput(null);
    addOveMessage('Memory cleared. Starting fresh.');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── CROSSHAIR Click Overlay (CROSSHAIR innovation) ── */}
      {clickOverlays.map((o) => (
        <div
          key={o.id}
          className="fixed z-[9999] pointer-events-none"
          style={{ left: o.x - 24, top: o.y - 24, width: 48, height: 48 }}
        >
          {/* outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-oldgold-400 animate-ping opacity-75" />
          {/* crosshair lines */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-oldgold-400 opacity-80 -translate-x-1/2" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-oldgold-400 opacity-80 -translate-y-1/2" />
          {/* center dot */}
          <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-oldgold-400 shadow-[0_0_6px_rgba(212,175,55,0.9)]" />
          {/* coord label */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[9px] font-mono font-bold text-oldgold-400 bg-midnight-950/80 px-1 rounded whitespace-nowrap">
            {o.x},{o.y}
          </div>
        </div>
      ))}

      {/* ── Voice Panel ── */}
      <div
        className={embedded
          ? 'relative w-full h-full'
          : `fixed top-14 bottom-14 right-0 z-[55] w-80 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className={`h-full bg-midnight-900/95 backdrop-blur-2xl flex flex-col ${embedded ? '' : 'border-l border-oldgold-500/30 shadow-[0_0_50px_rgba(212,175,55,0.12)]'}`}>

          {/* Header */}
          <div className="p-3 bg-midnight-950/50 border-b border-midnight-800/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-midnight-800 border border-midnight-800">
                  {/* SPECTER ambient ring */}
                  {isWakeActive && !isListening && (
                    <div className="absolute inset-[-3px] rounded-full border border-purple-500/50 animate-pulse" />
                  )}
                  <div className={`absolute inset-0 rounded-full blur-sm ${isListening ? 'bg-red-500/50 animate-pulse' : isProcessing ? 'bg-oldgold-500/50 animate-pulse' : isWakeActive ? 'bg-purple-500/20' : 'bg-oldgold-500/30'}`} />
                  <Sparkles className="w-4 h-4 text-oldgold-400 relative z-10" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">O.V.E Core</h3>
                  <div className="flex items-center space-x-1 text-[9px] font-bold uppercase tracking-widest text-green-400">
                    <Eye className="w-3 h-3" />
                    <span>{visionThumb ? 'Vision Live' : 'Vision Sync'}</span>
                    {turnCount > 0 && (
                      <span className="ml-1 text-purple-400 flex items-center gap-0.5">
                        <Brain className="w-2.5 h-2.5" />{turnCount}t
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearMemory}
                  title="Clear O.V.E memory"
                  className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-midnight-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={onClose} className="p-1.5 hover:bg-midnight-800 rounded-full text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Capability badges */}
            <div className="flex gap-1 flex-wrap">
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center gap-0.5">
                <Brain className="w-2.5 h-2.5" /> CORTEX
              </span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" /> CYCLOPS
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 cursor-pointer transition-all ${wakeEnabled ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-midnight-800/50 text-slate-500 border-midnight-700'}`}
                onClick={() => setWakeEnabled(!wakeEnabled)}
                title="Toggle wake word: Hey O.V.E"
              >
                <Radio className="w-2.5 h-2.5" /> {wakeEnabled ? 'SPECTER ON' : 'SPECTER'}
              </span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-oldgold-500/15 text-oldgold-400 border border-oldgold-500/25 flex items-center gap-0.5">
                <Layers className="w-2.5 h-2.5" /> SCULPTOR
              </span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 flex items-center gap-0.5">
                <Crosshair className="w-2.5 h-2.5" /> XHAIR
              </span>
            </div>
          </div>

          {/* CYCLOPS — Vision Thumbnail + Visualizer */}
          <div className="px-4 pt-3 pb-2 border-b border-midnight-800/50 bg-midnight-950/50 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.15) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
            <div className="relative z-10 flex items-center gap-3 h-14">
              {/* Vision thumbnail */}
              {visionThumb ? (
                <div className="shrink-0 rounded overflow-hidden border border-oldgold-500/30 shadow-[0_0_8px_rgba(212,175,55,0.2)]">
                  <img src={`data:image/jpeg;base64,${visionThumb}`} alt="Screen" className="w-[64px] h-[36px] object-cover" />
                  <div className="text-[7px] text-center text-oldgold-500 font-bold bg-midnight-950 py-px">SCREEN</div>
                </div>
              ) : (
                <div className="shrink-0 w-16 h-9 rounded border border-midnight-700 bg-midnight-900 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-slate-600" />
                </div>
              )}

              {/* Level meter / status */}
              <div className="flex-1 flex items-center justify-center">
                {isListening ? (
                  <div className="flex items-end space-x-0.5 h-10">
                    {[0,1,2,3,4,5,6].map((i) => (
                      <div key={i} className="w-1.5 bg-red-500 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(15, micLevel * 100 * (0.5 + Math.random() * 0.8))}%` }} />
                    ))}
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Activity className="w-6 h-6 text-oldgold-400 animate-spin" />
                    <span className="text-[9px] text-oldgold-400 font-bold uppercase tracking-widest mt-1">Computing</span>
                  </div>
                ) : isWakeActive ? (
                  <div className="flex flex-col items-center">
                    <Radio className="w-5 h-5 text-purple-400 animate-pulse" />
                    <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mt-1">Say "Hey O.V.E"</span>
                  </div>
                ) : lastAction ? (
                  <div className="text-center">
                    <Volume2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <p className="text-[10px] text-green-400 font-medium px-1 line-clamp-2">{lastAction}</p>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-slate-600 uppercase">Awaiting Directive</span>
                )}
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div ref={logRef} className="flex-1 overflow-y-auto p-3 bg-midnight-950 space-y-1.5 text-xs font-mono scroll-smooth">
            {transcript.length === 0 && (
              <div className="text-slate-600 italic text-center mt-6 px-4 space-y-2">
                <Zap className="w-6 h-6 mx-auto text-oldgold-800" />
                <p>O.V.E can see your screen, remember your conversation, patch the canvas, and show every click it makes.</p>
                <p className="text-[10px] text-slate-700">Tap SPECTER badge to enable "Hey O.V.E" wake word.</p>
              </div>
            )}
            {transcript.map((t, i) => (
              <div key={i} className={t.who === 'user' ? 'text-slate-400' : 'text-oldgold-400 font-bold'}>
                <span className="opacity-50 text-[9px] mr-1">{t.who === 'user' ? 'YOU' : 'OVE'}</span>{t.text}
              </div>
            ))}
            {shellOutput && (
              <div className="mt-2 p-2 bg-midnight-900 border border-midnight-800 rounded text-slate-400 text-[10px] overflow-x-auto whitespace-pre-wrap">
                <div className="flex items-center space-x-1 mb-1 text-slate-400">
                  <Terminal className="w-3 h-3" /><span>PowerShell</span>
                </div>
                {shellOutput}
              </div>
            )}
          </div>

          {/* Input Controls */}
          <div className="p-3 bg-midnight-900 border-t border-midnight-800/50 space-y-2">
            <div className="flex space-x-2">
              <input
                type="text" value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitText(inputText); }}
                placeholder="Type a command…"
                className="flex-1 bg-midnight-950 border border-midnight-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-oldgold-500 text-white placeholder-slate-600"
              />
              <button
                onClick={() => submitText(inputText)}
                disabled={!inputText.trim() || isProcessing}
                className="p-2 rounded-xl bg-midnight-800 hover:bg-midnight-700 text-oldgold-400 disabled:opacity-40 transition-colors"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`w-full py-2.5 rounded-xl flex items-center justify-center space-x-2 font-bold text-sm transition-all shadow-lg disabled:opacity-50 ${
                isListening
                  ? 'bg-red-600/20 text-red-400 border border-red-500/50'
                  : 'bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'STOP & SEND' : 'SPEAK TO O.V.E'}</span>
            </button>
          </div>
        </div>
        <audio ref={audioRef} className="hidden" />
      </div>
    </>
  );
};

export default VoiceAgent;
