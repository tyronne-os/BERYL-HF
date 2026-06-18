import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Send, Bot, Brain, ChevronDown, Zap, Hammer, FolderOpen, Database,
  Plus, Rocket, Loader2, CheckCircle2, Circle, FileCode2, FileText,
  FileJson, Globe, Copy, ChevronRight, Sparkles, Layers, Package,
  TerminalSquare, X, RefreshCw, Star,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API } from '../api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'assistant'; content: string; reasoning?: string; }
interface GeneratedFile { name: string; content: string; type: string; done: boolean; }
interface HFTable { name: string; columns: string[]; rows: number; }
interface HFBackendState { enabled: boolean; repoId: string; tables: HFTable[]; loading: boolean; }

interface BerylBuilderProps {
  model: string;
  isComputerUseEnabled: boolean;
  onArtifactCreated: (artifact: any) => void;
}

// ── System prompts ─────────────────────────────────────────────────────────────
const CHAT_SYSTEM = `You are BERYL, an elite autonomous AI builder running inside the BERYL HF personal build environment.
You have access to: Ollama local models, HF Inference API, HF 11TB private storage (as database), Agent Studio, O.V.E voice agent, CLI, GPU monitoring, and GEN SHERMAN security.
Be concise, expert, and highly technical. Reference real capabilities only.`;

const BUILD_SYSTEM = `You are BERYL Autonomous Builder — the most capable single-prompt app generator.

When given a build request, you MUST follow this exact output format:

STEP 1 — Output a plan block:
<beryl_plan>
App: [app name]
Stack: [tech stack]
Files: [comma-separated list of files to generate]
Features: [key features, one per line]
</beryl_plan>

STEP 2 — Generate each file using this exact format (the delimiters must be exact):
===FILE: filename.ext===
[COMPLETE file content — no placeholders, no "// TODO", fully working code]
===END===

STEP 3 — After ALL files, output:
<beryl_complete>
Built [N] files. App is ready to preview.
</beryl_complete>

CRITICAL RULES:
- Every file must be 100% complete and functional
- HTML files must be beautiful, modern, responsive (dark theme preferred)
- Include inline styles or a separate CSS file
- If the app needs data, use localStorage or the BerylDB client below
- Never reference external images you cannot actually load
- Make it production-quality — this is going in a live preview immediately

BerylDB client (include this in JS when the app needs persistent data):
\`\`\`javascript
const BerylDB = {
  _base: 'http://127.0.0.1:8001/hf-backend',
  from(table) {
    return {
      select: (project) => fetch(\`\${BerylDB._base}/rows?project=\${project}&table=\${table}\`).then(r=>r.json()),
      insert: (project, record) => fetch(\`\${BerylDB._base}/insert\`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project,table,record})}).then(r=>r.json()),
      delete: (project, id) => fetch(\`\${BerylDB._base}/delete\`, {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({project,table,id})}).then(r=>r.json()),
    };
  }
};
\`\`\``;

// ── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATES = [
  { label: 'Landing Page', icon: '🌐', prompt: 'Build a stunning dark-themed SaaS landing page with hero section, features grid, pricing cards, testimonials, and CTA footer. Modern glassmorphism design.' },
  { label: 'Dashboard', icon: '📊', prompt: 'Build a dark analytics dashboard with sidebar nav, KPI cards with sparklines, a data table with filters, and a chart area using SVG. Include a top header with user avatar.' },
  { label: 'Todo / Kanban', icon: '📋', prompt: 'Build a Kanban board with 3 columns (Todo/In Progress/Done), drag-drop cards, add card forms, priority badges, and persistent data via BerylDB.' },
  { label: 'Portfolio', icon: '🎨', prompt: 'Build a personal portfolio with animated hero, skills grid, project cards with hover effects, a contact form, and smooth scroll navigation. Dark modern design.' },
  { label: 'Blog', icon: '✍️', prompt: 'Build a blog platform with homepage listing posts with thumbnails, a post detail view, search bar, tag filters, and BerylDB for persistent posts.' },
  { label: 'E-Commerce', icon: '🛒', prompt: 'Build a product catalog page with card grid, cart sidebar, filters panel, product detail modal, and BerylDB cart persistence. Dark luxury aesthetic.' },
  { label: 'AI Chat UI', icon: '🤖', prompt: 'Build a beautiful AI chat interface with streaming message bubbles, typing indicator, conversation sidebar, model selector dropdown, and copy-to-clipboard buttons.' },
  { label: 'Form Builder', icon: '📝', prompt: 'Build a dynamic form builder with drag-drop field types (text, select, checkbox, date), live preview, JSON export, and BerylDB form submission storage.' },
];

// ── File type icons ────────────────────────────────────────────────────────────
function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'html') return <Globe className="w-3.5 h-3.5 text-orange-400" />;
  if (ext === 'css') return <Sparkles className="w-3.5 h-3.5 text-blue-400" />;
  if (ext === 'js' || ext === 'ts') return <FileCode2 className="w-3.5 h-3.5 text-yellow-400" />;
  if (ext === 'json') return <FileJson className="w-3.5 h-3.5 text-green-400" />;
  return <FileText className="w-3.5 h-3.5 text-slate-400" />;
}

// ── Build phases ──────────────────────────────────────────────────────────────
const PHASES = ['Planning', 'Scaffolding', 'Building', 'Preview', 'Done'] as const;
type Phase = typeof PHASES[number];

// ── Parse helpers ─────────────────────────────────────────────────────────────
function parseFiles(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  // Primary format: ===FILE: name===...===END===
  const primary = /===FILE:\s*([^\n=]+)===\n([\s\S]*?)===END===/g;
  let m;
  while ((m = primary.exec(text)) !== null) {
    const name = m[1].trim();
    const content = m[2].trimEnd();
    const ext = name.split('.').pop()?.toLowerCase() || 'txt';
    files.push({ name, content, type: ext, done: true });
  }
  // Fallback: named code blocks like ```html <!-- index.html -->
  if (files.length === 0) {
    const cb = /```(\w+)[^\n]*\n([\s\S]*?)```/g;
    while ((m = cb.exec(text)) !== null) {
      const lang = m[1];
      if (['html', 'css', 'javascript', 'js', 'json'].includes(lang)) {
        const idx = files.length;
        const ext = lang === 'javascript' ? 'js' : lang;
        files.push({ name: `file${idx > 0 ? idx : ''}.${ext}`, content: m[2].trim(), type: ext, done: true });
      }
    }
  }
  return files;
}

function parsePlan(text: string): string {
  const m = /<beryl_plan>([\s\S]*?)<\/beryl_plan>/i.exec(text);
  return m ? m[1].trim() : '';
}

function isComplete(text: string): boolean {
  return /<beryl_complete>/i.test(text);
}

// ── Reasoning block ───────────────────────────────────────────────────────────
const ReasoningBlock: React.FC<{ text: string; thinking: boolean }> = ({ text, thinking }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-lg border border-midnight-700 bg-midnight-950/60 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-oldgold-400/80 hover:bg-midnight-900">
        <span className="flex items-center gap-1.5"><Brain className={`w-3 h-3 ${thinking ? 'animate-pulse' : ''}`} />{thinking ? 'Thinking…' : 'Reasoning'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 py-2 text-[11px] text-slate-400 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto border-t border-midnight-700">{text}</div>}
    </div>
  );
};

// ── HF Backend Panel ─────────────────────────────────────────────────────────
const HFBackendPanel: React.FC<{
  state: HFBackendState;
  projectName: string;
  onInit: () => void;
  onCreateTable: (name: string, cols: string[]) => void;
}> = ({ state, projectName, onInit, onCreateTable }) => {
  const [newTable, setNewTable] = useState('');
  const [newCols, setNewCols] = useState('id, name, created_at');
  const [showCreate, setShowCreate] = useState(false);
  const sdkSnippet = `const BerylDB = {\n  _base: 'http://127.0.0.1:8001/hf-backend',\n  from: (table) => ({\n    select: () => fetch(\`\${BerylDB._base}/rows?project=${projectName}&table=\${table}\`).then(r=>r.json()),\n    insert: (record) => fetch(\`\${BerylDB._base}/insert\`, {method:'POST',body:JSON.stringify({project:'${projectName}',table,record})}).then(r=>r.json()),\n  })\n};`;

  return (
    <div className="border-t border-midnight-800 bg-midnight-950/80">
      <div className="px-4 py-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">HF Backend</span>
          </div>
          {!state.enabled ? (
            <button onClick={onInit} disabled={state.loading || !projectName}
              className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500 border border-cyan-500/30 text-cyan-400 hover:text-white rounded-lg text-[10px] font-black transition-all disabled:opacity-40">
              {state.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Initialize DB
            </button>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />CONNECTED
            </span>
          )}
        </div>

        {!projectName && (
          <p className="text-[10px] text-slate-500 italic">Enter a project name above first.</p>
        )}

        {state.enabled && (
          <>
            <div className="bg-midnight-900 rounded-lg p-2.5 border border-midnight-800">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Private HF Dataset</p>
              <p className="text-[11px] font-mono text-cyan-400">AIBRUH/{state.repoId.split('/').pop()}</p>
            </div>

            {/* Tables */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tables</span>
                <button onClick={() => setShowCreate(!showCreate)} className="text-[9px] text-cyan-400 hover:underline flex items-center gap-0.5">
                  <Plus className="w-2.5 h-2.5" />New Table
                </button>
              </div>
              {state.tables.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic">No tables yet.</p>
              ) : (
                <div className="space-y-1">
                  {state.tables.map(t => (
                    <div key={t.name} className="flex items-center justify-between bg-midnight-900 rounded px-2 py-1 border border-midnight-800">
                      <span className="text-[10px] font-mono text-slate-300">{t.name}</span>
                      <span className="text-[9px] text-slate-500">{t.rows} rows · {t.columns.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
              {showCreate && (
                <div className="mt-2 space-y-1.5">
                  <input value={newTable} onChange={e => setNewTable(e.target.value)} placeholder="table_name"
                    className="w-full bg-midnight-900 border border-midnight-700 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500" />
                  <input value={newCols} onChange={e => setNewCols(e.target.value)} placeholder="id, name, email"
                    className="w-full bg-midnight-900 border border-midnight-700 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500" />
                  <button onClick={() => { onCreateTable(newTable, newCols.split(',').map(c => c.trim())); setNewTable(''); setShowCreate(false); }}
                    disabled={!newTable.trim()}
                    className="w-full py-1.5 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-white border border-cyan-500/30 rounded text-[10px] font-black transition-all disabled:opacity-40">
                    Create Table
                  </button>
                </div>
              )}
            </div>

            {/* SDK Snippet */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Client SDK</span>
                <button onClick={() => navigator.clipboard.writeText(sdkSnippet)} className="text-[9px] text-slate-500 hover:text-white flex items-center gap-0.5">
                  <Copy className="w-2.5 h-2.5" />Copy
                </button>
              </div>
              <pre className="text-[9px] font-mono text-slate-400 bg-midnight-900 border border-midnight-800 rounded p-2 overflow-x-auto max-h-20 whitespace-pre-wrap">{sdkSnippet}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BERYL BUILDER — Main Component
// ═══════════════════════════════════════════════════════════════════════════════
type Mode = 'chat' | 'build';

const BerylBuilder: React.FC<BerylBuilderProps> = ({ model, isComputerUseEnabled, onArtifactCreated }) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // BUILD mode
  const [projectName, setProjectName] = useState('');
  const [buildPhase, setBuildPhase] = useState<Phase | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [buildPlan, setBuildPlan] = useState('');
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // HF Backend
  const [hfBackend, setHfBackend] = useState<HFBackendState>({ enabled: false, repoId: '', tables: [], loading: false });
  const [showBackend, setShowBackend] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, buildLog]);

  // ── HF Backend handlers ───────────────────────────────────────────────────
  const initHFBackend = async () => {
    if (!projectName.trim()) return;
    setHfBackend(s => ({ ...s, loading: true }));
    try {
      const { data } = await axios.post(`${API}/hf-backend/init`, { project: projectName.trim().toLowerCase().replace(/\s+/g, '-') });
      setHfBackend({ enabled: true, repoId: data.repo_id, tables: [], loading: false });
      addBuildLog(`✅ HF Backend initialized: ${data.repo_id}`);
    } catch (e) {
      setHfBackend(s => ({ ...s, loading: false }));
      addBuildLog('❌ HF Backend init failed');
    }
  };

  const createTable = async (name: string, cols: string[]) => {
    try {
      await axios.post(`${API}/hf-backend/create-table`, { project: projectName, table: name, columns: cols });
      setHfBackend(s => ({ ...s, tables: [...s.tables, { name, columns: cols, rows: 0 }] }));
      addBuildLog(`✅ Table created: ${name} (${cols.join(', ')})`);
    } catch { addBuildLog(`❌ Failed to create table: ${name}`); }
  };

  const addBuildLog = (msg: string) => setBuildLog(prev => [...prev, msg]);

  // ── Chat submit ─────────────────────────────────────────────────────────────
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: CHAT_SYSTEM }, ...messages, userMsg],
          stream: true,
        }),
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '', reasoning = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '', reasoning: '' }]);
      if (reader) {
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.reasoning) { reasoning += d.reasoning; setMessages(p => { const m=[...p]; m[m.length-1]={...m[m.length-1],reasoning}; return m; }); }
              if (d.content)   { content += d.content;   setMessages(p => { const m=[...p]; m[m.length-1]={...m[m.length-1],content};   return m; }); }
            } catch {}
          }
        }
      }
      // Parse artifacts from chat response
      const htmlMatch = /```html\n([\s\S]*?)```/g;
      let m;
      while ((m = htmlMatch.exec(content)) !== null) {
        onArtifactCreated({ type: 'html', content: m[1], title: 'HTML Preview' });
      }
    } catch (err) { console.error(err); }
    finally { setIsStreaming(false); }
  };

  // ── Build submit ─────────────────────────────────────────────────────────
  const handleBuild = async () => {
    if (!input.trim() || isStreaming) return;
    const brief = input;
    setInput('');
    setGeneratedFiles([]);
    setBuildPlan('');
    setBuildLog([]);
    setIsStreaming(true);
    setBuildPhase('Planning');
    setShowTemplates(false);
    addBuildLog(`🔨 Starting build: "${brief}"`);
    addBuildLog(`🤖 Model: ${model.split('/').pop()}`);
    if (hfBackend.enabled) addBuildLog(`💾 HF Backend: ${hfBackend.repoId}`);

    const systemPrompt = BUILD_SYSTEM + (hfBackend.enabled ? `\n\nHF Backend is enabled for project "${projectName}". Include BerylDB client and use it for data persistence.` : '');

    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Build this app: ${brief}\n\nProject name: ${projectName || 'my-app'}\n\nGenerate all files completely. Make it beautiful and fully functional.` },
          ],
          stream: true,
          max_tokens: 8000,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let lastFileParsed = 0;

      if (reader) {
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.content) {
                fullContent += d.content;

                // Live phase detection
                if (/<beryl_plan>/i.test(fullContent) && buildPhase === 'Planning') {
                  setBuildPhase('Scaffolding');
                  addBuildLog('📋 Plan received — scaffolding files…');
                }
                if (/===FILE:/i.test(fullContent) && buildPhase !== 'Building') {
                  setBuildPhase('Building');
                  addBuildLog('⚙️ Generating files…');
                }

                // Extract plan
                const plan = parsePlan(fullContent);
                if (plan) setBuildPlan(plan);

                // Live file detection — announce new files as they start
                const fileStarts = fullContent.match(/===FILE:\s*([^\n=]+)===/g) || [];
                if (fileStarts.length > lastFileParsed) {
                  for (let i = lastFileParsed; i < fileStarts.length; i++) {
                    const fname = fileStarts[i].replace(/===FILE:\s*/, '').replace(/===$/, '').trim();
                    addBuildLog(`📄 Writing ${fname}…`);
                    setGeneratedFiles(prev => {
                      if (prev.find(f => f.name === fname)) return prev;
                      return [...prev, { name: fname, content: '', type: fname.split('.').pop() || 'txt', done: false }];
                    });
                  }
                  lastFileParsed = fileStarts.length;
                }
              }
            } catch {}
          }
        }
      }

      // Full parse when stream ends
      const files = parseFiles(fullContent);
      setGeneratedFiles(files);

      if (files.length > 0) {
        setBuildPhase('Preview');
        addBuildLog(`✅ Build complete — ${files.length} file${files.length > 1 ? 's' : ''} generated`);

        // Show first HTML file in canvas
        const htmlFile = files.find(f => f.type === 'html' || f.name.endsWith('.html'));
        if (htmlFile) {
          setSelectedFile(htmlFile.name);
          onArtifactCreated({ type: 'html', content: htmlFile.content, title: projectName || 'BERYL App' });
        }
        setTimeout(() => setBuildPhase('Done'), 1500);
      } else {
        addBuildLog('⚠️ No files parsed — check model output format');
        setBuildPhase(null);
      }
    } catch (err) {
      addBuildLog('❌ Build failed: ' + String(err));
      setBuildPhase(null);
    } finally {
      setIsStreaming(false);
    }
  };

  // ── Deploy to HF Spaces ───────────────────────────────────────────────────
  const deployToSpaces = async () => {
    const html = generatedFiles.find(f => f.name.endsWith('.html'));
    if (!html || !projectName) return;
    addBuildLog('🚀 Deploying to HF Spaces…');
    try {
      await axios.post(`${API}/deploy-space`, { name: projectName.toLowerCase().replace(/\s+/g, '-'), html: html.content });
      addBuildLog('✅ Deployed! Check HF Spaces for your live app.');
    } catch { addBuildLog('❌ Deploy failed — check HF token permissions.'); }
  };

  // ── File preview ───────────────────────────────────────────────────────────
  const previewFile = (file: GeneratedFile) => {
    setSelectedFile(file.name);
    if (file.type === 'html' || file.name.endsWith('.html')) {
      onArtifactCreated({ type: 'html', content: file.content, title: file.name });
    } else {
      onArtifactCreated({ type: 'code', content: file.content, title: file.name });
    }
  };

  const phaseIdx = buildPhase ? PHASES.indexOf(buildPhase) : -1;

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-midnight-900 text-slate-100 border-r border-midnight-800">

      {/* ── TOP BAR ── */}
      <div className="shrink-0 px-4 py-2.5 border-b border-midnight-800 bg-midnight-950/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-oldgold-500/20 border border-oldgold-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-oldgold-400" />
          </div>
          <span className="text-xs font-black text-white uppercase tracking-wider">BERYL</span>
          <span className="text-[9px] text-slate-600 font-mono truncate max-w-[100px]">{model.split('/').pop()}</span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center bg-midnight-950 rounded-lg p-0.5 border border-midnight-800 shrink-0">
          <button onClick={() => setMode('chat')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black transition-all ${mode === 'chat' ? 'bg-oldgold-500 text-midnight-950' : 'text-slate-500 hover:text-slate-300'}`}>
            <Bot className="w-3 h-3" /> CHAT
          </button>
          <button onClick={() => setMode('build')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black transition-all ${mode === 'build' ? 'bg-oldgold-500 text-midnight-950' : 'text-slate-500 hover:text-slate-300'}`}>
            <Hammer className="w-3 h-3" /> BUILD
          </button>
        </div>
      </div>

      {/* ══════════════════════════ BUILD MODE ══════════════════════════ */}
      {mode === 'build' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Project name + actions bar */}
          <div className="shrink-0 px-4 py-2 border-b border-midnight-800 flex items-center gap-2">
            <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="project-name"
              className="flex-1 bg-midnight-950 border border-midnight-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-oldgold-500 placeholder-slate-600 min-w-0 transition-colors" />
            <button onClick={() => setShowTemplates(!showTemplates)}
              className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black border transition-colors ${showTemplates ? 'bg-oldgold-500/20 text-oldgold-400 border-oldgold-500/30' : 'bg-midnight-800 text-slate-400 hover:text-white border-midnight-700'}`}>
              <Star className="w-3 h-3" /> Templates
            </button>
            {generatedFiles.length > 0 && (
              <button onClick={deployToSpaces}
                className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black border bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white border-green-500/30 transition-all">
                <Rocket className="w-3 h-3" /> Deploy
              </button>
            )}
          </div>

          {/* Templates grid */}
          {showTemplates && (
            <div className="shrink-0 border-b border-midnight-800 p-3 bg-midnight-950/60">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">Quick Start Templates</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => { setInput(t.prompt); setShowTemplates(false); inputRef.current?.focus(); }}
                    className="text-left px-2.5 py-2 rounded-lg bg-midnight-900 border border-midnight-800 hover:border-oldgold-500/40 transition-colors">
                    <div className="text-sm">{t.icon}</div>
                    <div className="text-[10px] font-bold text-slate-300 mt-0.5">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Build progress bar */}
          {buildPhase && (
            <div className="shrink-0 px-4 py-2.5 border-b border-midnight-800 bg-midnight-950/40">
              <div className="flex items-center gap-1.5 mb-2">
                {PHASES.map((p, i) => (
                  <React.Fragment key={p}>
                    <div className="flex items-center gap-1">
                      {i < phaseIdx ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : i === phaseIdx ? (
                        <Loader2 className={`w-3.5 h-3.5 text-oldgold-400 shrink-0 ${buildPhase !== 'Done' ? 'animate-spin' : ''}`} />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-wider ${i === phaseIdx ? 'text-oldgold-400' : i < phaseIdx ? 'text-green-400' : 'text-slate-700'}`}>{p}</span>
                    </div>
                    {i < PHASES.length - 1 && <div className={`flex-1 h-px ${i < phaseIdx ? 'bg-green-500/40' : 'bg-midnight-700'}`} />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Build content: plan + file tree + log */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Plan */}
            {buildPlan && (
              <div className="bg-midnight-950 border border-oldgold-500/20 rounded-xl p-3">
                <p className="text-[9px] font-black text-oldgold-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Build Plan
                </p>
                <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{buildPlan}</pre>
              </div>
            )}

            {/* File tree */}
            {generatedFiles.length > 0 && (
              <div className="bg-midnight-950 border border-midnight-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-midnight-800 bg-midnight-900/60">
                  <FolderOpen className="w-3.5 h-3.5 text-oldgold-400" />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">{projectName || 'my-app'}</span>
                  <span className="ml-auto text-[9px] text-slate-500">{generatedFiles.length} files</span>
                </div>
                <div className="divide-y divide-midnight-800/50">
                  {generatedFiles.map(file => (
                    <button key={file.name} onClick={() => previewFile(file)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-midnight-800/60 transition-colors
                        ${selectedFile === file.name ? 'bg-midnight-800/80 border-l-2 border-oldgold-500' : ''}`}>
                      {fileIcon(file.name)}
                      <span className="text-xs font-mono text-slate-300 flex-1 truncate">{file.name}</span>
                      {file.done ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                      ) : (
                        <Loader2 className="w-3 h-3 text-oldgold-400 animate-spin shrink-0" />
                      )}
                      {file.content && (
                        <span className="text-[9px] text-slate-600">{file.content.split('\n').length}L</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Build log */}
            {buildLog.length > 0 && (
              <div className="bg-midnight-950 border border-midnight-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-midnight-800 bg-midnight-900/60">
                  <TerminalSquare className="w-3 h-3 text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Build Log</span>
                </div>
                <div className="p-3 space-y-0.5 font-mono text-[10px] text-slate-400 max-h-48 overflow-y-auto">
                  {buildLog.map((line, i) => (
                    <div key={i} className={`leading-relaxed ${line.startsWith('✅') ? 'text-green-400' : line.startsWith('❌') ? 'text-red-400' : line.startsWith('📄') ? 'text-oldgold-400' : line.startsWith('🚀') ? 'text-purple-400' : ''}`}>
                      {line}
                    </div>
                  ))}
                  {isStreaming && <div className="text-oldgold-400 animate-pulse">▋</div>}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!buildPhase && generatedFiles.length === 0 && buildLog.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-oldgold-500/10 border border-oldgold-500/20 flex items-center justify-center mb-4">
                  <Hammer className="w-7 h-7 text-oldgold-400/60" />
                </div>
                <p className="text-sm font-bold text-slate-400">Autonomous Builder</p>
                <p className="text-xs text-slate-600 mt-1">Describe your app or pick a template above</p>
                <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-xs">
                  {TEMPLATES.slice(0, 4).map(t => (
                    <button key={t.label} onClick={() => { setInput(t.prompt); inputRef.current?.focus(); }}
                      className="text-left px-3 py-2 rounded-lg bg-midnight-900 border border-midnight-800 hover:border-oldgold-500/30 transition-all">
                      <span className="text-base">{t.icon}</span>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* HF Backend toggle */}
          <div className="shrink-0">
            <button onClick={() => setShowBackend(!showBackend)}
              className={`w-full flex items-center justify-between px-4 py-2 border-t border-midnight-800 transition-colors text-[10px] font-black uppercase tracking-wider
                ${showBackend ? 'bg-cyan-500/5 text-cyan-400' : 'bg-midnight-950/40 text-slate-500 hover:text-slate-300'}`}>
              <span className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                HF Backend {hfBackend.enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              </span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showBackend ? 'rotate-90' : ''}`} />
            </button>
            {showBackend && (
              <HFBackendPanel state={hfBackend} projectName={projectName} onInit={initHFBackend} onCreateTable={createTable} />
            )}
          </div>

          {/* BUILD input */}
          <div className="shrink-0 p-3 border-t border-midnight-800 bg-midnight-950/60">
            <div className="relative bg-midnight-900 border border-midnight-800 rounded-xl overflow-hidden focus-within:border-oldgold-500/50 transition-colors">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleBuild(); } }}
                placeholder="Describe what to build… (⌘Enter to build)"
                className="w-full bg-transparent text-slate-100 px-4 py-3 text-sm focus:outline-none resize-none min-h-[70px] max-h-32 placeholder-slate-600" rows={3} />
              <div className="px-3 py-2 border-t border-midnight-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-slate-600">
                  {hfBackend.enabled && <span className="flex items-center gap-1 text-cyan-500"><Database className="w-3 h-3" />DB ON</span>}
                  <span>{input.length} chars</span>
                </div>
                <button onClick={handleBuild} disabled={isStreaming || !input.trim()}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all
                    ${input.trim() && !isStreaming
                      ? 'bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                      : 'bg-midnight-800 text-slate-600 cursor-not-allowed'}`}>
                  {isStreaming ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Building…</> : <><Zap className="w-3.5 h-3.5" />BUILD</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════ CHAT MODE ═══════════════════════════ */}
      {mode === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 opacity-60">
                <div className="w-16 h-16 rounded-2xl bg-midnight-800 border border-midnight-700 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-oldgold-400" />
                </div>
                <p className="text-sm font-bold">Ask BERYL anything</p>
                <p className="text-xs text-center max-w-48">Switch to BUILD mode to autonomously create full apps from a single prompt.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-oldgold-500' : 'bg-midnight-800 border border-midnight-700'}`}>
                    {msg.role === 'user' ? <span className="text-[10px] font-black text-midnight-950">YOU</span> : <Zap className="w-3.5 h-3.5 text-oldgold-400" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-oldgold-500/20 border border-oldgold-500/30 text-slate-100' : 'bg-midnight-900 border border-midnight-800 text-slate-200'}`}>
                    {msg.reasoning && <ReasoningBlock text={msg.reasoning} thinking={!msg.content && isStreaming} />}
                    {msg.content ? (
                      <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    ) : msg.role === 'assistant' && !msg.reasoning ? (
                      <span className="text-slate-600">…</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-midnight-900 p-3 rounded-2xl border border-midnight-800 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-oldgold-400 animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-oldgold-400 animate-bounce [animation-delay:0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-oldgold-400 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="shrink-0 p-3 border-t border-midnight-800 bg-midnight-950/60">
            <div className="relative bg-midnight-900 border border-midnight-800 rounded-xl overflow-hidden focus-within:border-oldgold-500/50 transition-colors">
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e); } }}
                placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
                className="w-full bg-transparent text-slate-100 px-4 py-3 text-sm focus:outline-none resize-none min-h-[52px] max-h-32 placeholder-slate-600" rows={2} />
              <div className="px-3 py-2 border-t border-midnight-800 flex items-center justify-between">
                <button type="button" onClick={() => setMode('build')}
                  className="text-[10px] text-slate-500 hover:text-oldgold-400 flex items-center gap-1 transition-colors">
                  <Hammer className="w-3 h-3" /> Switch to Build Mode
                </button>
                <button type="submit" disabled={isStreaming || !input.trim()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all
                    ${input.trim() && !isStreaming ? 'bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950' : 'bg-midnight-800 text-slate-600 cursor-not-allowed'}`}>
                  {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} SEND
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BerylBuilder;
