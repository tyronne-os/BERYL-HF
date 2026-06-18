import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Wand2, Database, Blocks, Network, User, Plus, Play, Trash2, X, Save,
  Loader2, RefreshCw, FileText, Download, Edit3, Sparkles, ChevronDown,
} from 'lucide-react';
import { API } from '../api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent { id: string; name: string; model: string; system_prompt: string; tools: string[]; status: string; }
interface Skill { id: string; name: string; description: string; trigger: string; instructions: string; created: string; }

const BLANK_AGENT: Agent = { id: '', name: '', model: 'Qwen/Qwen2.5-Coder-32B-Instruct', system_prompt: '', tools: [], status: 'idle' };
const BLANK_SKILL: Skill = { id: '', name: '', description: '', trigger: '', instructions: '', created: '' };

// ── Skill storage (localStorage) ───────────────────────────────────────────────
const SKILLS_KEY = 'beryl_agent_skills';
function loadSkills(): Skill[] { try { return JSON.parse(localStorage.getItem(SKILLS_KEY) || '[]'); } catch { return []; } }
function saveSkills(skills: Skill[]) { localStorage.setItem(SKILLS_KEY, JSON.stringify(skills)); }

function skillToMarkdown(skill: Skill): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n## Trigger\n${skill.trigger}\n\n## Instructions\n${skill.instructions}\n`;
}

function downloadMd(skill: Skill) {
  const blob = new Blob([skillToMarkdown(skill)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${skill.name.toLowerCase().replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs text-slate-500 font-bold uppercase block mb-2">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-oldgold-500 transition-colors" />
  </div>
);

// ── MCP servers list ───────────────────────────────────────────────────────────
const mcpServers = [
  { name: 'powershell-exec', status: 'connected', description: 'Real PowerShell execution (/cli/exec)' },
  { name: 'github-mcp', status: 'connected', description: 'GitHub repo create/list (/create_project, /github/repos)' },
  { name: 'hf-inference', status: 'connected', description: 'Hugging Face chat/STT/TTS (/chat, /voice/orchestrate)' },
  { name: 'security-sweeper', status: 'connected', description: 'GEN SHERMAN threat engine (/security/sweep)' },
  { name: 'ove-voice', status: 'connected', description: 'O.V.E voice agent with CYCLOPS vision (/voice/orchestrate)' },
  { name: 'comfyui-bridge', status: 'pending', description: 'ComfyUI proxy — connects when :8188 is online' },
];

// ── AgentStudio ────────────────────────────────────────────────────────────────
type Tab = 'agents' | 'skills' | 'mcp' | 'rag' | 'workflows';

const AgentStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('agents');

  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentEditor, setAgentEditor] = useState<Agent | null>(null);
  const [toolsInput, setToolsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Skill state
  const [skills, setSkills] = useState<Skill[]>(loadSkills);
  const [skillEditor, setSkillEditor] = useState<Skill | null>(null);
  const [skillSaving, setSkillSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  const fetchAgents = async () => {
    try { const { data } = await axios.get(`${API}/agents`); setAgents(data.agents || []); }
    catch (e) { console.error(e); }
    finally { setAgentLoading(false); }
  };
  useEffect(() => { fetchAgents(); }, []);

  // ── Agent CRUD ─────────────────────────────────────────────────────────────
  const openNewAgent = () => { setAgentEditor({ ...BLANK_AGENT }); setToolsInput(''); };
  const openEditAgent = (a: Agent) => { setAgentEditor({ ...a }); setToolsInput(a.tools.join(', ')); };
  const saveAgent = async () => {
    if (!agentEditor || !agentEditor.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...agentEditor, tools: toolsInput.split(',').map(t => t.trim()).filter(Boolean) };
      await axios.post(`${API}/agents`, payload);
      setAgentEditor(null);
      await fetchAgents();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };
  const removeAgent = async (id: string) => {
    try { await axios.delete(`${API}/agents/${id}`); await fetchAgents(); } catch (e) { console.error(e); }
  };

  // ── Skill CRUD ─────────────────────────────────────────────────────────────
  const openNewSkill = () => setSkillEditor({ ...BLANK_SKILL, id: Date.now().toString(), created: new Date().toISOString().slice(0, 10) });
  const openEditSkill = (s: Skill) => setSkillEditor({ ...s });
  const saveSkill = () => {
    if (!skillEditor || !skillEditor.name.trim()) return;
    setSkillSaving(true);
    setTimeout(() => {
      const updated = skills.find(s => s.id === skillEditor.id)
        ? skills.map(s => s.id === skillEditor.id ? skillEditor : s)
        : [...skills, skillEditor];
      setSkills(updated);
      saveSkills(updated);
      setSkillEditor(null);
      setSkillSaving(false);
    }, 300);
  };
  const removeSkill = (id: string) => {
    const updated = skills.filter(s => s.id !== id);
    setSkills(updated);
    saveSkills(updated);
  };

  // ── Nav ───────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'agents', label: 'Agents', badge: agents.length },
    { id: 'skills', label: 'Skills', badge: skills.length },
    { id: 'mcp', label: 'Capabilities' },
    { id: 'rag', label: 'Knowledge' },
    { id: 'workflows', label: 'Workflows' },
  ];

  return (
    <div className="flex flex-1 overflow-hidden bg-midnight-950 text-slate-100">

      {/* Sidebar */}
      <div className="w-56 border-r border-midnight-800 bg-midnight-900/60 flex flex-col shrink-0">
        <div className="p-4 border-b border-midnight-800">
          <h2 className="text-sm font-black flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 text-oldgold-400" /> AGENTS
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Build · Skills · Connect</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {TABS.map(({ id, label, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === id ? 'bg-oldgold-500/15 text-oldgold-400' : 'hover:bg-midnight-800 text-slate-400'
              }`}>
              <span className="font-bold">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? 'bg-oldgold-500/30 text-oldgold-400' : 'bg-midnight-800 text-slate-500'}`}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-midnight-950">
        <div className="max-w-5xl mx-auto">

          {/* ── AGENTS TAB ── */}
          {activeTab === 'agents' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">Custom Agents</h1>
                  <p className="text-slate-400 text-sm mt-1">Persisted agent definitions backed by Hugging Face or Ollama models.</p>
                </div>
                <button onClick={openNewAgent}
                  className="bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                  <Plus className="w-4 h-4" /> New Agent
                </button>
              </div>

              {agentLoading ? (
                <div className="flex items-center justify-center h-40 text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-midnight-800 rounded-2xl">
                  <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No agents yet. Create your first specialized agent.</p>
                  <button onClick={openNewAgent} className="mt-4 text-oldgold-400 text-sm hover:underline">+ Create Agent</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {agents.map(agent => (
                    <div key={agent.id} className="bg-midnight-900 border border-midnight-800 hover:border-oldgold-500/30 rounded-xl p-5 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-oldgold-500/15 flex items-center justify-center">
                            <User className="w-5 h-5 text-oldgold-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-white">{agent.name}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>{agent.status}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditAgent(agent)} className="text-slate-500 hover:text-oldgold-400 p-1.5 rounded-lg hover:bg-midnight-800 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeAgent(agent.id)} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-midnight-800 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div><span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Model</span>
                          <div className="bg-midnight-950 rounded-lg p-2 text-xs font-mono text-slate-300 truncate">{agent.model}</div></div>
                        {agent.tools.length > 0 && (
                          <div><span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Tools</span>
                            <div className="flex flex-wrap gap-1.5">{agent.tools.map(t => (
                              <span key={t} className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded text-[10px] font-bold">{t}</span>
                            ))}</div></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SKILLS TAB ── */}
          {activeTab === 'skills' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white">Agent Skills</h1>
                  <p className="text-slate-400 text-sm mt-1">Create reusable skill definitions in Markdown format. Download and use them across agents.</p>
                </div>
                <button onClick={openNewSkill}
                  className="bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                  <Plus className="w-4 h-4" /> New Skill
                </button>
              </div>

              {skills.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-midnight-800 rounded-2xl">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No skills yet. Create your first agent skill definition.</p>
                  <p className="text-xs text-slate-600 mt-2">Skills are saved locally and can be downloaded as .md files.</p>
                  <button onClick={openNewSkill} className="mt-4 text-oldgold-400 text-sm hover:underline">+ Create Skill</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {skills.map(skill => (
                    <div key={skill.id} className="bg-midnight-900 border border-midnight-800 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white">{skill.name}</p>
                            <p className="text-xs text-slate-500 truncate">{skill.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          <button onClick={() => setPreviewOpen(previewOpen === skill.id ? null : skill.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-midnight-800 rounded-lg transition-colors">
                            <ChevronDown className={`w-4 h-4 transition-transform ${previewOpen === skill.id ? 'rotate-180' : ''}`} />
                          </button>
                          <button onClick={() => downloadMd(skill)} title="Download .md"
                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-midnight-800 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditSkill(skill)}
                            className="p-1.5 text-slate-500 hover:text-oldgold-400 hover:bg-midnight-800 rounded-lg transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeSkill(skill.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-midnight-800 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {previewOpen === skill.id && (
                        <div className="border-t border-midnight-800 bg-midnight-950 p-4">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Trigger</p>
                          <p className="text-sm text-slate-300 mb-3">{skill.trigger || '—'}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Instructions</p>
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-midnight-900 rounded-lg p-3 border border-midnight-800 max-h-48 overflow-y-auto">{skill.instructions || '—'}</pre>
                          <div className="mt-3 flex gap-2">
                            <span className="text-[10px] text-slate-600">Created {skill.created}</span>
                            <button onClick={() => downloadMd(skill)}
                              className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 ml-auto">
                              <Download className="w-3 h-3" /> Download as .md
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MCP TAB ── */}
          {activeTab === 'mcp' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-3">
                  <Blocks className="w-6 h-6 text-orange-400" /> Connected Capabilities
                </h1>
                <p className="text-slate-400 text-sm mt-1">Live backend tools available to your agents.</p>
              </div>
              <div className="bg-midnight-900 rounded-xl border border-midnight-800 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-midnight-800 bg-midnight-950/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-4">Capability</div><div className="col-span-5">Endpoint</div><div className="col-span-3 text-right">Status</div>
                </div>
                <div className="divide-y divide-midnight-800/50">
                  {mcpServers.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-midnight-800/30 transition-colors">
                      <div className="col-span-4 font-mono text-sm text-cyan-400">{s.name}</div>
                      <div className="col-span-5 text-sm text-slate-400">{s.description}</div>
                      <div className="col-span-3 flex justify-end">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 ${s.status === 'connected' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                          {s.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── RAG TAB ── */}
          {activeTab === 'rag' && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-20 h-20 rounded-2xl bg-midnight-900 border border-midnight-800 flex items-center justify-center mb-4"><Database className="w-9 h-9 text-slate-500" /></div>
              <h2 className="text-2xl font-black text-white">Knowledge Bases</h2>
              <p className="text-slate-400 max-w-md mt-2">RAG requires a local embedding model + vector DB. Not yet enabled on this machine.</p>
              <span className="mt-4 text-[10px] font-black px-3 py-1 rounded bg-midnight-900 text-slate-400 uppercase tracking-widest border border-midnight-800">Requires embedding backend</span>
            </div>
          )}

          {/* ── WORKFLOWS TAB ── */}
          {activeTab === 'workflows' && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-20 h-20 rounded-2xl bg-midnight-900 border border-midnight-800 flex items-center justify-center mb-4"><Network className="w-9 h-9 text-slate-500" /></div>
              <h2 className="text-2xl font-black text-white">Visual Workflows</h2>
              <p className="text-slate-400 max-w-md mt-2">Multi-agent pipeline execution. Individual agents above are real; chained execution is the next milestone.</p>
              <span className="mt-4 text-[10px] font-black px-3 py-1 rounded bg-midnight-900 text-slate-400 uppercase tracking-widest border border-midnight-800">Coming next</span>
            </div>
          )}

        </div>
      </div>

      {/* ── Agent editor modal ── */}
      {agentEditor && (
        <div className="fixed inset-0 bg-midnight-950/90 z-[100] flex items-center justify-center p-6" onClick={() => setAgentEditor(null)}>
          <div className="bg-midnight-900 border border-midnight-800 rounded-3xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-midnight-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><Wand2 className="w-5 h-5 text-oldgold-400" />{agentEditor.id ? 'Edit Agent' : 'New Agent'}</h2>
              <button onClick={() => setAgentEditor(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-midnight-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Name" value={agentEditor.name} onChange={v => setAgentEditor({ ...agentEditor, name: v })} placeholder="e.g., Test Engineer" />
              <Input label="Base Model" value={agentEditor.model} onChange={v => setAgentEditor({ ...agentEditor, model: v })} placeholder="Qwen/Qwen2.5-Coder-32B-Instruct" />
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">System Prompt</label>
                <textarea value={agentEditor.system_prompt} onChange={e => setAgentEditor({ ...agentEditor, system_prompt: e.target.value })} rows={3}
                  className="w-full bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-oldgold-500 resize-none" placeholder="Describe the agent's role…" />
              </div>
              <Input label="Tools (comma separated)" value={toolsInput} onChange={setToolsInput} placeholder="Terminal, Python, GitHub" />
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Status</label>
                <select value={agentEditor.status} onChange={e => setAgentEditor({ ...agentEditor, status: e.target.value })}
                  className="w-full bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-oldgold-500">
                  <option value="idle">idle</option><option value="active">active</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-midnight-950/50 flex items-center justify-end gap-3 rounded-b-3xl">
              <button onClick={() => setAgentEditor(null)} className="px-5 py-2 rounded-xl text-slate-400 hover:bg-midnight-800 transition-colors">Cancel</button>
              <button onClick={saveAgent} disabled={saving || !agentEditor.name.trim()}
                className="px-6 py-2 bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 rounded-xl font-black flex items-center gap-2 disabled:opacity-50 transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Skill editor modal ── */}
      {skillEditor && (
        <div className="fixed inset-0 bg-midnight-950/90 z-[100] flex items-center justify-center p-6" onClick={() => setSkillEditor(null)}>
          <div className="bg-midnight-900 border border-midnight-800 rounded-3xl w-full max-w-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-midnight-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" />{skillEditor.id && skills.find(s => s.id === skillEditor.id) ? 'Edit Skill' : 'New Skill'}</h2>
              <button onClick={() => setSkillEditor(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-midnight-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Skill Name" value={skillEditor.name} onChange={v => setSkillEditor({ ...skillEditor, name: v })} placeholder="e.g., Code Reviewer" />
              <Input label="Description" value={skillEditor.description} onChange={v => setSkillEditor({ ...skillEditor, description: v })} placeholder="What this skill does in one sentence" />
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Trigger Condition</label>
                <input value={skillEditor.trigger} onChange={e => setSkillEditor({ ...skillEditor, trigger: e.target.value })}
                  placeholder="When should this skill activate? (e.g., user asks to review code)"
                  className="w-full bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Instructions (Markdown)</label>
                <textarea value={skillEditor.instructions} onChange={e => setSkillEditor({ ...skillEditor, instructions: e.target.value })} rows={7}
                  placeholder={`## Steps\n1. First do this\n2. Then do that\n\n## Rules\n- Always...\n- Never...`}
                  className="w-full bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono resize-none transition-colors" />
              </div>
            </div>
            <div className="p-6 bg-midnight-950/50 flex items-center justify-between rounded-b-3xl">
              <button onClick={() => skillEditor && downloadMd(skillEditor)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <Download className="w-4 h-4" /> Preview .md
              </button>
              <div className="flex gap-3">
                <button onClick={() => setSkillEditor(null)} className="px-5 py-2 rounded-xl text-slate-400 hover:bg-midnight-800 transition-colors">Cancel</button>
                <button onClick={saveSkill} disabled={skillSaving || !skillEditor.name.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black flex items-center gap-2 disabled:opacity-50 transition-all">
                  {skillSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Skill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentStudio;
