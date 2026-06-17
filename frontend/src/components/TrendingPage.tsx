import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Plus, ExternalLink, Search } from 'lucide-react';

interface Model {
  id: string;
  author: string;
}

interface TrendingPageProps {
  onAddModel: (modelId: string) => void;
}

const TrendingPage: React.FC<TrendingPageProps> = ({ onAddModel }) => {
  const [trending, setTrending] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8001/trending');
        setTrending(response.data.text);
      } catch (err) {
        console.error("Failed to fetch trending models", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const filteredModels = trending.filter(m => 
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <span>Trending Models</span>
            </h1>
            <p className="text-slate-400 mt-2">Discover and add the latest high-performance models from Hugging Face.</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModels.map((model) => (
              <div key={model.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => onAddModel(model.id)}
                      className="p-2 bg-slate-700 hover:bg-blue-600 rounded-lg transition-colors"
                      title="Add to Selector"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <a 
                      href={`https://huggingface.co/${model.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <h3 className="font-bold text-lg truncate mb-1" title={model.id}>
                  {model.id.split('/').pop()}
                </h3>
                <p className="text-sm text-slate-400 mb-4">{model.author}</p>
                <div className="flex items-center space-x-2">
                   <span className="px-2 py-0.5 bg-slate-700 rounded text-[10px] font-bold uppercase tracking-wider text-slate-300">Text Generation</span>
                   <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-[10px] font-bold uppercase tracking-wider">Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingPage;
