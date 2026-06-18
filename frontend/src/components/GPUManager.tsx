import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, Activity, Server, Gauge, MemoryStick, Thermometer, Zap, ExternalLink, RefreshCw } from 'lucide-react';
import { API } from '../api';

interface Stats { cpu_percent: number; cpu_count: number; ram_used_gb: number; ram_total_gb: number; ram_percent: number; node_mem_gb: number; py_mem_gb: number; }
interface Gpu { name: string; mem_used_mb: number; mem_total_mb: number; mem_percent: number; util_percent: number; temp_c: number; power_w: number; }
interface GpuResp { gpus: Gpu[]; available: boolean; vendor?: string; adapter?: string; detail?: string; }
interface SpaceItem { name: string; hardware: string; duration: string; cost: number; }

// Real Hugging Face Spaces hardware tiers (public pricing, $/hr)
const HF_TIERS = [
  { id: 'zero', name: 'ZeroGPU (H200 slice)', vram: 'Dynamic', price: 'Free (PRO)' },
  { id: 'cpu-basic', name: 'CPU Basic', vram: '—', price: 'Free' },
  { id: 't4-small', name: 'T4 small', vram: '16 GB', price: '$0.40/hr' },
  { id: 'l4', name: 'L4', vram: '24 GB', price: '$0.80/hr' },
  { id: 'a10g-small', name: 'A10G small', vram: '24 GB', price: '$1.00/hr' },
  { id: 'a100', name: 'A100 large', vram: '80 GB', price: '$4.00/hr' },
];

const Ring: React.FC<{ pct: number; label: string; value: string; color: string }> = ({ pct, label, value, color }) => {
  const r = 42, c = 2 * Math.PI * r, off = c - (Math.min(pct, 100) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1a0b2e" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white">{value}</span>
          <span className="text-[9px] text-slate-500 uppercase font-bold">{label}</span>
        </div>
      </div>
    </div>
  );
};

const GPUManager: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [gpu, setGpu] = useState<GpuResp | null>(null);
  const [spaces, setSpaces] = useState<{ items: SpaceItem[]; total: number } | null>(null);

  const poll = async () => {
    try { const { data } = await axios.get<Stats>(`${API}/system/stats`); setStats(data); } catch {}
    try { const { data } = await axios.get<GpuResp>(`${API}/system/gpu`); setGpu(data); } catch {}
  };

  useEffect(() => {
    poll();
    axios.get(`${API}/hf/billing`).then(({ data }) => setSpaces({ items: data.compute_usage.items, total: data.compute_usage.spaces_total })).catch(() => {});
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Cpu className="w-8 h-8 text-cyan-400" />
              <span>Compute Monitor</span>
            </h1>
            <p className="text-slate-400 mt-2">Live local telemetry and Hugging Face Spaces compute.</p>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-green-400">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" /></span>
            <span>Live · 2s refresh</span>
          </div>
        </div>

        {/* Live local telemetry */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-6 flex items-center space-x-2"><Activity className="w-5 h-5 text-cyan-400" /><span>This Machine</span></h2>
          {stats ? (
            <div className="flex items-center justify-around flex-wrap gap-6">
              <Ring pct={stats.cpu_percent} label={`${stats.cpu_count} cores`} value={`${Math.round(stats.cpu_percent)}%`} color="#22d3ee" />
              <Ring pct={stats.ram_percent} label={`${stats.ram_total_gb} GB`} value={`${Math.round(stats.ram_percent)}%`} color="#D4AF37" />
              <div className="grid grid-cols-2 gap-4 flex-1 min-w-[280px]">
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1"><MemoryStick className="w-4 h-4" /><span>RAM Used</span></div>
                  <p className="text-xl font-bold">{stats.ram_used_gb} <span className="text-sm text-slate-500">/ {stats.ram_total_gb} GB</span></p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1"><Server className="w-4 h-4" /><span>Node (Vite)</span></div>
                  <p className="text-xl font-bold">{stats.node_mem_gb} <span className="text-sm text-slate-500">GB</span></p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1"><Cpu className="w-4 h-4" /><span>Python (API)</span></div>
                  <p className="text-xl font-bold">{stats.py_mem_gb} <span className="text-sm text-slate-500">GB</span></p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1"><Gauge className="w-4 h-4" /><span>CPU Load</span></div>
                  <p className="text-xl font-bold">{Math.round(stats.cpu_percent)}<span className="text-sm text-slate-500">%</span></p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Reading telemetry…</div>
          )}
        </div>

        {/* GPU */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-6 flex items-center space-x-2"><Zap className="w-5 h-5 text-green-400" /><span>Graphics Adapter</span></h2>
          {gpu && gpu.available ? (
            <div className="space-y-4">
              {gpu.gpus.map((g, i) => (
                <div key={i} className="bg-slate-900/50 rounded-xl p-5 border border-green-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center space-x-2"><Zap className="w-4 h-4 text-green-400" /><span>{g.name}</span></h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">CUDA</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div><div className="flex items-center space-x-1 text-xs text-slate-400 mb-1"><MemoryStick className="w-3 h-3" /><span>VRAM</span></div><p className="font-bold">{Math.round(g.mem_used_mb)}/{Math.round(g.mem_total_mb)} MB</p></div>
                    <div><div className="flex items-center space-x-1 text-xs text-slate-400 mb-1"><Gauge className="w-3 h-3" /><span>Util</span></div><p className="font-bold">{g.util_percent}%</p></div>
                    <div><div className="flex items-center space-x-1 text-xs text-slate-400 mb-1"><Thermometer className="w-3 h-3" /><span>Temp</span></div><p className="font-bold">{g.temp_c}°C</p></div>
                    <div><div className="flex items-center space-x-1 text-xs text-slate-400 mb-1"><Zap className="w-3 h-3" /><span>Power</span></div><p className="font-bold">{g.power_w} W</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700"><Cpu className="w-5 h-5 text-slate-400" /></div>
                <div>
                  <p className="font-bold text-slate-200">{gpu?.adapter || 'Detecting…'}</p>
                  <p className="text-xs text-slate-500">Integrated graphics · no dedicated CUDA device</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">INTEGRATED</span>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-4">For heavy generative workloads, deploy to a Hugging Face Spaces GPU below — your local machine has no CUDA device.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* HF Spaces compute usage (real, from billing mirror) */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center space-x-2"><Server className="w-5 h-5 text-oldgold-400" /><span>HF Spaces Compute</span></h2>
              {spaces && <span className="text-lg font-bold text-oldgold-400">${spaces.total.toFixed(2)}</span>}
            </div>
            {spaces ? (
              <div className="space-y-3">
                {spaces.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <div className="min-w-0"><p className="text-sm font-bold text-slate-200 truncate">{it.name}</p><p className="text-[11px] text-slate-500"><span className="text-cyan-400 font-bold">{it.hardware}</span> · {it.duration}</p></div>
                    <span className="font-mono text-oldgold-400 font-bold shrink-0 ml-3">${it.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-600 italic">Loading…</p>}
          </div>

          {/* HF hardware tiers reference */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center space-x-2"><Gauge className="w-5 h-5 text-cyan-400" /><span>HF Spaces Hardware</span></h2>
            <div className="space-y-2">
              {HF_TIERS.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-700/40">
                  <div className="flex items-center space-x-3"><div className="w-2 h-2 rounded-full bg-cyan-500" /><span className="font-bold text-sm">{t.name}</span><span className="text-[10px] text-slate-500">{t.vram}</span></div>
                  <span className="text-sm font-mono text-slate-300">{t.price}</span>
                </div>
              ))}
            </div>
            <a href="https://huggingface.co/docs/hub/spaces-gpus" target="_blank" rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center space-x-2 bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 font-bold py-2.5 rounded-xl transition-all text-sm">
              <span>Manage Space Hardware on HF</span><ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPUManager;
