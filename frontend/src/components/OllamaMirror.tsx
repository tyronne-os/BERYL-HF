import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Download, Play, Cpu, Layers, HardDrive, Search, Terminal, ShieldCheck } from 'lucide-react';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface OllamaMirrorProps {
  onSelectModel: (modelId: string) => void;
  navigateTo: (page: 'chat' | 'trending' | 'spaces' | 'gpu' | 'cost' | 'studio' | 'cli' | 'docs' | 'compact' | 'ollama') => void;
}

const OllamaMirror: React.FC<OllamaMirrorProps> = ({ onSelectModel, navigateTo }) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullInput, setPullInput] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState<string | null>(null);

  const fetchModels = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8001/ollama/tags');
      if (response.data && response.data.models) {
        setModels(response.data.models);
      }
    } catch (err) {
      console.error("Failed to fetch Ollama models", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    // Auto refresh every 10s to catch new pulls
    const interval = setInterval(fetchModels, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePull = async () => {
    if (!pullInput.trim()) return;
    setIsPulling(true);
    setPullStatus('Initializing pull sequence...');
    try {
      await axios.post('http://127.0.0.1:8001/ollama/pull', { name: pullInput.trim() });
      setPullStatus(`Pulling ${pullInput.trim()} in the background...`);
      setPullInput('');
      // It will auto-refresh via the interval
    } catch (err) {
      console.error("Failed to pull model", err);
      setPullStatus('Failed to initiate pull.');
    } finally {
      setTimeout(() => {
        setIsPulling(false);
        setPullStatus(null);
      }, 3000);
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2) + ' GB';
  };

  const handleActivate = (modelName: string) => {
    // We prepend 'ollama/' so the backend knows to route to local Ollama instead of HF
    onSelectModel(`ollama/${modelName}`);
    navigateTo('chat');
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Hero Section */}
      <div className="relative border-b border-slate-800 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9InRyYW5zcGFyZW50Ii8+CjxwYXRoIGQ9Ik0wIDEwbDQwIDIwTTAgMzBsNDAtMjAiIHN0cm9rZT0iIzFmMjkzNyIvPgo8L3N2Zz4=')] opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/40 to-slate-900 z-0"></div>
        <div className="max-w-6xl mx-auto px-8 py-12 relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold flex items-center space-x-3 text-white mb-2">
              <Server className="w-10 h-10 text-emerald-400" />
              <span>Ollama Local Engine</span>
            </h1>
            <p className="text-emerald-100/70 max-w-xl text-sm leading-relaxed">
              Beryl HF natively integrates with your local Ollama daemon. Pull open-weight models, manage your localized VRAM footprint, and instantly switch your coding pipeline entirely off-grid.
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <div className="text-center">
              <div className="text-3xl font-black text-emerald-400 font-mono">{models.length}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Local Models</div>
            </div>
            <div className="h-12 w-px bg-slate-700"></div>
            <div className="text-center">
              <div className="text-3xl font-black text-white flex items-center justify-center space-x-1"><ShieldCheck className="w-6 h-6 text-emerald-500" /></div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">100% Private</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Pull & Config */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-emerald-500/30 p-6 shadow-[0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <Download className="w-5 h-5 text-emerald-400" />
              <span>Pull New Model</span>
            </h2>
            <div className="space-y-4 relative z-10">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">Model Tag (e.g., qwen2.5-coder:7b)</label>
                <div className="relative">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" />
                  <input 
                    type="text" 
                    placeholder="llama3, mistral, phi3..."
                    value={pullInput}
                    onChange={(e) => setPullInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-emerald-50 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              <button 
                onClick={handlePull}
                disabled={isPulling || !pullInput.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/20"
              >
                {isPulling ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Download className="w-4 h-4" />}
                <span>{isPulling ? 'INITIATING...' : 'PULL FROM REGISTRY'}</span>
              </button>
              {pullStatus && (
                <div className="text-[10px] font-mono text-emerald-400 bg-emerald-900/20 p-2 rounded border border-emerald-500/20 text-center">
                  {pullStatus}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center space-x-2">
              <Cpu className="w-4 h-4" />
              <span>Hardware Allocation</span>
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">VRAM Usage Target</span>
                  <span className="text-emerald-400 font-bold font-mono">12.4 GB</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div className="h-full bg-emerald-500 w-[65%]"></div>
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                Ollama automatically offloads layers to your GPU. Ensure your selected model fits within your physical VRAM to prevent severe latency drops during coding cycles.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Model Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <Layers className="w-5 h-5 text-slate-400" />
              <span>Local Model Registry</span>
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search local models..."
                className="w-full bg-slate-900 border border-slate-800 rounded-full pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-slate-600 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-3xl">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Querying Daemon...</span>
              </div>
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50 text-center px-6">
              <HardDrive className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-300 mb-1">No Local Models Found</h3>
              <p className="text-sm text-slate-500 max-w-md">Your Ollama registry is empty or the daemon isn't running on port 11434. Use the pull interface to download a model like <code>qwen2.5-coder:7b</code>.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((model, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-slate-800 flex items-center justify-center border border-emerald-500/10">
                        <Server className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight truncate w-32" title={model.name}>
                          {model.name.split(':')[0]}
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded">
                          {model.name.split(':')[1] || 'latest'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <div className="bg-slate-950 rounded-lg p-2 border border-slate-800/50">
                      <span className="block text-[9px] text-slate-500 uppercase font-bold">Disk Footprint</span>
                      <span className="text-sm font-bold text-slate-300 font-mono">{formatSize(model.size)}</span>
                    </div>
                    <div className="bg-slate-950 rounded-lg p-2 border border-slate-800/50">
                      <span className="block text-[9px] text-slate-500 uppercase font-bold">Architecture</span>
                      <span className="text-sm font-bold text-slate-300">GGUF Quant</span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <button 
                      onClick={() => handleActivate(model.name)}
                      className="w-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      <Play className="w-3 h-3" />
                      <span>ACTIVATE FOR CODING</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OllamaMirror;
