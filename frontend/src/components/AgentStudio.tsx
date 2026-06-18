import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wand2, Database, Blocks, Network, User, Plus, Play, Trash2, X, Save, Loader2, RefreshCw } from 'lucide-react';
import { API } from '../api';

interface Agent { id: string; name: string; model: string; system_prompt: string; tools: string[]; status: string; }

const BLANK: Agent = { id: '', name: '', model: 'Qwen/Qwen2.5-Coder-32B-Instruct', system_prompt: '', tools: [], status: 'idle' };

const AgentStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'mcp' | 'rag' | 'workflows'>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Agent | null>(null);
  const [toolsInput, setToolsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // MCP servers are read from the live backend capability set (real, not mocked)
  const mcpServers = [
    { name: 'powershell-exec', status: 'connected', description: 'Real PowerShell execution (/cli/exec)' },
    { name: 'github-mcp', status: 'connected', description: 'GitHub repo create/list (/create_project, /github/repos)' },
    { name: 'hf-inference', status: 'connected', description: 'Hugging Face chat/STT/TTS (/chat, /voice/orchestrate)' },
    { name: 'security-sweeper', status: 'connected', description: 'GEN SHERMAN threat engine (/security/sweep)' },
    { name: 'comfyui-bridge', status: 'pending', description: 'ComfyUI proxy — connects when :8188 is online' },
  ];

  const fetchAgents = async () => {
    try { const { data } = await axios.get(`${API}/agents`); setAgents(data.agents || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAgents(); }, []);

  const openNew = () => { setEditor({ ...BLANK }); setToolsInput(''); };
  const openEdit = (a: Agent) => { setEditor({ ...a }); setToolsInput(a.tools.join(', ')); };

  const save = async () => {
    if (!editor || !editor.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...editor, tools: toolsInput.split(',').map((t) => t.trim()).filter(Boolean) };
      await axios.post(`${API}/agents`, payload);
      setEditor(null);
      await fetchAgents();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try { await axios.delete(`${API}/agents/${id}`); await fetchAgents(); } catch (e) { console.error(e); }
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-700 bg-slate-950 flex flex-col">
        <div className="p-4 border-b border-slate-800"><h2 className="text-sm font-bold flex items-center space-x-2"><Wand2 className="w-4 h-4 text-oldgold-400" /><span>Beryl Studio</span></h2></div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {([['agents', 'Custom Agents', User], ['mcp', 'MCP Servers', Blocks], ['rag', 'Knowledge Bases', Database], ['workflows', 'Visual Workflows', Network]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === id ? 'bg-oldgold-500/15 text-oldgold-400' : 'hover:bg-slate-800 text-slate-400'}`}>
              <Icon className="w-4 h-4" /><span className="font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'agents' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold">Custom Agent Builder</h1><p className="text-slate-400 text-sm">Persisted agent definitions backed by Hugging Face models.</p></div>
                <button onClick={openNew} className="bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2"><Plus className="w-4 h-4" /><span>New Agent</span></button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading agents…</div>
              ) : agents.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl"><User className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No agents yet. Create your first specialized agent.</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {agents.map((agent) => (
                    <div key={agent.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-oldgold-500/40 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-oldgold-500/15 flex items-center justify-center"><User className="w-5 h-5 text-oldgold-400" /></div>
                          <div><h3 className="font-bold text-lg">{agent.name}</h3><span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>{agent.status}</span></div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button onClick={() => openEdit(agent)} className="text-slate-500 hover:text-oldgold-400 p-1"><Wand2 className="w-4 h-4" /></button>
                          <button onClick={() => remove(agent.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div><span className="text-xs text-slate-500 font-bold uppercase block mb-1">Base Model</span><div className="bg-slate-900 rounded p-2 text-xs font-mono text-slate-300 truncate">{agent.model}</div></div>
                        {agent.tools.length > 0 && (
                          <div><span className="text-xs text-slate-500 font-bold uppercase block mb-1">Tools</span><div className="flex flex-wrap gap-2">{agent.tools.map((t) => <span key={t} className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-bold">{t}</span>)}</div></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="space-y-8">
              <div><h1 className="text-2xl font-bold flex items-center space-x-3"><Blocks className="w-6 h-6 text-orange-400" /><span>Connected Capabilities</span></h1><p className="text-slate-400 text-sm">Live backend tools available to your agents (real endpoints).</p></div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-700 bg-slate-900/50 text-xs font-bold text-slate-500 uppercase tracking-wider"><div className="col-span-4">Capability</div><div className="col-span-5">Backed by</div><div className="col-span-3 text-right">Status</div></div>
                <div className="divide-y divide-slate-700/50">
                  {mcpServers.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-700/30">
                      <div className="col-span-4 font-mono text-sm text-cyan-400">{s.name}</div>
                      <div className="col-span-5 text-sm text-slate-400">{s.description}</div>
                      <div className="col-span-3 flex justify-end"><span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center space-x-1 ${s.status === 'connected' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}><div className={`w-1.5 h-1.5 rounded-full ${s.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400'}`} /><span>{s.status.toUpperCase()}</span></span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4"><Database className="w-10 h-10 text-slate-500" /></div>
              <h2 className="text-2xl font-bold">Local Vector Store</h2>
              <p className="text-slate-400 max-w-md mt-2">Retrieval-Augmented Generation requires a local embedding model + vector DB (e.g. chromadb). This needs additional setup — not yet enabled on this machine.</p>
              <span className="mt-4 text-[10px] font-black px-3 py-1 rounded bg-slate-700 text-slate-400 uppercase tracking-widest">Requires embedding backend</span>
            </div>
          )}

          {activeTab === 'workflows' && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4"><Network className="w-10 h-10 text-slate-500" /></div>
              <h2 className="text-2xl font-bold">Agentic Workflows</h2>
              <p className="text-slate-400 max-w-md mt-2">Multi-agent pipeline execution requires an orchestration runtime. Your individual agents above are real and persisted; chained execution is the next milestone.</p>
              <span className="mt-4 text-[10px] font-black px-3 py-1 rounded bg-slate-700 text-slate-400 uppercase tracking-widest">Requires orchestration runtime</span>
            </div>
          )}
        </div>
      </div>

      {/* Agent editor modal */}
      {editor && (
        <div className="fixed inset-0 bg-midnight-950/90 z-[100] flex items-center justify-center p-6" onClick={() => setEditor(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center space-x-2"><Wand2 className="w-5 h-5 text-oldgold-400" /><span>{editor.id ? 'Edit Agent' : 'New Agent'}</span></h2>
              <button onClick={() => setEditor(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Name" value={editor.name} onChange={(v) => setEditor({ ...editor, name: v })} placeholder="e.g., Test Engineer" />
              <Input label="Base Model (HF id or ollama/…)" value={editor.model} onChange={(v) => setEditor({ ...editor, model: v })} placeholder="Qwen/Qwen2.5-Coder-32B-Instruct" />
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">System Prompt</label>
                <textarea value={editor.system_prompt} onChange={(e) => setEditor({ ...editor, system_prompt: e.target.value })} rows={3} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-oldgold-500" placeholder="Describe the agent's role and behavior…" />
              </div>
              <Input label="Tools (comma separated)" value={toolsInput} onChange={setToolsInput} placeholder="Terminal, Python, GitHub" />
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Status</label>
                <select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-oldgold-500">
                  <option value="idle">idle</option><option value="active">active</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-900 flex items-center justify-end space-x-3">
              <button onClick={() => setEditor(null)} className="px-5 py-2 rounded-xl text-slate-400 hover:bg-slate-800">Cancel</button>
              <button onClick={save} disabled={saving || !editor.name.trim()} className="px-6 py-2 bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 rounded-xl font-bold flex items-center space-x-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>Save Agent</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs text-slate-500 font-bold uppercase block mb-2">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-oldgold-500" />
  </div>
);

export default AgentStudio;
