import React from 'react';
import { Image as ImageIcon, Flame } from 'lucide-react';

interface BottomNavProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setCurrentPage }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <nav className="flex items-center bg-midnight-950/90 backdrop-blur-xl rounded-full p-1.5 border border-oldgold-500/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
        <button 
          onClick={() => setCurrentPage('comfy')}
          className={`nav-flash px-6 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'comfy' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-400 hover:text-emerald-400 hover:bg-midnight-800'}`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>COMFY UI</span>
        </button>
        <div className="w-px h-6 bg-midnight-800 mx-2"></div>
        <button 
          onClick={() => setCurrentPage('fliip')}
          className={`nav-flash px-6 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'fliip' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'text-slate-400 hover:text-red-400 hover:bg-midnight-800'}`}
        >
          <Flame className="w-4 h-4" />
          <span>FLIIP MODE</span>
        </button>
      </nav>
    </div>
  );
};

export default BottomNav;
