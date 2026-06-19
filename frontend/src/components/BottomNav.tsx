import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Image as ImageIcon, Flame, Shield, Users, DollarSign } from 'lucide-react';
import { API } from '../api';

interface BottomNavProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
  selectedModel?: string;
}

interface CurrentCost {
  model: string;
  session_cost: number;
  session_calls: number;
  session_tokens: number;
  lifetime_cost: number;
  favorite: boolean;
  is_local: boolean;
}

// ── Bottom-left live cost of the model currently in use ──────────────────────
const CurrentModelCost: React.FC<{ model: string }> = ({ model }) => {
  const [c, setC] = useState<CurrentCost | null>(null);

  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    const fetchCost = async () => {
      try {
        const { data } = await axios.get<CurrentCost>(`${API}/usage/current`, { params: { model } });
        if (!cancelled) setC(data);
      } catch { /* backend warming */ }
    };
    fetchCost();
    const t = setInterval(fetchCost, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [model]);

  const name = model.split('/').pop();
  const local = c?.is_local;

  return (
    <div className="absolute left-3 bottom-2.5 flex items-center gap-2 bg-midnight-950/90 border border-midnight-800 rounded-full pl-2.5 pr-3 py-1.5 backdrop-blur-sm"
         title={`Current model: ${model}\nSession: $${(c?.session_cost ?? 0).toFixed(5)} · ${c?.session_calls ?? 0} calls · ${(c?.session_tokens ?? 0).toLocaleString()} tok\nLifetime: $${(c?.lifetime_cost ?? 0).toFixed(4)}`}>
      <span className={`flex items-center justify-center w-5 h-5 rounded-full ${local ? 'bg-green-500/15 text-green-400' : 'bg-oldgold-500/15 text-oldgold-400'}`}>
        <DollarSign className="w-3 h-3" />
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-bold text-slate-300 max-w-[140px] truncate">{name}</span>
        <span className="text-[9px] font-mono mt-0.5" style={{ color: local ? '#4ade80' : '#d4af37' }}>
          {local ? 'FREE · local' : `$${(c?.session_cost ?? 0).toFixed(5)} session`}
        </span>
      </div>
      {c?.favorite && <span className="text-rose-400 text-[10px]">♥</span>}
    </div>
  );
};

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setCurrentPage, selectedModel }) => {
  return (
    <footer className="shrink-0 relative flex items-center justify-center py-2.5 bg-midnight-900 border-t border-midnight-800 z-40">
      {selectedModel && <CurrentModelCost model={selectedModel} />}
      <nav className="flex items-center bg-midnight-950/90 backdrop-blur-xl rounded-full p-1.5 border border-oldgold-500/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
        <button
          onClick={() => setCurrentPage('krewe')}
          className={`nav-flash px-6 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-2 ${
            currentPage === 'krewe'
              ? 'bg-gradient-to-r from-oldgold-500 to-amber-500 text-midnight-950 shadow-[0_0_20px_rgba(212,175,55,0.5)]'
              : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>KREWE</span>
          {currentPage !== 'krewe' && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-oldgold-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-oldgold-500" />
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-midnight-800 mx-2" />

        <button
          onClick={() => setCurrentPage('comfy')}
          className={`nav-flash px-6 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'comfy' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-400 hover:text-emerald-400 hover:bg-midnight-800'}`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>COMFY UI</span>
        </button>

        <div className="w-px h-6 bg-midnight-800 mx-2" />

        <button
          onClick={() => setCurrentPage('fliip')}
          className={`nav-flash px-6 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'fliip' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'text-slate-400 hover:text-red-400 hover:bg-midnight-800'}`}
        >
          <Flame className="w-4 h-4" />
          <span>FLIIP MODE</span>
        </button>

        <div className="w-px h-6 bg-midnight-800 mx-2" />

        <button
          onClick={() => setCurrentPage('sherman')}
          className={`nav-flash px-6 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-2 ${
            currentPage === 'sherman'
              ? 'bg-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.45)] border border-green-500/50'
              : 'text-slate-400 hover:text-green-400 hover:bg-midnight-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>GEN SHERMAN</span>
          {currentPage !== 'sherman' && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
          )}
        </button>
      </nav>
    </footer>
  );
};

export default BottomNav;
