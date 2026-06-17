import React, { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import axios from 'axios';
import { Mic, MicOff, Terminal, Eye, Sparkles, Activity, Volume2, Minimize2 } from 'lucide-react';

interface VoiceAgentProps {
  onArtifactCreated: (artifact: any) => void;
}

const VoiceAgent: React.FC<VoiceAgentProps> = ({ onArtifactCreated }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [shellOutput, setShellOutput] = useState<string | null>(null);
  const [inputText, setInputText] = useState(''); // Fallback text input

  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleListening = () => {
    if (!isListening) {
      setIsListening(true);
      // Mocking audio recording sequence
      setTimeout(() => {
        setIsListening(false);
        handleVoiceSubmit("Simulated voice input: Build me a dashboard and check my active processes.");
      }, 3000);
    } else {
      setIsListening(false);
    }
  };

  const handleVoiceSubmit = async (textFallback: string) => {
    setIsProcessing(true);
    setTranscript(prev => [...prev, `User: ${textFallback}`]);
    setLastAction(null);
    setShellOutput(null);

    try {
      const formData = new FormData();
      formData.append('text_fallback', textFallback);

      const response = await axios.post('http://127.0.0.1:8001/voice/orchestrate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;
      
      if (data.speech) {
        setTranscript(prev => [...prev, `O.V.E: ${data.speech}`]);
        setLastAction(data.speech);
      }

      if (data.artifact) {
        onArtifactCreated(data.artifact);
        setLastAction("Artifact generated in Canvas.");
      }

      if (data.shell_output) {
        setShellOutput(data.shell_output);
        setLastAction("PowerShell script executed successfully.");
      }

      if (data.audio_base64 && audioRef.current) {
        audioRef.current.src = `data:audio/wav;base64,${data.audio_base64}`;
        audioRef.current.play();
      }

    } catch (err) {
      console.error("Voice orchestration failed", err);
      setTranscript(prev => [...prev, `O.V.E: Connection to core lost.`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Draggable handle=".drag-handle" bounds="parent">
      <div className={`fixed z-[100] bottom-12 right-12 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'w-80' : 'w-16 h-16 rounded-full'}`}>
        
        {/* Closed State (Orb) */}
        {!isExpanded && (
          <div 
            onClick={() => setIsExpanded(true)}
            className="w-full h-full relative cursor-pointer group"
          >
            {/* Glowing Aura */}
            <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-1000 ${isListening ? 'bg-red-500/60 scale-150 animate-pulse' : isProcessing ? 'bg-oldgold-500/60 scale-150 animate-pulse' : 'bg-oldgold-500/30 group-hover:scale-125'}`}></div>
            
            {/* Core Orb */}
            <div className={`absolute inset-0 rounded-full border border-white/20 backdrop-blur-md shadow-[0_0_30px_rgba(212,175,55,0.3)] flex items-center justify-center transition-colors ${isListening ? 'bg-red-900/80' : isProcessing ? 'bg-oldgold-900/80' : 'bg-midnight-900/90 hover:bg-midnight-800'}`}>
               {isListening ? (
                 <Mic className="w-6 h-6 text-red-400 animate-bounce" />
               ) : isProcessing ? (
                 <Activity className="w-6 h-6 text-oldgold-400 animate-spin" />
               ) : (
                 <Sparkles className="w-6 h-6 text-oldgold-400" />
               )}
            </div>
            {/* Vision Active Indicator */}
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-midnight-950 rounded-full border border-midnight-800 flex items-center justify-center">
               <Eye className="w-3 h-3 text-green-400" />
            </div>
          </div>
        )}

        {/* Expanded State (Dashboard) */}
        {isExpanded && (
          <div className="bg-midnight-900/95 backdrop-blur-2xl border border-oldgold-500/30 shadow-[0_0_50px_rgba(212,175,55,0.15)] rounded-3xl overflow-hidden flex flex-col">
            
            {/* Header (Draggable) */}
            <div className="drag-handle p-4 bg-midnight-950/50 border-b border-midnight-800/50 flex items-center justify-between cursor-move">
               <div className="flex items-center space-x-3">
                 <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-midnight-800 border border-midnight-800">
                   <div className={`absolute inset-0 rounded-full blur-sm ${isListening ? 'bg-red-500/50 animate-pulse' : isProcessing ? 'bg-oldgold-500/50 animate-pulse' : 'bg-oldgold-500/30'}`}></div>
                   <Sparkles className="w-4 h-4 text-oldgold-400 relative z-10" />
                 </div>
                 <div>
                   <h3 className="text-sm font-bold text-white tracking-tight">O.V.E Core</h3>
                   <div className="flex items-center space-x-1 text-[9px] font-bold uppercase tracking-widest text-green-400">
                     <Eye className="w-3 h-3" />
                     <span>Vision Sync Active</span>
                   </div>
                 </div>
               </div>
               <button onClick={() => setIsExpanded(false)} className="p-1.5 hover:bg-midnight-800 rounded-full text-slate-400 transition-colors">
                 <Minimize2 className="w-4 h-4" />
               </button>
            </div>

            {/* Central Visualizer & Status */}
            <div className="p-6 flex flex-col items-center justify-center border-b border-midnight-800/50 relative overflow-hidden bg-midnight-950/50">
               {/* Animated Background Mesh */}
               <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.15) 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
               
               <div className="relative z-10 flex items-center justify-center h-16 w-full">
                 {isListening ? (
                   <div className="flex items-center space-x-1 h-8">
                     {[1, 2, 3, 4, 5, 6, 7].map(i => (
                       <div key={i} className="w-1.5 bg-red-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}></div>
                     ))}
                   </div>
                 ) : isProcessing ? (
                   <div className="flex flex-col items-center">
                     <Activity className="w-8 h-8 text-oldgold-400 animate-spin" />
                     <span className="text-[10px] text-oldgold-400 font-bold uppercase tracking-widest mt-2">Computing State...</span>
                   </div>
                 ) : lastAction ? (
                   <div className="text-center">
                     <Volume2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                     <p className="text-xs text-emerald-400 font-medium px-4">{lastAction}</p>
                   </div>
                 ) : (
                   <span className="text-xs font-mono text-slate-500 uppercase">Awaiting Directive</span>
                 )}
               </div>
            </div>

            {/* Transcription Log */}
            <div className="h-32 overflow-y-auto p-4 bg-midnight-950 space-y-2 text-xs font-mono scroll-smooth">
              {transcript.map((t, i) => (
                <div key={i} className={`${t.startsWith('User:') ? 'text-slate-400' : 'text-oldgold-400 font-bold'}`}>
                  {t}
                </div>
              ))}
              {shellOutput && (
                <div className="mt-2 p-2 bg-midnight-900 border border-midnight-800 rounded text-slate-500 text-[10px] overflow-x-auto whitespace-pre-wrap">
                  <div className="flex items-center space-x-1 mb-1 text-slate-400"><Terminal className="w-3 h-3"/> <span>PowerShell Execution Log</span></div>
                  {shellOutput}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-midnight-900 flex flex-col space-y-3">
               <div className="flex space-x-2">
                 <input 
                   type="text" 
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') { handleVoiceSubmit(inputText); setInputText(''); } }}
                   placeholder="Type or use voice..."
                   className="flex-1 bg-midnight-950 border border-midnight-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-oldgold-500 text-white"
                 />
               </div>
               <button 
                 onClick={toggleListening}
                 className={`w-full py-3 rounded-xl flex items-center justify-center space-x-2 font-bold text-sm transition-all shadow-lg ${isListening ? 'bg-red-600/20 text-red-500 border border-red-500/50 shadow-red-900/20' : 'bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.3)]'}`}
               >
                 {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                 <span>{isListening ? 'STOP LISTENING' : 'ACTIVATE VOICE'}</span>
               </button>
            </div>

          </div>
        )}
        <audio ref={audioRef} className="hidden" />
      </div>
    </Draggable>
  );
};

export default VoiceAgent;
