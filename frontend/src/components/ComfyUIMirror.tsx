import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Image as ImageIcon, RefreshCw, ExternalLink, Power, Layers, Cpu, MemoryStick, Copy, Check } from 'lucide-react';
import { API } from '../api';

interface Status { online: boolean; url: string; stats?: any; }

const ComfyUIMirror: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const { data } = await axios.get<Status>(`${API}/comfy/status`);
      setStatus(data);
      if (data.online) {
        const m = await axios.get(`${API}/comfy/models`);
        setCheckpoints(m.data.checkpoints || []);
      }
    } catch {
      setStatus({ online: false, url: 'http://127.0.0.1:8188' });
    } finally { setChecking(false); }
  };

  useEffect(() => {
    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, []);

  const url = status?.url || 'http://127.0.0.1:8188';
  const dev = status?.stats?.devices?.[0];

  const copyCmd = () => {
    navigator.clipboard.writeText('python main.py --listen 127.0.0.1 --port 8188').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-midnight-950 text-slate-100">
      {/* Sidebar */}
      <div className="w-80 border-r border-midnight-800 bg-midnight-900 flex flex-col z-10 shrink-0">
        <div className="p-6 border-b border-midnight-800">
          <h2 className="text-xl font-bold flex items-center space-x-2 text-white">
            <ImageIcon className="w-6 h-6 text-cyan-400" />
            <span>ComfyUI Bridge</span>
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Live connection to your local ComfyUI server. Generate directly inside Beryl when ComfyUI is running on :8188.
          </p>
        </div>

        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Connection status */}
          <div className={`p-4 rounded-2xl border ${status?.online ? 'bg-green-900/15 border-green-500/40' : 'bg-midnight-950 border-midnight-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Power className={`w-5 h-5 ${status?.online ? 'text-green-400' : 'text-slate-500'}`} />
                <span className={`font-bold text-sm ${status?.online ? 'text-green-400' : 'text-slate-400'}`}>
                  {checking ? 'Checking…' : status?.online ? 'Connected' : 'Offline'}
                </span>
              </div>
              <button onClick={check} className="text-slate-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /></button>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-2">{url}</p>
          </div>

          {status?.online && dev && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Device</h3>
              <div className="bg-midnight-950 border border-midnight-800 p-3 rounded-xl">
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-200 mb-2"><Cpu className="w-4 h-4 text-cyan-400" /><span className="truncate">{dev.name}</span></div>
                <div className="flex items-center justify-between text-[11px] text-slate-400"><span className="flex items-center space-x-1"><MemoryStick className="w-3 h-3" /><span>VRAM</span></span><span className="font-mono">{Math.round((dev.vram_free || 0) / 1024 / 1024)} / {Math.round((dev.vram_total || 0) / 1024 / 1024)} MB</span></div>
              </div>
            </div>
          )}

          {status?.online && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-1"><Layers className="w-3 h-3" /><span>Checkpoints ({checkpoints.length})</span></h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {checkpoints.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic">No checkpoints found in models/checkpoints.</p>
                ) : checkpoints.map((c) => (
                  <div key={c} className="bg-midnight-950 border border-midnight-800 px-3 py-2 rounded-lg text-[11px] font-mono text-slate-300 truncate" title={c}>{c}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {status?.online && (
          <div className="p-6 border-t border-midnight-800">
            <a href={url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl transition-all text-sm">
              <span>Open in new tab</span><ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Main viewport — real ComfyUI iframe or honest offline state */}
      <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden">
        {status?.online ? (
          <iframe src={url} title="ComfyUI" className="w-full h-full border-0" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-midnight-900 border border-midnight-800 flex items-center justify-center mb-6">
              <ImageIcon className="w-10 h-10 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-200 mb-2">ComfyUI not detected</h2>
            <p className="text-slate-400 max-w-md mb-6 text-sm leading-relaxed">
              Beryl bridges to a real ComfyUI instance. Start ComfyUI on port 8188 and this panel will embed it live — checkpoints, queue, and the full node graph.
            </p>
            <div className="bg-midnight-950 border border-midnight-800 rounded-xl px-4 py-3 font-mono text-sm text-cyan-400 flex items-center space-x-3">
              <span>python main.py --listen 127.0.0.1 --port 8188</span>
              <button onClick={copyCmd} className="text-slate-500 hover:text-slate-300">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>
            </div>
            <button onClick={check} className="mt-6 flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /><span>Re-check connection</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComfyUIMirror;
