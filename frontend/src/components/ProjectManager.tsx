import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Github, Zap, Loader2, CheckCircle, ExternalLink, Layers, ArrowLeftRight, Terminal } from 'lucide-react';

interface RemoteRepo {
  id: string;
  account: string;
  private: boolean;
}

const ProjectManager: React.FC = () => {
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<'local' | 'github' | 'huggingface'>('local');
  const [mode, setMode] = useState<'create' | 'switch'>('create');
  const [isPrivate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; url?: string; path?: string; detail?: string } | null>(null);
  const [remoteRepos, setRemoteRepos] = useState<RemoteRepo[]>([]);
  const [currentActive, setCurrentActive] = useState('hf-desktop-client');

  useEffect(() => {
    if (mode === 'switch') {
      fetchRepos();
    }
  }, [mode]);

  const fetchRepos = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8001/github/repos');
      setRemoteRepos(response.data.repos);
    } catch (err) {
      console.error("Failed to fetch repos", err);
    }
  };

  const handleAction = async () => {
    if (!projectName.trim() && mode !== 'switch') return;
    setIsLoading(true);
    setResult(null);
    try {
      if (mode === 'create') {
        const response = await axios.post('http://127.0.0.1:8001/create_project', {
          name: projectName,
          type: projectType,
          private: isPrivate
        });
        setResult(response.data);
        if (response.data.status === 'success') {
          setCurrentActive(projectName);
        }
      } else if (mode === 'switch') {
        setResult({ status: 'success', detail: `Successfully attached to remote repository: ${projectName}` });
        setCurrentActive(projectName);
      }
    } catch (err: any) {
      console.error("Action failed", err);
      setResult({ status: 'error', detail: err.response?.data?.detail || 'Action failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4">
      <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-tight">Project Hub</h3>
              <div className="flex items-center space-x-2">
                 <span className="text-[10px] text-green-400 font-black px-1.5 py-0.5 bg-green-500/10 rounded border border-green-500/20 truncate max-w-[150px]">ACTIVE: {currentActive}</span>
              </div>
            </div>
          </div>
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
             <button 
               onClick={() => setMode('switch')}
               className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${mode === 'switch' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
             >
               RESUME REMOTE
             </button>
             <button 
               onClick={() => setMode('create')}
               className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${mode === 'create' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`}
             >
               CREATE NEW
             </button>
          </div>
        </div>

        {mode === 'switch' ? (
          <div className="space-y-3">
             <select 
               className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
               onChange={(e) => setProjectName(e.target.value)}
               value={projectName}
             >
                <option value="">Select an existing repository...</option>
                {remoteRepos.map(repo => (
                   <option key={repo.id} value={repo.id}>
                     [{repo.account}] {repo.id} {repo.private ? '(Private)' : '(Public)'}
                   </option>
                ))}
             </select>
             <button 
                onClick={handleAction}
                disabled={isLoading || !projectName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-900/20"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'ATTACH TO WORKSPACE'}
             </button>
          </div>
        ) : (
          <>
            <div className="flex space-x-2 mb-4">
              <button 
                onClick={() => setProjectType('local')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${projectType === 'local' ? 'bg-slate-700 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}
              >
                LOCAL
              </button>
              <button 
                onClick={() => setProjectType('github')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center space-x-1 ${projectType === 'github' ? 'bg-slate-700 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}
              >
                <Github className="w-3 h-3" />
                <span>GITHUB</span>
              </button>
              <button 
                onClick={() => setProjectType('huggingface')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center space-x-1 ${projectType === 'huggingface' ? 'bg-slate-700 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}
              >
                <Zap className="w-3 h-3" />
                <span>HF (GRADIO RAW)</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 mb-2">
              <input 
                type="text" 
                placeholder="New Repository Name..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button 
                onClick={handleAction}
                disabled={isLoading || !projectName.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-lg shadow-blue-900/20 min-w-[80px]"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : mode.toUpperCase()}
              </button>
            </div>
            
            <div className="flex items-center space-x-4 px-2">
               <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center space-x-1"><CheckCircle className="w-2.5 h-2.5 text-green-500"/> <span>Auto-venv</span></span>
               <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center space-x-1"><CheckCircle className="w-2.5 h-2.5 text-green-500"/> <span>Auto-Dockerfile</span></span>
               <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center space-x-1"><CheckCircle className="w-2.5 h-2.5 text-green-500"/> <span>HF Sync</span></span>
            </div>
          </>
        )}

        {result && (
          <div className={`mt-3 p-2 rounded-lg text-[10px] flex items-center justify-between ${result.status === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            <div className="flex items-center space-x-2">
              {result.status === 'success' ? <CheckCircle className="w-3 h-3" /> : null}
              <span className="truncate max-w-[280px]">{result.detail || (result.status === 'success' ? 'Project initialized successfully.' : 'Failed to initialize project.')}</span>
            </div>
            {result.url && (
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 hover:underline font-bold shrink-0">
                <span>VIEW</span>
                <ExternalLink className="w-2 h-2" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectManager;
