import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Image as ImageIcon, RefreshCw, ExternalLink, Power, Layers, Cpu,
  MemoryStick, Copy, Check, Plus, FolderOpen, Clock, Trash2,
  ChevronDown, ChevronRight, Tag, Save, Play, X, AlertCircle,
} from 'lucide-react';
import { API } from '../api';

// ── types ────────────────────────────────────────────────────────────────────
interface ComfyStatus {
  online: boolean;
  url: string;
  stats?: any;
  install_path?: string | null;
}

interface ProjectVersion {
  version: number;
  saved_at: string;
  note: string;
  workflow: any;
}

interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  version_count: number;
  latest_version: number;
}

interface ProjectDetail extends Project {
  versions: ProjectVersion[];
}

const CATEGORIES = ['general', 'avatar', 'portrait', 'style', 'upscale', 'video', 'experimental'];

const CAT_COLOR: Record<string, string> = {
  general: 'bg-slate-700 text-slate-200',
  avatar: 'bg-purple-800/60 text-purple-200',
  portrait: 'bg-rose-800/60 text-rose-200',
  style: 'bg-cyan-800/60 text-cyan-200',
  upscale: 'bg-amber-800/60 text-amber-200',
  video: 'bg-blue-800/60 text-blue-200',
  experimental: 'bg-green-800/60 text-green-200',
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Main component ────────────────────────────────────────────────────────────
const ComfyUIMirror: React.FC = () => {
  const [status, setStatus] = useState<ComfyStatus | null>(null);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [copied, setCopied] = useState(false);

  // project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<string | null>(null);
  const [panel, setPanel] = useState<'projects' | 'new'>('projects');

  // new project form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('general');
  const [newTags, setNewTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // sidebar tab
  const [sideTab, setSideTab] = useState<'connection' | 'projects'>('projects');

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await axios.get<ComfyStatus>(`${API}/comfy/status`);
      setStatus(data);
      if (data.online) {
        try {
          const m = await axios.get(`${API}/comfy/models`);
          setCheckpoints(m.data.checkpoints || []);
        } catch { /* checkpoints optional */ }
      }
    } catch {
      setStatus({ online: false, url: 'http://127.0.0.1:8188', install_path: null });
    } finally { setChecking(false); }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/comfy/projects`);
      setProjects(data.projects || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    check();
    loadProjects();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [check, loadProjects]);

  const launch = async () => {
    setLaunching(true);
    try {
      await axios.post(`${API}/comfy/launch`, { path: status?.install_path || null });
      setTimeout(check, 3000);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Could not launch ComfyUI');
    } finally { setLaunching(false); }
  };

  const openProject = async (id: string) => {
    try {
      const { data } = await axios.get<ProjectDetail>(`${API}/comfy/projects/${id}`);
      setActiveProject(data);
    } catch { /* silent */ }
  };

  const deleteProject = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await axios.delete(`${API}/comfy/projects/${id}`);
    if (activeProject?.id === id) setActiveProject(null);
    loadProjects();
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/comfy/projects`, {
        name: newName.trim(),
        description: newDesc.trim(),
        category: newCat,
        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setNewName(''); setNewDesc(''); setNewCat('general'); setNewTags('');
      setSaveMsg('Project created!');
      setTimeout(() => setSaveMsg(''), 2000);
      loadProjects();
      setPanel('projects');
    } catch { setSaveMsg('Error saving.'); }
    finally { setSaving(false); }
  };

  const saveVersion = async (note: string = '') => {
    if (!activeProject) return;
    setSaving(true);
    try {
      const { data } = await axios.put<ProjectDetail>(`${API}/comfy/projects/${activeProject.id}`, {
        workflow: null,
        note: note || `Version ${activeProject.latest_version + 1}`,
      });
      setActiveProject(data);
      loadProjects();
      setSaveMsg('Version saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch { setSaveMsg('Error saving version.'); }
    finally { setSaving(false); }
  };

  const url = status?.url || 'http://127.0.0.1:8188';
  const dev = status?.stats?.devices?.[0];

  const copyCmd = () => {
    const path = status?.install_path;
    const cmd = path
      ? `python "${path}" --listen 127.0.0.1 --port 8188`
      : 'python main.py --listen 127.0.0.1 --port 8188';
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-midnight-950 text-slate-100">

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <div className="w-80 border-r border-midnight-800 bg-midnight-900 flex flex-col z-10 shrink-0">

        {/* Header */}
        <div className="p-4 border-b border-midnight-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold flex items-center gap-2 text-white">
              <ImageIcon className="w-5 h-5 text-cyan-400" />
              ComfyUI Studio
            </h2>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${status?.online ? 'bg-green-900/40 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status?.online ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
              {checking ? 'checking…' : status?.online ? 'live' : 'offline'}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono truncate">{url}</p>
        </div>

        {/* Side tabs */}
        <div className="flex border-b border-midnight-800 shrink-0">
          {(['projects', 'connection'] as const).map(t => (
            <button key={t} onClick={() => setSideTab(t)}
              className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${sideTab === t ? 'text-cyan-400 border-b-2 border-cyan-400 bg-midnight-800/40' : 'text-slate-500 hover:text-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* CONNECTION TAB */}
        {sideTab === 'connection' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* status card */}
            <div className={`p-3 rounded-xl border ${status?.online ? 'border-green-500/30 bg-green-900/10' : 'border-midnight-700 bg-midnight-950'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${status?.online ? 'text-green-400' : 'text-slate-500'}`} />
                  <span className={`text-sm font-bold ${status?.online ? 'text-green-400' : 'text-slate-400'}`}>
                    {checking ? 'Checking…' : status?.online ? 'Connected' : 'Offline'}
                  </span>
                </div>
                <button onClick={check} className="text-slate-500 hover:text-white transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {status?.install_path && (
                <p className="text-[10px] text-slate-500 font-mono truncate" title={status.install_path}>
                  📁 {status.install_path}
                </p>
              )}
            </div>

            {/* GPU info */}
            {status?.online && dev && (
              <div className="bg-midnight-950 border border-midnight-800 p-3 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span className="truncate">{dev.name}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> VRAM free</span>
                  <span className="font-mono">{Math.round((dev.vram_free || 0) / 1024 / 1024)} / {Math.round((dev.vram_total || 0) / 1024 / 1024)} MB</span>
                </div>
              </div>
            )}

            {/* checkpoints */}
            {status?.online && (
              <div className="space-y-1.5">
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Checkpoints ({checkpoints.length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {checkpoints.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">None found in models/checkpoints.</p>
                  ) : checkpoints.map(c => (
                    <div key={c} className="bg-midnight-950 border border-midnight-800 px-2 py-1.5 rounded-lg text-[10px] font-mono text-slate-300 truncate" title={c}>{c}</div>
                  ))}
                </div>
              </div>
            )}

            {/* launch / open buttons */}
            {!status?.online && status?.install_path && (
              <button onClick={launch} disabled={launching}
                className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-all">
                <Play className="w-4 h-4" />
                {launching ? 'Launching…' : 'Launch ComfyUI'}
              </button>
            )}

            {status?.online && (
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2 rounded-xl text-sm transition-all">
                <ExternalLink className="w-4 h-4" /> Open in new tab
              </a>
            )}

            {/* copy start command */}
            <div className="bg-midnight-950 border border-midnight-800 rounded-xl px-3 py-2 font-mono text-[10px] text-cyan-400 flex items-center justify-between gap-2">
              <span className="truncate">python main.py --listen 127.0.0.1 --port 8188</span>
              <button onClick={copyCmd} className="text-slate-500 hover:text-slate-300 shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* PROJECTS TAB */}
        {sideTab === 'projects' && (
          <>
            {/* panel toggle */}
            <div className="flex border-b border-midnight-800/50 shrink-0">
              <button onClick={() => setPanel('projects')}
                className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${panel === 'projects' ? 'text-oldgold-400' : 'text-slate-500 hover:text-slate-300'}`}>
                All Projects
              </button>
              <button onClick={() => setPanel('new')}
                className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${panel === 'new' ? 'text-oldgold-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            {panel === 'new' ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300">New Project</h3>
                <input
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Project name *"
                  className="w-full bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <textarea
                  value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description…"
                  rows={3}
                  className="w-full bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
                <select value={newCat} onChange={e => setNewCat(e.target.value)}
                  className="w-full bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  value={newTags} onChange={e => setNewTags(e.target.value)}
                  placeholder="Tags (comma separated)"
                  className="w-full bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
                {saveMsg && <p className="text-[11px] text-cyan-400">{saveMsg}</p>}
                <button onClick={createProject} disabled={saving || !newName.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-oldgold-500 hover:bg-oldgold-400 disabled:opacity-40 text-midnight-950 font-bold py-2 rounded-xl text-sm transition-all">
                  <Save className="w-4 h-4" />
                  {saving ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="p-6 text-center">
                    <FolderOpen className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-[11px] text-slate-500">No projects yet. Create your first one.</p>
                  </div>
                ) : projects.map(p => (
                  <div key={p.id}
                    className={`border-b border-midnight-800/50 cursor-pointer transition-colors ${activeProject?.id === p.id ? 'bg-midnight-800/60' : 'hover:bg-midnight-800/30'}`}>
                    <div className="p-3" onClick={() => openProject(p.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-100 truncate">{p.name}</p>
                          {p.description && <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.description}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${CAT_COLOR[p.category] || CAT_COLOR.general}`}>{p.category}</span>
                            <span className="text-[9px] text-slate-600 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {fmt(p.updated_at)}
                            </span>
                            {p.version_count > 0 && (
                              <span className="text-[9px] text-oldgold-400 font-bold">v{p.latest_version} · {p.version_count} saves</span>
                            )}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteProject(p.id, p.name); }}
                          className="text-slate-700 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MAIN PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Active project header bar */}
        {activeProject && (
          <div className="shrink-0 border-b border-midnight-800 bg-midnight-900 px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${CAT_COLOR[activeProject.category] || CAT_COLOR.general}`}>{activeProject.category}</span>
              <span className="text-sm font-bold text-white truncate">{activeProject.name}</span>
              <span className="text-[10px] text-oldgold-400 font-mono">v{activeProject.latest_version}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saveMsg && <span className="text-[10px] text-cyan-400">{saveMsg}</span>}
              <button onClick={() => saveVersion()} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1 bg-oldgold-500/20 hover:bg-oldgold-500/40 border border-oldgold-500/40 text-oldgold-400 font-bold text-[11px] rounded-lg transition-all disabled:opacity-40">
                <Save className="w-3 h-3" />
                {saving ? 'Saving…' : 'Save Version'}
              </button>

              {/* version history toggle */}
              <button onClick={() => setExpandedVersions(expandedVersions === activeProject.id ? null : activeProject.id)}
                className="flex items-center gap-1 px-2 py-1 border border-midnight-700 hover:border-midnight-600 text-slate-400 hover:text-slate-200 text-[11px] rounded-lg transition-all">
                <Clock className="w-3 h-3" />
                History
                {expandedVersions === activeProject.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              <button onClick={() => setActiveProject(null)} className="text-slate-500 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Version history drawer */}
        {activeProject && expandedVersions === activeProject.id && (
          <div className="shrink-0 border-b border-midnight-800 bg-midnight-950 px-4 py-3 max-h-40 overflow-y-auto">
            {activeProject.versions.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic">No saved versions yet. Hit "Save Version" after working in ComfyUI.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {[...activeProject.versions].reverse().map(v => (
                  <div key={v.version} className="bg-midnight-900 border border-midnight-700 rounded-lg px-3 py-2 text-[10px] min-w-[160px]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-oldgold-400 font-bold">v{v.version}</span>
                      <span className="text-slate-600">{fmt(v.saved_at)}</span>
                    </div>
                    <p className="text-slate-400 truncate">{v.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ComfyUI iframe or offline state */}
        <div className="flex-1 relative overflow-hidden">
          {status?.online ? (
            <iframe src={url} title="ComfyUI" className="w-full h-full border-0" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-midnight-900 border border-midnight-800 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-slate-600" />
              </div>

              <h2 className="text-xl font-bold text-slate-200 mb-2">ComfyUI not running</h2>

              {status?.install_path ? (
                <>
                  <p className="text-slate-400 max-w-sm mb-1 text-sm">Found at:</p>
                  <p className="font-mono text-[11px] text-cyan-400 mb-5 max-w-sm break-all">{status.install_path}</p>
                  <button onClick={launch} disabled={launching}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all mb-3">
                    <Play className="w-4 h-4" />
                    {launching ? 'Launching…' : 'Launch ComfyUI'}
                  </button>
                  <p className="text-[10px] text-slate-600 mb-6">Opens in a new window on port 8188, then auto-connects here.</p>
                </>
              ) : (
                <>
                  <p className="text-slate-400 max-w-md mb-5 text-sm leading-relaxed">
                    ComfyUI not found. Install from GitHub, then BERYL will auto-detect and embed it here.
                  </p>
                  <a href="https://github.com/comfyanonymous/ComfyUI" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold px-5 py-2 rounded-xl text-sm transition-all mb-5">
                    <ExternalLink className="w-4 h-4" /> ComfyUI on GitHub
                  </a>
                  <div className="text-[10px] text-slate-500 mb-6 max-w-xs">
                    After installing, set <code className="text-cyan-400">COMFYUI_PATH</code> in your <code className="text-cyan-400">.env</code> to the full path of <code className="text-cyan-400">main.py</code>.
                  </div>
                </>
              )}

              <div className="bg-midnight-900 border border-midnight-800 rounded-xl px-4 py-2.5 font-mono text-[11px] text-cyan-400 flex items-center gap-3 max-w-sm">
                <span className="truncate">python main.py --listen 127.0.0.1 --port 8188</span>
                <button onClick={copyCmd} className="text-slate-500 hover:text-slate-300 shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button onClick={check} disabled={checking}
                className="mt-4 flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> Re-check
              </button>

              {/* Project DB still usable offline */}
              <div className="mt-8 border-t border-midnight-800 pt-6 max-w-sm w-full text-left">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">
                  Project library — {projects.length} project{projects.length !== 1 ? 's' : ''}
                </p>
                {projects.slice(0, 3).map(p => (
                  <div key={p.id} onClick={() => openProject(p.id)}
                    className="flex items-center justify-between px-3 py-2 mb-1 rounded-lg bg-midnight-900 border border-midnight-800 hover:border-midnight-600 cursor-pointer transition-colors">
                    <span className="text-sm text-slate-300 truncate">{p.name}</span>
                    <span className="text-[9px] text-oldgold-400 shrink-0 ml-2">v{p.latest_version}</span>
                  </div>
                ))}
                {projects.length > 3 && (
                  <p className="text-[10px] text-slate-600 mt-1">+{projects.length - 3} more in sidebar</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComfyUIMirror;
