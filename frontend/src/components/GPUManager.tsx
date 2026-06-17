import React, { useState } from 'react';
import { Cpu, Clock, Activity, ChevronRight, Zap } from 'lucide-react';

interface GPUOption {
  id: string;
  name: string;
  price: string;
  status: 'available' | 'busy' | 'offline';
}

const GPUManager: React.FC = () => {
  const [selectedGpu, setSelectedGpu] = useState<string>('zero-gpu');
  const [sleepTimer, setSleepTimer] = useState<number>(30);
  const [selectedProject, setSelectedProject] = useState<string>('hf-desktop-client');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const gpuOptions: GPUOption[] = [
    { id: 'zero-gpu', name: 'ZeroGPU (HF Spaces)', price: 'Free', status: 'available' },
    { id: 't4', name: 'NVIDIA T4', price: '$0.60/hr', status: 'available' },
    { id: 'l4', name: 'NVIDIA L4', price: '$0.80/hr', status: 'available' },
    { id: 'a10g', name: 'NVIDIA A10G Small', price: '$1.05/hr', status: 'busy' },
    { id: 'a100', name: 'NVIDIA A100 80GB', price: '$4.25/hr', status: 'available' },
  ];

  const projects = ['hf-desktop-client', 'beryllive', 'myworld', 'dyad-apps'];

  const usageHistory = [
    { time: '10:00 AM', gpu: 'T4', project: 'hf-desktop-client', duration: '45m', cost: '$0.45' },
    { time: '02:30 PM', gpu: 'A10G', project: 'beryllive', duration: '12m', cost: '$0.21' },
  ];

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Cpu className="w-8 h-8 text-green-500" />
              <span>GPU Resource Management</span>
            </h1>
            <p className="text-slate-400 mt-2">Scale and monitor your project's compute power.</p>
          </div>
          <button 
            onClick={() => setIsOverlayOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center space-x-2"
          >
            <Zap className="w-5 h-5" />
            <span>Provision New GPU</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active GPU Status */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span>Active Deployment</span>
              </h2>
              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">{gpuOptions.find(g => g.id === selectedGpu)?.name}</h3>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">{selectedProject}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-blue-400">00:14:52</span>
                  <p className="text-[10px] text-slate-500 uppercase">Current Session Time</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-500 block mb-1">Cost / Hour</span>
                  <span className="text-xl font-bold">{gpuOptions.find(g => g.id === selectedGpu)?.price}</span>
                </div>
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-500 block mb-1">Sleeper Timer</span>
                  <div className="flex items-center space-x-2">
                     <Clock className="w-4 h-4 text-orange-400" />
                     <span className="text-xl font-bold">{sleepTimer}m</span>
                  </div>
                </div>
                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-500 block mb-1">Daily Usage</span>
                  <span className="text-xl font-bold">$1.24</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <span>Usage History</span>
              </h2>
              <div className="space-y-3">
                {usageHistory.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg border border-slate-700/30 text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-500 font-mono text-xs">{item.time}</span>
                      <span className="font-bold">{item.gpu}</span>
                      <span className="text-slate-400">{item.project}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-500">{item.duration}</span>
                      <span className="font-mono text-green-400 font-bold">{item.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
               <h2 className="text-lg font-bold mb-6">Auto-Shutdown</h2>
               <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm text-slate-400 mb-2 block">Inactivity Timer (Minutes)</span>
                    <input 
                      type="range" 
                      min="5" 
                      max="120" 
                      step="5"
                      value={sleepTimer}
                      onChange={(e) => setSleepTimer(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-bold">
                      <span>5 MIN</span>
                      <span>60 MIN</span>
                      <span>120 MIN</span>
                    </div>
                  </label>
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                    <p className="text-xs text-orange-400 leading-relaxed">
                      Your GPU will automatically de-provision if no activity is detected for {sleepTimer} minutes. This is to strictly control cost.
                    </p>
                  </div>
               </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
               <h2 className="text-lg font-bold mb-4">Hard Cost Cap</h2>
               <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg mb-4">
                  <span className="text-sm font-medium">Daily Limit</span>
                  <span className="text-sm font-bold text-blue-400">$10.00</span>
               </div>
               <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full w-[12%]" />
               </div>
               <p className="text-[10px] text-slate-500 mt-2">12.4% of daily quota used</p>
            </div>
          </div>
        </div>
      </div>

      {/* Provisioning Overlay */}
      {isOverlayOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-700">
               <h2 className="text-2xl font-bold">Provision New GPU Resource</h2>
               <p className="text-slate-400">Select your hardware and target project.</p>
            </div>
            
            <div className="p-8 space-y-8">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">1. Select Target Project</label>
                <div className="grid grid-cols-2 gap-3">
                  {projects.map(p => (
                    <button 
                      key={p}
                      onClick={() => setSelectedProject(p)}
                      className={`p-4 rounded-xl border text-left transition-all ${selectedProject === p ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                    >
                      <span className="font-bold">{p}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">2. Select GPU Hardware</label>
                <div className="space-y-3">
                   {gpuOptions.map(g => (
                     <button 
                       key={g.id}
                       disabled={g.status === 'busy' || g.status === 'offline'}
                       onClick={() => setSelectedGpu(g.id)}
                       className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${selectedGpu === g.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'} ${g.status !== 'available' ? 'opacity-50 cursor-not-allowed' : ''}`}
                     >
                       <div className="flex items-center space-x-4">
                         <div className={`w-3 h-3 rounded-full ${g.status === 'available' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`} />
                         <span className="font-bold">{g.name}</span>
                       </div>
                       <div className="flex items-center space-x-4">
                         <span className="text-sm font-mono">{g.price}</span>
                         <ChevronRight className="w-4 h-4 opacity-50" />
                       </div>
                     </button>
                   ))}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-900 flex items-center justify-end space-x-4">
              <button 
                onClick={() => setIsOverlayOpen(false)}
                className="px-6 py-2 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsOverlayOpen(false)}
                className="px-8 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/40"
              >
                Start Provisioning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPUManager;
