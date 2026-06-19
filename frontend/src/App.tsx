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
import BerylBuilder from './components/BerylBuilder';
import CanvasPane from './components/CanvasPane';
import ModelSelector from './components/ModelSelector';
import AdminPanel from './components/AdminPanel';
import HFPage from './components/HFPage';
import GPUManager from './components/GPUManager';
import ProjectManager from './components/ProjectManager';
import AgentStudio from './components/AgentStudio';
import CLIDashboard from './components/CLIDashboard';
import OllamaMirror from './components/OllamaMirror';
import LivingDoc from './components/LivingDoc';
import VoiceAgent from './components/VoiceAgent';
import ComfyUIMirror from './components/ComfyUIMirror';
import FlipMode from './components/FlipMode';
import GenSherman from './components/GenSherman';
import KrewePage from './components/krewe/KrewePage';
import BottomNav from './components/BottomNav';
import PaperBanner from './components/krewe/PaperBanner';
import PaperOverlay from './components/krewe/PaperOverlay';
import ResearchPage from './components/krewe/ResearchPage';
import type { ArxivPaper } from './components/krewe/PaperBanner';
import { Settings, Monitor, Zap, Cpu, Wand2, TerminalSquare, BookOpen, FolderOpen, X, Sparkles, FlaskConical } from 'lucide-react';

const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState('MiniMaxAI/MiniMax-M3');
  const [additionalModels, setAdditionalModels] = useState<{ id: string; author: string }[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<any>(null);
  const [isComputerUseEnabled, setIsComputerUseEnabled] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'chat' | 'hf' | 'gpu' | 'studio' | 'cli' | 'docs' | 'ollama' | 'comfy' | 'fliip' | 'sherman' | 'krewe' | 'research'>('chat');
  const [activePaper, setActivePaper] = useState<ArxivPaper | null>(null);
  const [pendingSquad, setPendingSquad] = useState<{ dolls: string[]; edges: [string, string][]; goal: string; note: string } | null>(null);

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
            {/* Command Rail (~half width — more room for the preview) */}
            <div className="w-[17%] border-r border-midnight-800 flex flex-col min-w-[280px] z-10">
              <BerylBuilder
                model={selectedModel}
                isComputerUseEnabled={isComputerUseEnabled}
                onArtifactCreated={(art) => setCurrentArtifact(art)}
              />
            </div>

            {/* Live Viewport (expanded) */}
            <div className="flex-1 flex flex-col bg-midnight-950 relative">
              <CanvasPane artifact={currentArtifact} />
            </div>
          </main>
        );
      case 'hf':
        return <HFPage onAddModel={handleAddModel} />;
      case 'gpu':
        return <GPUManager />;
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
      case 'krewe':
        return <KrewePage pendingSquad={pendingSquad} onSquadConsumed={() => setPendingSquad(null)} />;
      case 'research':
        return <ResearchPage onSelect={setActivePaper} />;
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen bg-midnight-950 text-slate-100 overflow-hidden">
      {/* Research scroller — above the nav, always visible */}
      <PaperBanner onSelect={setActivePaper} onOpenResearch={() => setCurrentPage('research')} />
      {activePaper && (
        <PaperOverlay
          paper={activePaper}
          onClose={() => setActivePaper(null)}
          onSquadIt={(dolls, edges, goal, note) => {
            setPendingSquad({ dolls, edges: edges as [string, string][], goal, note });
            setCurrentPage('krewe');
            setActivePaper(null);
          }}
        />
      )}
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
            <Zap className="w-3.5 h-3.5" />
            <span>BERYL</span>
          </button>
          <button
            onClick={() => setCurrentPage('studio')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'studio' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>AGENTS</span>
          </button>
          <button 
            onClick={() => setCurrentPage('cli')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'cli' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            <span>CLI</span>
          </button>
          <button
            onClick={() => setCurrentPage('docs')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'docs' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>DOCS</span>
          </button>
          <button
            onClick={() => setCurrentPage('gpu')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'gpu' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>GPU</span>
          </button>
          <div className="h-4 w-px bg-midnight-800 mx-1"></div>
          <button
            onClick={() => setCurrentPage('ollama')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'ollama' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <span className="text-[13px]">🦙</span>
            <span>OLLAMA</span>
          </button>
          <button
            onClick={() => setCurrentPage('hf')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'hf' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <span className="text-[13px]">🤗</span>
            <span>HF</span>
          </button>
          <button
            onClick={() => setCurrentPage('research')}
            className={`nav-flash px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-2 ${currentPage === 'research' ? 'bg-oldgold-500 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'text-slate-400 hover:text-oldgold-400 hover:bg-midnight-800'}`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>RESEARCH</span>
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

      {/* Global Voice Agent — slides in from the right when summoned */}
      <VoiceAgent onArtifactCreated={setCurrentArtifact} isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} currentArtifact={currentArtifact} />

      {/* O.V.E summon orb — floats bottom-right until you need the voice agent */}
      {!isVoiceOpen && (
        <button
          onClick={() => setIsVoiceOpen(true)}
          title="Summon O.V.E voice agent"
          className="group fixed bottom-20 right-5 z-[60] w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          style={{
            background: 'radial-gradient(circle at 32% 28%, #F4A98A, #E8835A 45%, #B85333 100%)',
            boxShadow: '0 8px 24px rgba(232,131,90,0.45), inset 0 1px 3px rgba(255,255,255,0.4)',
          }}
        >
          {/* breathing presence rings */}
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(232,131,90,0.35)', animationDuration: '2.4s' }} />
          <span className="absolute -inset-1 rounded-full border border-oldgold-400/40 group-hover:border-oldgold-400/70 transition-colors" />
          <Sparkles className="w-6 h-6 text-white relative z-10 drop-shadow" />
        </button>
      )}

      {/* Global Bottom Navigation Footer */}
      <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} selectedModel={selectedModel} />
    </div>
    </ErrorBoundary>
  );
};

export default App;
