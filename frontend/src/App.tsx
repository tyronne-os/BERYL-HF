import React, { useState } from 'react';
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
import BottomNav from './components/BottomNav';
import { Settings, Monitor, Zap, MessageSquare, TrendingUp, Globe, Cpu, DollarSign, Wand2, TerminalSquare, BookOpen, Minimize2, Server } from 'lucide-react';

const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState('MiniMaxAI/MiniMax-M2.5');
  const [additionalModels, setAdditionalModels] = useState<{ id: string; author: string }[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<any>(null);
  const [isComputerUseEnabled, setIsComputerUseEnabled] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'chat' | 'trending' | 'spaces' | 'gpu' | 'cost' | 'studio' | 'cli' | 'docs' | 'compact' | 'ollama' | 'comfy' | 'fliip'>('chat');

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
              <ProjectManager />
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
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-midnight-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-midnight-900 border-b border-midnight-800 drag shrink-0 relative">
        <div className="flex items-center space-x-2 mr-2">
          <Zap className="w-5 h-5 text-oldgold-400" />
          <span className="font-bold text-lg tracking-tight text-white">BERYL HF</span>
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

      {/* Global Floating Voice Agent */}
      <VoiceAgent onArtifactCreated={setCurrentArtifact} />

      {/* Global Bottom Navigation Footer */}
      <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  );
};

export default App;
