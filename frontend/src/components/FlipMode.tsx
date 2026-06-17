import React, { useState } from 'react';
import { Flame, GitMerge, Sliders, UploadCloud, Target, ShieldOff, Download } from 'lucide-react';

const FlipMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sft' | 'merge' | 'prune'>('sft');

  const features = [
    { title: "Continuous Pre-Training (CPT)", desc: "Inject domain-specific knowledge into base weights." },
    { title: "SFT Visualizer", desc: "Supervised Fine-Tuning with real-time loss curves." },
    { title: "DPO/RLHF Loop", desc: "Direct Preference Optimization orchestration." },
    { title: "LoRA Extraction", desc: "Extract low-rank adapters from full fine-tunes." },
    { title: "SLERP Interpolation", desc: "Spherical Linear Interpolation for smooth merging." },
    { title: "TIES Merging", desc: "Trim, Elect, and Merge for task-specific models." },
    { title: "Franker-Merging", desc: "Layer-by-layer stitching across different architectures." },
    { title: "Gradient Checkpointing", desc: "Memory optimization toggle for large batches." },
    { title: "Synthetic Generation", desc: "Qwen-powered dataset expansion." },
    { title: "Toxic-Sweep Ablation", desc: "Vector editing to remove alignment/guardrails." },
    { title: "Modelfile Node Editor", desc: "Visual builder for Ollama Modelfiles." },
    { title: "GGUF Export", desc: "On-the-fly conversion to quantized formats." },
    { title: "Mixed Precision Cast", desc: "FP8/FP4 casting for constrained VRAM." },
    { title: "Tokenizer Expansion", desc: "Add custom tokens to the vocabulary." },
    { title: "Prompt Injection Lock", desc: "Hardcode system prompts directly into weights." },
    { title: "Evaluator Arena", desc: "Auto-test merged models against benchmarks." },
    { title: "MoE Gate Builder", desc: "Route specific inputs to specialized expert layers." },
    { title: "Magnitude Pruning", desc: "Sparsify weights to increase inference speed." },
    { title: "Hardware Auto-Map", desc: "Balance model layers across multiple GPUs." },
    { title: "Cross-Architecture Merge", desc: "Experimental stitching (e.g., Llama + Mistral)." },
    { title: "Real-time Telemetry", desc: "Live tracking of training loss and gradients." },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-midnight-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-midnight-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-red-500 flex items-center space-x-3 tracking-tighter">
              <Flame className="w-10 h-10" />
              <span>FLIIP MODE</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
              The ultimate custom model builder. Upload any checkpoint, strip guardrails via ablation, inject synthetic data, and franken-merge architectures layer-by-layer.
            </p>
          </div>
          <div className="flex space-x-2">
            <button className="bg-midnight-900 border border-red-500/30 hover:bg-red-900/20 text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.1)] flex items-center space-x-2">
               <UploadCloud className="w-4 h-4" />
               <span>DROP MODEL</span>
            </button>
            <button className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center space-x-2">
               <Download className="w-4 h-4" />
               <span>PULL FROM HF</span>
            </button>
          </div>
        </div>

        {/* Builder Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           
           {/* Sidebar Controls */}
           <div className="lg:col-span-1 space-y-2">
             <button onClick={() => setActiveTab('sft')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'sft' ? 'bg-red-600 text-white' : 'bg-midnight-900 text-slate-400 hover:bg-midnight-800'}`}>
                <Target className="w-4 h-4" />
                <span>Fine-Tuning (SFT)</span>
             </button>
             <button onClick={() => setActiveTab('merge')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'merge' ? 'bg-red-600 text-white' : 'bg-midnight-900 text-slate-400 hover:bg-midnight-800'}`}>
                <GitMerge className="w-4 h-4" />
                <span>Model Merging</span>
             </button>
             <button onClick={() => setActiveTab('prune')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'prune' ? 'bg-red-600 text-white' : 'bg-midnight-900 text-slate-400 hover:bg-midnight-800'}`}>
                <Sliders className="w-4 h-4" />
                <span>Weight Pruning</span>
             </button>
             
             <div className="mt-8 p-4 bg-midnight-900 border border-midnight-800 rounded-xl">
               <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Loaded Weights</h4>
               <div className="space-y-2">
                  <div className="bg-midnight-950 border border-midnight-800 p-2 rounded text-xs font-mono text-slate-300 flex justify-between">
                     <span>llama-3-8b.safetensors</span>
                     <span className="text-red-400">BASE</span>
                  </div>
                  <div className="bg-midnight-950 border border-midnight-800 p-2 rounded text-xs font-mono text-slate-300 flex justify-between">
                     <span>uncensored_v4.lora</span>
                     <span className="text-blue-400">ADAPTER</span>
                  </div>
               </div>
             </div>
           </div>

           {/* Main Work Area */}
           <div className="lg:col-span-3">
              {activeTab === 'sft' && (
                 <div className="bg-midnight-900 border border-midnight-800 rounded-2xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-2">
                       <ShieldOff className="w-6 h-6 text-red-500" />
                       <span>Toxic-Sweep Ablation & SFT</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                       <div className="bg-midnight-950 p-4 rounded-xl border border-red-500/20">
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Vector Ablation Target</h4>
                          <p className="text-xs text-slate-400 mb-4">Select refusal vectors to zero out.</p>
                          <div className="space-y-2">
                             <label className="flex items-center space-x-2 text-sm text-slate-300"><input type="checkbox" defaultChecked className="accent-red-500" /> <span>"As an AI language model..."</span></label>
                             <label className="flex items-center space-x-2 text-sm text-slate-300"><input type="checkbox" defaultChecked className="accent-red-500" /> <span>NSFW Refusal Vectors</span></label>
                             <label className="flex items-center space-x-2 text-sm text-slate-300"><input type="checkbox" defaultChecked className="accent-red-500" /> <span>Political Alignment Guardrails</span></label>
                          </div>
                       </div>
                       <div className="bg-midnight-950 p-4 rounded-xl border border-midnight-800">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Live Loss Telemetry</h4>
                          <div className="h-24 w-full flex items-end space-x-1 opacity-80">
                             {[40, 35, 30, 28, 22, 18, 15, 12, 10, 8, 7, 6].map((h, i) => (
                               <div key={i} className="bg-red-500 w-full rounded-t" style={{ height: `${h}%` }}></div>
                             ))}
                          </div>
                       </div>
                    </div>
                    <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                       INITIATE FINE-TUNE OVERRIDE
                    </button>
                 </div>
              )}
              
              {activeTab === 'merge' && (
                 <div className="bg-midnight-900 border border-midnight-800 rounded-2xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-2">
                       <GitMerge className="w-6 h-6 text-red-500" />
                       <span>Franker-Merging Pipeline</span>
                    </h2>
                    <div className="flex items-center justify-center space-x-4 mb-8">
                       <div className="w-32 bg-midnight-950 p-3 rounded-lg border border-red-500/50 text-center">
                          <span className="text-xs font-bold text-red-400 block mb-1">Model A</span>
                          <span className="text-[10px] text-slate-300">Llama-3-8b</span>
                       </div>
                       <div className="text-slate-500 text-xs font-bold">SLERP (0.5)</div>
                       <div className="w-32 bg-midnight-950 p-3 rounded-lg border border-blue-500/50 text-center">
                          <span className="text-xs font-bold text-blue-400 block mb-1">Model B</span>
                          <span className="text-[10px] text-slate-300">Mistral-Nemo</span>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div>
                          <label className="text-xs text-slate-400 font-bold mb-2 block">Interpolation Alpha (Weighting)</label>
                          <input type="range" className="w-full accent-red-500" />
                       </div>
                       <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                          EXECUTE CROSS-ARCHITECTURE MERGE
                       </button>
                    </div>
                 </div>
              )}
           </div>
        </div>

        {/* Feature Matrix Grid */}
        <div className="mt-12">
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">The 20+ Advanced Capabilities</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f, i) => (
                 <div key={i} className="bg-midnight-900 border border-midnight-800 p-4 rounded-xl hover:border-red-500/30 transition-colors">
                    <h4 className="font-bold text-slate-200 text-sm mb-1">{f.title}</h4>
                    <p className="text-[10px] text-slate-400">{f.desc}</p>
                 </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};

export default FlipMode;
