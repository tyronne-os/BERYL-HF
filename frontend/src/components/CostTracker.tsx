import React from 'react';
import { DollarSign, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';

const CostTracker: React.FC = () => {
  const modelUsage = [
    { model: 'MiniMaxAI/MiniMax-M2.5', tokens: '1.2M', cost: '$0.00 (Pro)', percentage: 60 },
    { model: 'moonshotai/Kimi-K2.6', tokens: '450K', cost: '$0.00 (Pro)', percentage: 22 },
    { model: 'Qwen/Qwen2.5-Coder-32B', tokens: '320K', cost: '$0.00 (Pro)', percentage: 16 },
    { model: 'Others', tokens: '45K', cost: '$0.00 (Pro)', percentage: 2 },
  ];

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <span>Inference Cost Tracking</span>
            </h1>
            <p className="text-slate-400 mt-2">Monitor your HF Pro allocation and token throughput.</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-6 py-3 flex items-center space-x-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Monthly Allocation</p>
              <p className="text-xl font-bold text-blue-400">2.0M Tokens</p>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Remaining</p>
              <p className="text-xl font-bold text-green-400">765K</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm">Today's Spend</span>
              <span className="flex items-center text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                <ArrowDownRight className="w-3 h-3 mr-1" />
                12%
              </span>
            </div>
            <p className="text-3xl font-bold">$0.00</p>
            <p className="text-xs text-slate-500 mt-1">Included in HF Pro</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm">Token Velocity</span>
              <span className="flex items-center text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                4.2%
              </span>
            </div>
            <p className="text-3xl font-bold">8.4K <span className="text-sm font-normal text-slate-500">/ min</span></p>
            <p className="text-xs text-slate-500 mt-1">Peak: 12.1K/min</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm">Efficiency Score</span>
              <Zap className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold">94.2%</p>
            <p className="text-xs text-slate-500 mt-1">Optimization: High</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Token Distribution by Model</span>
            </h2>
            <div className="space-y-6">
              {modelUsage.map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-200">{m.model}</span>
                    <span className="text-slate-400">{m.tokens} tokens</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-1000" 
                      style={{ width: `${m.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              <span>Project Allocation</span>
            </h2>
            <div className="aspect-square max-w-[240px] mx-auto relative flex items-center justify-center">
               <div className="absolute inset-0 rounded-full border-[20px] border-slate-900" />
               <div className="absolute inset-0 rounded-full border-[20px] border-blue-500 border-t-transparent border-r-transparent" />
               <div className="text-center">
                  <p className="text-3xl font-bold">78%</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Main Dev</p>
               </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
               <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-slate-300">hf-desktop-client (78%)</span>
               </div>
               <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-xs text-slate-300">beryllive (12%)</span>
               </div>
               <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-xs text-slate-300">myworld (8%)</span>
               </div>
               <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-slate-600" />
                  <span className="text-xs text-slate-300">Other (2%)</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostTracker;
