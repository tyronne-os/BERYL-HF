import React, { useState } from 'react';
import { Wand2, Database, Blocks, Network, User, Plus, Search, Play, Settings } from 'lucide-react';

const AgentStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'mcp' | 'rag' | 'workflows'>('agents');

  const agents = [
    { name: 'UI Architect', model: 'Qwen/Qwen2.5-Coder-32B', status: 'active', tools: ['Figma', 'Terminal'] },
    { name: 'Backend Engineer', model: 'MiniMaxAI/MiniMax-M2.5', status: 'idle', tools: ['Python', 'Docker'] },
    { name: 'Data Analyst', model: 'moonshotai/Kimi-K2.6', status: 'active', tools: ['Pandas', 'SQL'] },
  ];

  const mcpServers = [
    { name: 'sqlite-server', status: 'connected', description: 'Local SQLite database access' },
    { name: 'github-mcp', status: 'connected', description: 'GitHub API integration' },
    { name: 'local-filesystem', status: 'error', description: 'Read/write to local workspace' },
  ];

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-900 text-slate-100">
      {/* Studio Sidebar */}
      <div className="w-64 border-r border-slate-700 bg-slate-950 flex flex-col">
        <div className="p-4 border-b border-slate-800">
           <h2 className="text-sm font-bold flex items-center space-x-2">
             <Wand2 className="w-4 h-4 text-purple-400" />
             <span>Beryl Studio</span>
           </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button 
            onClick={() => setActiveTab('agents')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'agents' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <User className="w-4 h-4" />
            <span className="font-bold">Custom Agents</span>
          </button>
          <button 
            onClick={() => setActiveTab('mcp')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'mcp' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Blocks className="w-4 h-4" />
            <span className="font-bold">MCP Servers</span>
          </button>
          <button 
            onClick={() => setActiveTab('rag')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'rag' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Database className="w-4 h-4" />
            <span className="font-bold">Knowledge Bases</span>
          </button>
          <button 
            onClick={() => setActiveTab('workflows')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'workflows' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Network className="w-4 h-4" />
            <span className="font-bold">Visual Workflows</span>
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'agents' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Custom Agent Builder</h1>
                  <p className="text-slate-400 text-sm">Design specialized agents driven by Hugging Face models.</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>New Agent</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agents.map((agent, i) => (
                  <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-blue-500/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{agent.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {agent.status}
                          </span>
                        </div>
                      </div>
                      <button className="text-slate-500 hover:text-slate-300">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Base Model</span>
                        <div className="bg-slate-900 rounded p-2 text-xs font-mono text-slate-300 truncate">{agent.model}</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Assigned Tools</span>
                        <div className="flex flex-wrap gap-2">
                          {agent.tools.map(t => (
                            <span key={t} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center space-x-3">
                    <Blocks className="w-6 h-6 text-orange-400" />
                    <span>MCP Server Management</span>
                  </h1>
                  <p className="text-slate-400 text-sm">Connect Model Context Protocol servers to give agents local tool access.</p>
                </div>
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2">
                  <Search className="w-4 h-4" />
                  <span>Browse Marketplace</span>
                </button>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-700 bg-slate-900/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-4">Server Name</div>
                  <div className="col-span-5">Description</div>
                  <div className="col-span-3 text-right">Status</div>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {mcpServers.map((server, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-700/30 transition-colors">
                      <div className="col-span-4 font-mono text-sm text-blue-400">{server.name}</div>
                      <div className="col-span-5 text-sm text-slate-400">{server.description}</div>
                      <div className="col-span-3 flex justify-end">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center space-x-1 ${server.status === 'connected' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${server.status === 'connected' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span>{server.status.toUpperCase()}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-8 flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <Database className="w-10 h-10 text-slate-500" />
              </div>
              <h2 className="text-2xl font-bold">Local Vector Store</h2>
              <p className="text-slate-400 max-w-md">Upload PDFs, Docs, or link external documentation. Beryl will chunk and embed them locally for ultra-fast Retrieval Augmented Generation.</p>
              <button className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold mt-4 shadow-lg shadow-blue-900/20">
                Initialize Vector DB
              </button>
            </div>
          )}

          {activeTab === 'workflows' && (
             <div className="h-[70vh] bg-slate-950 rounded-2xl border border-slate-700 relative overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur">
                   <h3 className="font-bold text-sm">Agentic Pipeline Editor</h3>
                   <button className="text-xs bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded text-white font-bold flex items-center space-x-1">
                      <Play className="w-3 h-3" />
                      <span>TEST RUN</span>
                   </button>
                </div>
                {/* Mockup of a node graph */}
                <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-slate-950">
                   {/* Background Grid Pattern */}
                   <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                   
                   {/* Nodes Mockups */}
                   <div className="absolute top-20 left-20 bg-slate-800 border border-blue-500 p-4 rounded-xl shadow-2xl w-48 z-10">
                      <div className="text-xs font-bold text-blue-400 mb-2">Input Trigger</div>
                      <div className="text-xs text-slate-300">GitHub Webhook (Push)</div>
                   </div>
                   
                   {/* Line Mockup */}
                   <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      <path d="M 270 120 C 350 120, 350 220, 420 220" stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="4 4" className="animate-pulse" />
                   </svg>

                   <div className="absolute top-[180px] left-[420px] bg-slate-800 border border-purple-500 p-4 rounded-xl shadow-2xl w-48 z-10">
                      <div className="text-xs font-bold text-purple-400 mb-2">Review Agent</div>
                      <div className="text-xs text-slate-300">Model: Qwen 2.5</div>
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentStudio;
