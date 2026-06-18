import React, { useState, Component } from 'react';

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{position:'fixed',inset:0,background:'#0d0614',color:'#ff4444',fontFamily:'monospace',padding:'2rem',zIndex:9999,overflow:'auto'}}>
        <h2 style={{color:'#D4AF37',marginBottom:'1rem'}}>BERYL HF — Render Error</h2>
        <pre style={{whiteSpace:'pre-wrap',fontSize:'13px'}}>{this.state.error.message}{'\n\n'}{this.state.error.stack}</pre>
      </div>
    );
    return this.props.children;
  }
}
import ChatPane from './components/ChatPane';
import CanvasPane from './components/CanvasPane';
import ModelSelector from './components/ModelSelector';
import AdminPanel from './components/AdminPanel';
import TrendingPage from './components/TrendingPage';
import SpacesPage from './components/SpacesPage';
import GPUManager from './components/GPUManager';
import CostTracker from './components/CostTracker';
import ProjectManager from './components/ProjectManager';
import AgentStudio from './components/AgentStudio';
import CLIDashboard from './components/CLIDashboard';
import CompactHub from './components/CompactHub';
import OllamaMirror from './components/OllamaMirror';
import LivingDoc from './components/LivingDoc';
import VoiceAgent from './components/VoiceAgent';
import ComfyUIMirror from './components/ComfyUIMirror';
import FlipMode from './components/FlipMode';
import GenSherman from './components/GenSherman';
import BottomNav from './components/BottomNav';
import { Settings, Monitor, Zap, MessageSquare, TrendingUp, Globe, Cpu, DollarSign, Wand2, TerminalSquare, BookOpen, Minimize2, Server, FolderOpen, X, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState('MiniMaxAI/MiniMax-M2.5');
  const [additionalModels, setAdditionalModels] = useState<{ id: string; author: string }[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<any>(null);
  const [isComputerUseEnabled, setIsComputerUseEnabled] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<'chat' | 'trending' | 'spaces' | 'gpu' | 'cost' | 'studio' | 'cli' | 'docs' | 'compact' | 'ollama' | 'comfy' | 'fliip' | 'sherman'>('chat');

  const handleAddModel = (modelId: string) => {
    const author = modelId.split('/')[0];
    if (!additionalModels.find(m => m.id === modelId)) {
      setAdditionalModels(prev => [...prev, { id: modelId, author }]);
    }
    setSelectedModel(modelId);
    setCurrentPage('chat');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return (
          <main className="flex flex-1 overflow-hidden relative">
            {/* Command Rail (33%) */}
            <div className="w-[33%] border-r border-slate-700 flex flex-col min-w-[320px] bg-slate-900 z-10">
              <ChatPane 
                model={selectedModel} 
                isComputerUseEnabled={isComputerUseEnabled}
                onArtifactCreated={(art) => {
                  setCurrentArtifact(art);
                }} 
              />
            </div>

            {/* Live Viewport (66%) */}
            <div className="w-[67%] flex flex-col bg-slate-950 relative">
              <CanvasPane artifact={currentArtifact} />
            </div>
          </main>
        );
      case 'trending':
        return <TrendingPage onAddModel={handleAddModel} />;
      case 'spaces':
        return <SpacesPage />;
      case 'gpu':
        return <GPUManager />;
      case 'cost':
        return <CostTracker />;
      case 'compact':
        return <CompactHub />;
      case 'ollama':
        return <OllamaMirror onSelectModel={setSelectedModel} navigateTo={setCurrentPage} />;
      case 'comfy':
        return <ComfyUIMirror />;
      case 'fliip':
        return <FlipMode />;
      case 'studio':
        return <AgentStudio />;
      case 'cli':
        return <CLIDashboard />;
      case 'docs':
        return <LivingDoc navigateTo={setCurrentPage} />;
      case 'sherman':
        return <GenSherman />;
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen bg-midnight-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-midnight-900 border-b border-midnight-800 drag shrink-0 relative">
        <div className="flex items-center space-x-3 mr-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-oldgold-400" />
            <span className="font-bold text-lg tracking-tight text-white">BERYL HF</span>
          </div>
          <button
            onClick={() => setIsFileMenuOpen(true)}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-1.5 ${isFileMenuOpen ? 'bg-oldgold-500 text-midnight-950' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800 border border-midnight-800'}`}
            title="Project files & workspace"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>FILE</span>
          </button>
        </div>

        {/* Global Nav Menu - Absolutely centered */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center bg-midnight-950/80 rounded-lg p-1 border border-midnight-800/50 backdrop-blur-sm">
          <button 
            onClick={() => setCurrentPage('chat')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'chat' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>CHAT</span>
          </button>
          <button 
            onClick={() => setCurrentPage('studio')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'studio' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>STUDIO</span>
          </button>
          <button 
            onClick={() => setCurrentPage('cli')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'cli' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            <span>CLI</span>
          </button>
          <button 
            onClick={() => setCurrentPage('compact')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'compact' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>COMPACT</span>
          </button>
          <button 
            onClick={() => setCurrentPage('ollama')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'ollama' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>OLLAMA</span>
          </button>
          <button 
            onClick={() => setCurrentPage('docs')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'docs' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>DOCS</span>
          </button>
          <div className="h-4 w-px bg-midnight-800 mx-1"></div>
          <button 
            onClick={() => setCurrentPage('trending')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'trending' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>TRENDING</span>
          </button>
          <button 
            onClick={() => setCurrentPage('spaces')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'spaces' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>SPACES</span>
          </button>
          <button 
            onClick={() => setCurrentPage('gpu')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'gpu' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>GPU</span>
          </button>
          <button 
            onClick={() => setCurrentPage('cost')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'cost' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>COST</span>
          </button>
        </nav>

        <div className="flex items-center space-x-4">
          <ModelSelector 
            onSelect={setSelectedModel} 
            selected={selectedModel} 
            additionalModels={additionalModels}
          />
          
          <div className="flex items-center space-x-2 border-l border-midnight-800 pl-4">
            <button
              onClick={() => setIsVoiceOpen(!isVoiceOpen)}
              className={`p-1.5 rounded-md transition-colors relative ${isVoiceOpen ? 'bg-oldgold-500 text-midnight-950' : 'hover:bg-midnight-800 text-slate-400 hover:text-oldgold-400'}`}
              title="O.V.E Voice Agent"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsComputerUseEnabled(!isComputerUseEnabled)}
              className={`p-1.5 rounded-md transition-colors ${isComputerUseEnabled ? 'bg-oldgold-500 text-midnight-950' : 'hover:bg-midnight-800 text-slate-400 hover:text-oldgold-400'}`}
              title="Computer Use (Vision)"
            >
              <Monitor className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
              className={`p-1.5 rounded-md transition-colors ${isAdminPanelOpen ? 'bg-oldgold-500 text-midnight-950' : 'hover:bg-midnight-800 text-slate-400 hover:text-oldgold-400'}`}
              title="Admin Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {renderPage()}

      {/* Admin Back-Panel Overlay */}
      {isAdminPanelOpen && (
        <div className="absolute inset-0 bg-midnight-950/95 z-50 p-8 overflow-y-auto backdrop-blur-md">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8 border-b border-midnight-800 pb-4">
              <h2 className="text-2xl font-bold flex items-center space-x-3 text-white">
                <Settings className="w-8 h-8 text-oldgold-400" />
                <span>Admin Back-Panel System Suite</span>
              </h2>
              <button 
                onClick={() => setIsAdminPanelOpen(false)}
                className="text-slate-300 hover:text-oldgold-400 px-4 py-2 rounded-lg bg-midnight-800 border border-midnight-800 transition-colors font-bold text-sm"
              >
                Close Settings
              </button>
            </div>

            <AdminPanel />
          </div>
        </div>
      )}

      {/* FILE Menu Overlay (Project Hub) — anchored upper-left */}
      {isFileMenuOpen && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setIsFileMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-midnight-950/40 backdrop-blur-[2px]" />
          <div
            className="absolute top-14 left-4 w-[480px] max-w-[90vw] animate-[fadeIn_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center space-x-2 text-oldgold-400">
                <FolderOpen className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">File · Project Workspace</span>
              </div>
              <button
                onClick={() => setIsFileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ProjectManager />
          </div>
        </div>
      )}

      {/* Global Voice Agent — right panel */}
      <VoiceAgent onArtifactCreated={setCurrentArtifact} isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} />

      {/* Global Bottom Navigation Footer */}
      <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
    </ErrorBoundary>
  );
};

export default App;
