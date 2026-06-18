import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Minimize2, Box, RefreshCw, HardDrive, Layers, Cpu, Info } from 'lucide-react';
import { API } from '../api';

interface OllamaModel { name: string; size: number; }
interface ModelDetail { name: string; family?: string; parameter_size?: string; quantization_level?: string; format?: string; error?: string; }

// Reference: what each GGUF quant level trades off (real llama.cpp quant table)
const QUANT_INFO: Record<string, { bits: string; note: string }> = {
  Q2_K:   { bits: '~2.6', note: 'Extreme compression, noticeable quality loss' },
  Q3_K_M: { bits: '~3.9', note: 'Small, some quality loss' },
  Q4_0:   { bits: '~4.3', note: 'Legacy 4-bit, fast' },
  Q4_K_M: { bits: '~4.8', note: 'Best size/quality balance (recommended)' },
  Q5_K_M: { bits: '~5.6', note: 'High quality, larger' },
  Q6_K:   { bits: '~6.6', note: 'Near-lossless' },
  Q8_0:   { bits: '~8.5', note: 'Almost full precision, large' },
  F16:    { bits: '16', note: 'Full half-precision, no quantization' },
};

const CompactHub: React.FC = () => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [details, setDetails] = useState<Record<string, ModelDetail>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/ollama/tags`);
      const ms: OllamaModel[] = data.models || [];
      setModels(ms);
      const entries = await Promise.all(ms.map(async (m) => {
        try { const { data: d } = await axios.get(`${API}/ollama/show?name=${encodeURIComponent(m.name)}`); return [m.name, d] as const; }
        catch { return [m.name, { name: m.name, error: 'unavailable' }] as const; }
      }));
      setDetails(Object.fromEntries(entries));
    } catch { /* ollama offline */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalSize = models.reduce((s, m) => s + m.size, 0);

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3"><Minimize2 className="w-8 h-8 text-cyan-400" /><span>Compact Engine</span></h1>
            <p className="text-slate-400 mt-2 text-sm">Real GGUF quantization inspector for your local models.</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Total Footprint</p>
              <p className="text-xl font-bold text-cyan-400">{(totalSize / 1e9).toFixed(2)} GB</p>
            </div>
            <button onClick={load} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span></button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Inspecting local models…</div>
        ) : models.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl"><HardDrive className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No local models found. Start Ollama on :11434 and pull a model.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {models.map((m) => {
              const d = details[m.name] || {};
              const q = d.quantization_level || '—';
              const qi = QUANT_INFO[q] || null;
              return (
                <div key={m.name} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0"><Box className="w-5 h-5 text-cyan-400" /></div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base truncate">{m.name.split(':')[0]}</h3>
                        <span className="text-[10px] text-slate-500 font-mono">{m.name.split(':')[1] || 'latest'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">{q}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50"><div className="flex items-center space-x-1 text-[9px] text-slate-500 uppercase font-bold mb-1"><HardDrive className="w-3 h-3" /><span>Disk</span></div><p className="text-sm font-bold">{(m.size / 1e9).toFixed(2)} GB</p></div>
                    <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50"><div className="flex items-center space-x-1 text-[9px] text-slate-500 uppercase font-bold mb-1"><Cpu className="w-3 h-3" /><span>Params</span></div><p className="text-sm font-bold">{d.parameter_size || '—'}</p></div>
                    <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50"><div className="flex items-center space-x-1 text-[9px] text-slate-500 uppercase font-bold mb-1"><Layers className="w-3 h-3" /><span>Family</span></div><p className="text-sm font-bold truncate">{d.family || '—'}</p></div>
                  </div>
                  {qi && (
                    <div className="bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-700/40 flex items-start space-x-2">
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-400 leading-tight"><span className="font-bold text-slate-300">{qi.bits} bits/weight</span> — {qi.note}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-xs text-slate-400 leading-relaxed">
          <Info className="w-4 h-4 text-cyan-400 inline mr-2" />
          Every local model above is GGUF-quantized — that's what lets a multi-billion-parameter model run on this machine.
          To build a custom quantized model with your own personality, use <span className="text-red-400 font-bold">FLIIP MODE</span>'s forge.
          1-bit BitNet training requires a CUDA GPU (use FLIIP MODE's GPU Forge).
        </div>
      </div>
    </div>
  );
};

export default CompactHub;
