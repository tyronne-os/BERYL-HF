import React, { useState } from 'react';
import { Minimize2, Cpu, Zap, Download, Box, Info, Settings, Database, Share2, CheckCircle } from 'lucide-react';

const CompactHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bitnet' | 'gguf'>('bitnet');
  const [targetModel, setTargetModel] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  const ggufOptions = [
    { type: 'Q4_K_M', desc: 'Optimal balance of size and quality (Recommended)', size: '4.8GB' },
    { type: 'Q5_K_M', desc: 'High quality, slightly larger size', size: '5.5GB' },
    { type: 'Q8_0', desc: 'Near lossless, massive size', size: '8.2GB' },
    { type: 'IQ3_M', desc: 'Extreme compression for low VRAM', size: '3.1GB' },
  ];

  const handleStartCompression = () => {
    setIsCompressing(true);
    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      setCompressionProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        setIsCompressing(false);
      }
    }, 200);
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-900 text-slate-100">
      {/* Left Selection Panel */}
      <div className="w-80 border-r border-slate-700 bg-slate-950 flex flex-col">
        <div className="p-6 border-b border-slate-800">
           <h2 className="text-lg font-bold flex items-center space-x-2 text-white uppercase tracking-tighter">
             <Minimize2 className="w-5 h-5 text-blue-400" />
             <span>Compact Engine</span>
           </h2>
           <p className="text-[10px] text-slate-500 mt-1 font-bold">1-BIT COMPRESSION & GGUF HUB</p>
        </div>
        
        <div className="p-4 space-y-1">
           <button 
             onClick={() => setActiveTab('bitnet')}
             className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === 'bitnet' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
           >
             <div className="flex items-center space-x-3">
               <Zap className="w-4 h-4" />
               <span className="font-bold text-sm">BitNet 1.58b</span>
             </div>
             <div className="bg-slate-900/50 px-1.5 py-0.5 rounded text-[8px] font-black border border-white/10">1-BIT</div>
           </button>
           
           <button 
             onClick={() => setActiveTab('gguf')}
             className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === 'gguf' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
           >
             <div className="flex items-center space-x-3">
               <Box className="w-4 h-4" />
               <span className="font-bold text-sm">GGUF Quantizer</span>
             </div>
             <div className="bg-slate-900/50 px-1.5 py-0.5 rounded text-[8px] font-black border border-white/10">CPU-READY</div>
           </button>
        </div>

        <div className="mt-auto p-4 border-t border-slate-800">
           <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Storage Destination</div>
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                 <Share2 className="w-3 h-3 text-blue-400" />
                 <span>HF_USER_STORAGE/compact-cache</span>
              </div>
           </div>
        </div>
      </div>

      {/* Main Configuration View */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'bitnet' && (
            <div className="space-y-8">
              <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-8 rounded-3xl border border-blue-500/20">
                <h1 className="text-3xl font-bold mb-4">BitNet 1.58b Architecture</h1>
                <p className="text-slate-400 leading-relaxed max-w-2xl">
                  Deploy massive models with near-zero degradation using 1.58-bit ternary quantization. 
                  This strategy replaces standard float16 weights with ternary values (-1, 0, 1), 
                  massively reducing memory bandwidth and energy consumption.
                </p>
                <div className="flex items-center space-x-4 mt-6">
                   <div className="bg-slate-900/50 px-4 py-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">VRAM Savings</span>
                      <span className="text-xl font-bold text-green-400">~10x Reduction</span>
                   </div>
                   <div className="bg-slate-900/50 px-4 py-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Inference Speed</span>
                      <span className="text-xl font-bold text-blue-400">~4.5x Boost</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                       <Cpu className="w-5 h-5 text-blue-400" />
                       <span>Compression Agent (RAG)</span>
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Target HF Model ID</label>
                        <input 
                          type="text" 
                          placeholder="e.g. meta-llama/Llama-3.1-70B"
                          value={targetModel}
                          onChange={(e) => setTargetModel(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button 
                        onClick={handleStartCompression}
                        disabled={isCompressing || !targetModel}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/40"
                      >
                        {isCompressing ? `Compressing (${compressionProgress}%)...` : 'Initialize 1-Bit Compression'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-start space-x-3">
                     <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                     <p className="text-xs text-slate-400 leading-relaxed italic">
                       The compression agent uses RAG to pull structural data from the model's architecture.json and applies a BitLinear transformation layer locally before uploading to your HF storage.
                     </p>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                   <h3 className="text-lg font-bold mb-6">Pipeline Logistics</h3>
                   <div className="space-y-6">
                      <div className="flex items-center space-x-4">
                         <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">1</div>
                         <div className="flex-1">
                            <p className="text-sm font-bold text-slate-200">Weight Transformation</p>
                            <p className="text-[10px] text-slate-500">Converting FP16 to Ternary (-1, 0, 1)</p>
                         </div>
                         <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="flex items-center space-x-4">
                         <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">2</div>
                         <div className="flex-1">
                            <p className="text-sm font-bold text-slate-200">HF Remote Persistence</p>
                            <p className="text-[10px] text-slate-500">Pushing sharded weights to private repo</p>
                         </div>
                         <div className="w-2 h-2 rounded-full bg-slate-600" />
                      </div>
                      <div className="flex items-center space-x-4">
                         <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">3</div>
                         <div className="flex-1">
                            <p className="text-sm font-bold text-slate-200">Route to Matrix</p>
                            <p className="text-[10px] text-slate-500">Injecting compact model into Dropdown</p>
                         </div>
                         <div className="w-2 h-2 rounded-full bg-slate-600" />
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gguf' && (
            <div className="space-y-8">
               <div className="flex items-center justify-between">
                 <div>
                   <h1 className="text-3xl font-bold">GGUF Quantization Hub</h1>
                   <p className="text-slate-400 mt-2">Optimize models for local inference using llama.cpp strategies.</p>
                 </div>
                 <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2">
                   <Settings className="w-4 h-4" />
                   <span>Global Config</span>
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {ggufOptions.map((opt, i) => (
                   <div key={i} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl hover:border-purple-500/50 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <h4 className="font-bold text-lg text-white font-mono">{opt.type}</h4>
                            <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
                         </div>
                         <span className="text-sm font-bold text-purple-400">{opt.size}</span>
                      </div>
                      <button className="w-full flex items-center justify-center space-x-2 py-2 bg-slate-900 group-hover:bg-purple-600 text-[10px] font-bold rounded-lg transition-colors">
                         <Download className="w-3 h-3" />
                         <span>SELECT THIS METHOD</span>
                      </button>
                   </div>
                 ))}
               </div>

               <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                  <h3 className="text-xl font-bold mb-4 flex items-center space-x-3">
                    <Database className="w-6 h-6 text-slate-500" />
                    <span>Project Routing Registry</span>
                  </h3>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                        <span className="text-sm font-medium">Auto-inject results into Model Selector</span>
                        <div className="w-10 h-5 bg-blue-600 rounded-full relative"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                        <span className="text-sm font-medium">Notify current Project Hub on success</span>
                        <div className="w-10 h-5 bg-slate-700 rounded-full relative"><div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompactHub;
