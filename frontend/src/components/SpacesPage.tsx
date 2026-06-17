import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layout, ExternalLink, Search, Globe } from 'lucide-react';

interface Space {
  id: string;
  author: string;
}

const SpacesPage: React.FC = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8001/spaces');
        setSpaces(response.data.spaces);
      } catch (err) {
        console.error("Failed to fetch trending spaces", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSpaces();
  }, []);

  const filteredSpaces = spaces.filter(s => 
    s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedSpace) {
    return (
      <div className="flex-1 flex flex-col bg-slate-950">
        <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSelectedSpace(null)}
              className="text-slate-400 hover:text-white text-sm flex items-center space-x-1"
            >
              <span>← Back to Spaces</span>
            </button>
            <span className="text-slate-200 font-medium text-sm">{selectedSpace}</span>
          </div>
          <a 
            href={`https://huggingface.co/spaces/${selectedSpace}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline text-xs flex items-center space-x-1"
          >
            <span>Open in Browser</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <iframe 
          src={`https://huggingface.co/spaces/${selectedSpace}?embed=true`}
          className="w-full flex-1 border-0"
          title="HF Space"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Globe className="w-8 h-8 text-purple-500" />
              <span>Hugging Face Spaces</span>
            </h1>
            <p className="text-slate-400 mt-2">Explore interactive ML demos and applications.</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search spaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSpaces.map((space) => (
              <div 
                key={space.id} 
                className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group cursor-pointer"
                onClick={() => setSelectedSpace(space.id)}
              >
                <div className="aspect-video bg-slate-700 relative flex items-center justify-center">
                   <Layout className="w-12 h-12 text-slate-600 group-hover:scale-110 transition-transform" />
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                   <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                     <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold uppercase rounded">Space</span>
                   </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold truncate mb-1" title={space.id}>
                    {space.id.split('/').pop()}
                  </h3>
                  <p className="text-xs text-slate-500">{space.author}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpacesPage;
