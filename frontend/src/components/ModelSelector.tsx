import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronDown, TrendingUp, Zap } from 'lucide-react';

interface ModelSelectorProps {
  selected: string;
  onSelect: (model: string) => void;
  additionalModels?: { id: string; author: string }[];
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selected, onSelect, additionalModels = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const primaryModels: { id: string; author: string; role: string; label?: string }[] = [
    { id: 'MiniMaxAI/MiniMax-M3', author: 'MiniMaxAI', role: 'Default Brain' },
    { id: 'MiniMaxAI/MiniMax-M2.7', author: 'MiniMaxAI', role: 'Fast / Cheaper' },
    { id: 'zai-org/GLM-4.6', author: 'Zhipu AI', role: 'Reasoning', label: 'GLM 5.2' },
    { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', author: 'Qwen', role: 'Rapid Template' },
  ];

  const [trending, setTrending] = useState<{ id: string; author: string }[]>([]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8001/trending');
        setTrending(response.data.text);
      } catch (err) {
        console.error("Failed to fetch trending models", err);
      }
    };
    fetchTrending();
  }, []);

  // Merge trending and additional models, removing duplicates
  const allOtherModels = [...additionalModels, ...trending].filter(
    (model, index, self) => 
      index === self.findIndex((t) => t.id === model.id) &&
      !primaryModels.find(p => p.id === model.id)
  );

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors text-sm font-medium"
      >
        <span>{primaryModels.find(m => m.id === selected)?.label || selected.split('/').pop()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-700 flex items-center space-x-2 text-xs text-blue-400 font-semibold uppercase tracking-wider bg-slate-800/50">
            <Zap className="w-3 h-3" />
            <span>Primary Routing Matrix</span>
          </div>
          <div className="border-b border-slate-700/50">
            {primaryModels.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-700 flex flex-col space-y-0.5 border-b border-slate-700/30 last:border-0 ${selected === model.id ? 'bg-slate-700/50 border-l-2 border-l-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">{model.label || model.id.split('/').pop()}</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">{model.role}</span>
                </div>
                <span className="text-xs text-slate-500">{model.author}</span>
              </button>
            ))}
          </div>

          <div className="p-2 border-b border-slate-700 flex items-center space-x-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <TrendingUp className="w-3 h-3" />
            <span>Trending on HF Hub</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {allOtherModels.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 hover:bg-slate-700 flex flex-col space-y-0.5 border-b border-slate-700/30 last:border-0 ${selected === model.id ? 'bg-slate-700/50 border-l-2 border-l-blue-500' : ''}`}
              >
                <span className="text-sm font-medium text-slate-200">{model.id.split('/').pop()}</span>
                <span className="text-xs text-slate-500">{model.author}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
