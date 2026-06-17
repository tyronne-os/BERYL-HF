import React, { useState } from 'react';
import { Bot, Image as ImageIcon, ShieldAlert, Share2, Workflow, Mic, EyeOff } from 'lucide-react';

const ComfyUIMirror: React.FC = () => {
  const [isGuardrailsDisabled, setIsGuardrailsDisabled] = useState(true);

  return (
    <div className="flex-1 flex overflow-hidden bg-midnight-950 text-slate-100">
      {/* Left Panel: Smol Agents & Voice Controls */}
      <div className="w-80 border-r border-midnight-800 bg-midnight-900 flex flex-col z-10 shrink-0 shadow-2xl">
        <div className="p-6 border-b border-midnight-800">
          <h2 className="text-xl font-bold flex items-center space-x-2 text-white">
            <ImageIcon className="w-6 h-6 text-emerald-400" />
            <span>ComfyUI Bridge</span>
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Fully voice-controlled node architecture. Speak your prompt, and O.V.E.'s underlying 'Smol Agents' will pull models and map nodes automatically.
          </p>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Uncensored Mode Toggle */}
          <div className={`p-4 rounded-2xl border transition-colors ${isGuardrailsDisabled ? 'bg-red-900/20 border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.15)]' : 'bg-midnight-950 border-midnight-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                 <ShieldAlert className={`w-5 h-5 ${isGuardrailsDisabled ? 'text-red-500' : 'text-slate-500'}`} />
                 <span className={`font-bold text-sm ${isGuardrailsDisabled ? 'text-red-400' : 'text-slate-400'}`}>Uncensored Mode</span>
              </div>
              <button 
                onClick={() => setIsGuardrailsDisabled(!isGuardrailsDisabled)}
                className={`w-10 h-5 rounded-full relative transition-colors ${isGuardrailsDisabled ? 'bg-red-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isGuardrailsDisabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              When enabled, safety filters are bypassed, allowing the Hub Fetcher to pull and connect unrestricted video/image models from Hugging Face directly into ComfyUI.
            </p>
          </div>

          <div className="space-y-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Smol Agents</h3>
             
             <div className="bg-midnight-950 border border-midnight-800 p-4 rounded-xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                     <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <Share2 className="w-4 h-4 text-emerald-400" />
                     </div>
                     <div>
                        <h4 className="font-bold text-sm text-slate-200">Hub Fetcher</h4>
                        <p className="text-[9px] text-slate-500 uppercase">Downloads Checkpoints/LoRAs</p>
                     </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               </div>
             </div>

             <div className="bg-midnight-950 border border-midnight-800 p-4 rounded-xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                     <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <Workflow className="w-4 h-4 text-blue-400" />
                     </div>
                     <div>
                        <h4 className="font-bold text-sm text-slate-200">Node Architect</h4>
                        <p className="text-[9px] text-slate-500 uppercase">Wires JSON Node Maps</p>
                     </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
               </div>
             </div>
             
             <div className="bg-midnight-950 border border-midnight-800 p-4 rounded-xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                     <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                        <Mic className="w-4 h-4 text-purple-400" />
                     </div>
                     <div>
                        <h4 className="font-bold text-sm text-slate-200">Prompt Transcriber</h4>
                        <p className="text-[9px] text-slate-500 uppercase">Injects Positive/Negative Prompts</p>
                     </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
               </div>
             </div>
          </div>
        </div>

        <div className="p-6 border-t border-midnight-800 bg-midnight-950/50">
           <div className="bg-oldgold-500/10 border border-oldgold-500/30 rounded-xl p-4 text-center">
              <Mic className="w-6 h-6 text-oldgold-400 mx-auto mb-2" />
              <p className="text-xs text-oldgold-300 font-medium">
                 "O.V.E, find me the best uncensored video model from Hugging Face and connect it to a high-res generation pipeline."
              </p>
           </div>
        </div>
      </div>

      {/* Main ComfyUI Viewport Mockup */}
      <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden flex flex-col">
         {/* Fake ComfyUI Header */}
         <div className="h-10 bg-[#2b2b2b] border-b border-black flex items-center justify-between px-4">
            <div className="flex items-center space-x-4">
               <span className="text-xs font-bold text-slate-300">ComfyUI Pipeline</span>
               <div className="flex space-x-2">
                  <button className="text-[10px] bg-[#3c3c3c] hover:bg-[#4c4c4c] px-2 py-1 rounded text-slate-300">Queue Prompt</button>
                  <button className="text-[10px] bg-[#3c3c3c] hover:bg-[#4c4c4c] px-2 py-1 rounded text-slate-300">Save</button>
                  <button className="text-[10px] bg-[#3c3c3c] hover:bg-[#4c4c4c] px-2 py-1 rounded text-slate-300">Load</button>
               </div>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">127.0.0.1:8188</div>
         </div>

         {/* Node Graph Background */}
         <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_#333_1px,_transparent_0)]" style={{ backgroundSize: '20px 20px' }}>
            
            {/* Mock Nodes Generated by OVE */}
            <div className="absolute top-20 left-20 bg-[#353535] border border-[#555] rounded shadow-2xl w-64">
               <div className="bg-[#444] px-2 py-1 text-xs font-bold text-emerald-400 border-b border-[#555] flex justify-between">
                  <span>Load Checkpoint</span>
                  <span title="Uncensored Enabled"><EyeOff className="w-3 h-3 text-red-400" /></span>
               </div>
               <div className="p-2 space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-300">
                     <span>ckpt_name</span>
                     <span className="bg-[#222] px-1 rounded truncate w-32 text-right">uncensored_video_v3.safetensors</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 text-right mt-2">• MODEL</div>
                  <div className="text-[10px] text-emerald-400 text-right">• CLIP</div>
                  <div className="text-[10px] text-emerald-400 text-right">• VAE</div>
               </div>
            </div>

            {/* Connecting Line */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
               <path d="M 336 150 C 450 150, 450 150, 500 150" stroke="#10b981" strokeWidth="2" fill="none" />
               <path d="M 336 170 C 450 170, 450 250, 500 250" stroke="#10b981" strokeWidth="2" fill="none" />
            </svg>

            <div className="absolute top-10 left-[500px] bg-[#353535] border border-[#555] rounded shadow-2xl w-64 z-10">
               <div className="bg-[#444] px-2 py-1 text-xs font-bold text-slate-200 border-b border-[#555]">
                  CLIP Text Encode (Prompt)
               </div>
               <div className="p-2 space-y-2">
                  <div className="text-[10px] text-emerald-400">• clip</div>
                  <textarea className="w-full bg-[#222] text-slate-300 text-[10px] p-1 border border-[#444] rounded resize-none" rows={4} defaultValue="O.V.E Transcribed: A high resolution cinematic shot of a futuristic cyberpunk city, neon lights, highly detailed..."></textarea>
                  <div className="text-[10px] text-emerald-400 text-right">• CONDITIONING</div>
               </div>
            </div>

            <div className="absolute top-[200px] left-[500px] bg-[#353535] border border-[#555] rounded shadow-2xl w-64 z-10">
               <div className="bg-[#444] px-2 py-1 text-xs font-bold text-slate-200 border-b border-[#555]">
                  KSampler
               </div>
               <div className="p-2 space-y-1">
                  <div className="text-[10px] text-emerald-400">• model</div>
                  <div className="text-[10px] text-emerald-400">• positive</div>
                  <div className="text-[10px] text-emerald-400">• negative</div>
                  <div className="text-[10px] text-emerald-400">• latent_image</div>
               </div>
            </div>

            {/* OVE Feedback Toast */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-midnight-900/90 backdrop-blur border border-oldgold-500/50 text-oldgold-400 px-6 py-3 rounded-full text-xs font-bold shadow-[0_0_20px_rgba(212,175,55,0.2)] flex items-center space-x-3">
               <Bot className="w-4 h-4" />
               <span>O.V.E: "I have fetched the uncensored video model from the Hub and wired the KSampler nodes for you."</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ComfyUIMirror;
