import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, MicOff, Terminal, Eye, Sparkles, Activity, Volume2, X, Send, Loader2 } from 'lucide-react';
import { API } from '../api';

interface VoiceAgentProps {
  onArtifactCreated: (artifact: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

const VoiceAgent: React.FC<VoiceAgentProps> = ({ onArtifactCreated, isOpen, onClose }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<{ who: 'user' | 'ove'; text: string }[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [shellOutput, setShellOutput] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [micLevel, setMicLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [transcript, shellOutput]);

  // Clean up mic on unmount
  useEffect(() => () => stopTracks(), []);

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
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(avg / 128, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* visualizer is best-effort */ }
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
    } catch (err) {
      setTranscript((p) => [...p, { who: 'ove', text: 'Microphone access denied or unavailable. Use text input below.' }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => (isListening ? stopRecording() : startRecording());

  const handleResponse = (data: any) => {
    if (data.transcription) setTranscript((p) => [...p, { who: 'user', text: data.transcription }]);
    if (data.speech) {
      setTranscript((p) => [...p, { who: 'ove', text: data.speech }]);
      setLastAction(data.speech);
    }
    if (data.artifact) { onArtifactCreated(data.artifact); setLastAction('Artifact generated in Canvas.'); }
    if (data.shell_output) { setShellOutput(data.shell_output); setLastAction('PowerShell executed.'); }
    if (data.audio_base64 && audioRef.current) {
      audioRef.current.src = `data:audio/wav;base64,${data.audio_base64}`;
      audioRef.current.play().catch(() => {});
    }
  };

  const submitAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setLastAction(null); setShellOutput(null);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      const { data } = await axios.post(`${API}/voice/orchestrate`, fd);
      handleResponse(data);
    } catch {
      setTranscript((p) => [...p, { who: 'ove', text: 'Connection to core lost.' }]);
    } finally { setIsProcessing(false); }
  };

  const submitText = async (text: string) => {
    if (!text.trim()) return;
    setInputText('');
    setIsProcessing(true);
    setLastAction(null); setShellOutput(null);
    setTranscript((p) => [...p, { who: 'user', text }]);
    try {
      const fd = new FormData();
      fd.append('text_fallback', text);
      const { data } = await axios.post(`${API}/voice/orchestrate`, fd);
      // transcription echoes our text; skip duplicate
      if (data.speech) { setTranscript((p) => [...p, { who: 'ove', text: data.speech }]); setLastAction(data.speech); }
      if (data.artifact) { onArtifactCreated(data.artifact); setLastAction('Artifact generated in Canvas.'); }
      if (data.shell_output) { setShellOutput(data.shell_output); setLastAction('PowerShell executed.'); }
      if (data.audio_base64 && audioRef.current) { audioRef.current.src = `data:audio/wav;base64,${data.audio_base64}`; audioRef.current.play().catch(() => {}); }
    } catch {
      setTranscript((p) => [...p, { who: 'ove', text: 'Connection to core lost.' }]);
    } finally { setIsProcessing(false); }
  };

  return (
    <div
      className={`fixed top-14 bottom-14 right-0 z-[55] w-80 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="h-full bg-midnight-900/95 backdrop-blur-2xl border-l border-oldgold-500/30 shadow-[0_0_50px_rgba(212,175,55,0.12)] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-midnight-950/50 border-b border-midnight-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-midnight-800 border border-midnight-800">
              <div className={`absolute inset-0 rounded-full blur-sm ${isListening ? 'bg-red-500/50 animate-pulse' : isProcessing ? 'bg-oldgold-500/50 animate-pulse' : 'bg-oldgold-500/30'}`} />
              <Sparkles className="w-4 h-4 text-oldgold-400 relative z-10" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">O.V.E Core</h3>
              <div className="flex items-center space-x-1 text-[9px] font-bold uppercase tracking-widest text-green-400">
                <Eye className="w-3 h-3" /><span>Vision Sync Active</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-midnight-800 rounded-full text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Visualizer */}
        <div className="p-6 flex flex-col items-center justify-center border-b border-midnight-800/50 relative overflow-hidden bg-midnight-950/50">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.15) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
          <div className="relative z-10 flex items-center justify-center h-16 w-full">
            {isListening ? (
              <div className="flex items-end space-x-1 h-10">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="w-1.5 bg-red-500 rounded-full transition-all duration-100"
                    style={{ height: `${Math.max(15, micLevel * 100 * (0.6 + Math.random() * 0.7))}%` }} />
                ))}
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center">
                <Activity className="w-8 h-8 text-oldgold-400 animate-spin" />
                <span className="text-[10px] text-oldgold-400 font-bold uppercase tracking-widest mt-2">Computing…</span>
              </div>
            ) : lastAction ? (
              <div className="text-center">
                <Volume2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-xs text-green-400 font-medium px-2">{lastAction}</p>
              </div>
            ) : (
              <span className="text-xs font-mono text-slate-500 uppercase">Awaiting Directive</span>
            )}
          </div>
        </div>

        {/* Transcript + shell */}
        <div ref={logRef} className="flex-1 overflow-y-auto p-4 bg-midnight-950 space-y-2 text-xs font-mono scroll-smooth">
          {transcript.length === 0 && (
            <p className="text-slate-600 italic text-center mt-4">Tap the mic and speak, or type a command. O.V.E can build UI, run PowerShell, and answer.</p>
          )}
          {transcript.map((t, i) => (
            <div key={i} className={t.who === 'user' ? 'text-slate-400' : 'text-oldgold-400 font-bold'}>
              <span className="opacity-60">{t.who === 'user' ? 'You: ' : 'O.V.E: '}</span>{t.text}
            </div>
          ))}
          {shellOutput && (
            <div className="mt-2 p-2 bg-midnight-900 border border-midnight-800 rounded text-slate-400 text-[10px] overflow-x-auto whitespace-pre-wrap">
              <div className="flex items-center space-x-1 mb-1 text-slate-400"><Terminal className="w-3 h-3" /><span>PowerShell Output</span></div>
              {shellOutput}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-midnight-900 border-t border-midnight-800/50 space-y-3">
          <div className="flex space-x-2">
            <input
              type="text" value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitText(inputText); }}
              placeholder="Type a command…"
              className="flex-1 bg-midnight-950 border border-midnight-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-oldgold-500 text-white"
            />
            <button onClick={() => submitText(inputText)} disabled={!inputText.trim() || isProcessing}
              className="p-2 rounded-xl bg-midnight-800 hover:bg-midnight-700 text-oldgold-400 disabled:opacity-40 transition-colors">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={toggleListening} disabled={isProcessing}
            className={`w-full py-3 rounded-xl flex items-center justify-center space-x-2 font-bold text-sm transition-all shadow-lg disabled:opacity-50 ${isListening ? 'bg-red-600/20 text-red-400 border border-red-500/50' : 'bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.3)]'}`}>
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'STOP & SEND' : 'HOLD TO SPEAK'}</span>
          </button>
        </div>
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};

export default VoiceAgent;
