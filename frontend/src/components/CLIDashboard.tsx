import React, { useState } from 'react';
import { TerminalSquare, DownloadCloud, Code2, Activity, FolderGit2, SearchCode, ShieldAlert } from 'lucide-react';

const CLIDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'docs' | 'terminal'>('docs');

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <TerminalSquare className="w-8 h-8 text-green-500" />
              <span>Beryl CLI & Telemetry</span>
            </h1>
            <p className="text-slate-400 mt-2">Command line tools, semantic indexing, and local system telemetry.</p>
          </div>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button 
              onClick={() => setActiveTab('docs')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'docs' ? 'bg-slate-700 text-green-400 shadow-sm' : 'text-slate-500'}`}
            >
              CLI DOCUMENTATION
            </button>
            <button 
              onClick={() => setActiveTab('terminal')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'terminal' ? 'bg-slate-700 text-green-400 shadow-sm' : 'text-slate-500'}`}
            >
              EMBEDDED TERMINAL
            </button>
          </div>
        </div>

        {activeTab === 'docs' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <DownloadCloud className="w-5 h-5 text-blue-400" />
                  <span>Installation</span>
                </h2>
                <p className="text-slate-400 text-sm mb-4">Install the Beryl CLI globally to interact with your workspace from any terminal, utilizing the same Hugging Face routing matrix.</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 font-mono text-sm text-green-400 flex justify-between items-center group">
                  <span>npm install -g @beryl-hf/cli</span>
                  <button className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300">Copy</button>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <Code2 className="w-5 h-5 text-purple-400" />
                  <span>Core Commands</span>
                </h2>
                <div className="space-y-4">
                  {[
                    { cmd: 'beryl init', desc: 'Initialize a new Beryl workspace in the current directory.' },
                    { cmd: 'beryl mcp add <server>', desc: 'Install a new Model Context Protocol server globally.' },
                    { cmd: 'beryl agent create', desc: 'Interactive prompt to scaffold a new specialized agent.' },
                    { cmd: 'beryl deploy --target hf', desc: 'Deploy current workspace directly to Hugging Face Spaces.' },
                    { cmd: 'beryl index --semantic', desc: 'Force a rebuild of the local semantic codebase vector graph.' }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      <span className="font-mono text-sm text-blue-400 font-bold mb-2 sm:mb-0">{item.cmd}</span>
                      <span className="text-xs text-slate-400 sm:text-right">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center space-x-2">
                  <SearchCode className="w-4 h-4" />
                  <span>Semantic Indexer Status</span>
                </h2>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-200">Local Codebase</span>
                  <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">SYNCED</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-4">
                  <div className="bg-green-500 h-full w-[100%]" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center mt-6">
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <div className="text-xl font-bold text-slate-200">1,248</div>
                    <div className="text-[9px] text-slate-500 uppercase font-bold mt-1">Files Indexed</div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <div className="text-xl font-bold text-slate-200">14.2s</div>
                    <div className="text-[9px] text-slate-500 uppercase font-bold mt-1">Query Latency</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Environment Variables</span>
                </h2>
                <button className="w-full py-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2">
                  <span>Open Local Secrets Vault</span>
                </button>
                <p className="text-[10px] text-slate-500 mt-3 text-center">Manage .env files across projects securely.</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>System Telemetry</span>
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">RAM (Vite/Node)</span>
                      <span className="font-mono font-bold text-orange-400">1.2 GB</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full w-[45%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">CPU (Background)</span>
                      <span className="font-mono font-bold text-green-400">8%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[8%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[600px] bg-slate-950 rounded-2xl border border-slate-700 p-4 font-mono text-sm overflow-hidden flex flex-col relative">
            <div className="flex items-center space-x-2 mb-4 opacity-50">
               <div className="w-3 h-3 rounded-full bg-red-500"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
               <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 overflow-y-auto text-slate-300 space-y-2">
               <div><span className="text-green-400">tjlsu@desktop</span><span className="text-slate-500">:</span><span className="text-blue-400">~/hf-desktop-client</span><span className="text-slate-500">$</span> beryl init</div>
               <div className="text-slate-400">Initializing Beryl Workspace...</div>
               <div className="text-slate-400">✓ Created .beryl directory</div>
               <div className="text-slate-400">✓ Generated semantic index map</div>
               <div><span className="text-green-400">tjlsu@desktop</span><span className="text-slate-500">:</span><span className="text-blue-400">~/hf-desktop-client</span><span className="text-slate-500">$</span> <span className="animate-pulse">_</span></div>
            </div>
            {/* Embedded Terminal Feature Marker */}
            <div className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-2 pointer-events-none">
              <FolderGit2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-300">Feature 17: Interactive Terminal Emulator</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CLIDashboard;
