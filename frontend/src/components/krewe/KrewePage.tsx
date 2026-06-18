import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, ReactFlowProvider, Panel,
  BackgroundVariant,
} from '@xyflow/react';
import type { Connection, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play, Sparkles, Trash2, Plus, Send, X, Cpu, Brain,
  Wrench, Layers, Users, Loader2, Bot,
} from 'lucide-react';
import DollNode, { UNIFORMS } from './DollNode';
import type { DollData, DollNodeType } from './DollNode';
import AvatarStage from './AvatarStage';
import { KREWE_ROSTER, rosterToData, AVATAR_PIPELINE } from './roster';
import type { RosterEntry } from './roster';
import { API } from '../../api';

const nodeTypes = { doll: DollNode };

const MODEL_SUGGESTIONS = [
  'MiniMaxAI/MiniMax-M3', 'hf-gpu', 'ove-voice', 'comfyui', 'trigger', 'edge-stream',
  'ollama/llama3.2', 'ollama/qwen2.5', 'ollama/deepseek-r1',
];

const edgeStyle = { stroke: '#d4af37', strokeWidth: 2.5 };

interface ChatMsg { role: 'user' | 'assistant'; text: string; }

function KreweCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<DollNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const idCounter = useRef(0);
  const placeCount = useRef(0);

  const [configTarget, setConfigTarget] = useState<{ id: string; section: 'head' | 'torso' | 'purse' } | null>(null);
  const [running, setRunning] = useState(false);
  const [leftTab, setLeftTab] = useState<'build' | 'roster'>('build');

  // chat (build the squad conversationally)
  const [chat, setChat] = useState<ChatMsg[]>([{
    role: 'assistant',
    text: 'I\'m your KREWE foreman. Tell me what avatar to build — e.g. "a friendly news anchor that reads my headlines" — and I\'ll assign the dolls and hold their hands for you. Or drop dolls from the Roster tab.',
  }]);
  const [chatInput, setChatInput] = useState('');
  const [planning, setPlanning] = useState(false);

  // avatar stage
  const [avatar, setAvatar] = useState({
    faceUniform: 'gala' as DollData['uniform'],
    speaking: false,
    line: '',
    status: 'idle' as 'idle' | 'building' | 'live',
    fps: 0,
  });

  const openConfig = useCallback((id: string, section: 'head' | 'torso' | 'purse') => {
    setConfigTarget({ id, section });
  }, []);

  const newId = () => `doll_${++idCounter.current}`;

  const addDoll = useCallback((entry: RosterEntry, pos?: { x: number; y: number }) => {
    const i = placeCount.current++;
    const position = pos ?? { x: 80 + (i % 4) * 210, y: 60 + Math.floor(i / 4) * 280 };
    const id = newId();
    setNodes((nds) => nds.concat({
      id, type: 'doll', position,
      data: rosterToData(entry, openConfig),
    }));
    return id;
  }, [openConfig, setNodes]);

  const updateNodeData = useCallback((id: string, patch: Partial<DollData>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [setNodes]);

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({
      ...c, animated: true, style: edgeStyle,
      // a soft "holding hands" link
      type: 'default',
    }, eds));
  }, [setEdges]);

  // ── Load the canonical avatar pipeline, pre-connected ──────────────────────
  const loadAvatarSquad = useCallback(() => {
    setNodes([]); setEdges([]); placeCount.current = 0; idCounter.current = 0;
    const placed: { key: string; id: string }[] = [];
    AVATAR_PIPELINE.forEach((key, i) => {
      const entry = KREWE_ROSTER.find((r) => r.key === key)!;
      const id = `doll_${++idCounter.current}`;
      placed.push({ key, id });
      setNodes((nds) => nds.concat({
        id, type: 'doll',
        position: { x: 40 + i * 230, y: 140 + (i % 2) * 70 },
        data: rosterToData(entry, openConfig),
      }));
    });
    setEdges(placed.slice(0, -1).map((p, i) => ({
      id: `e_${p.id}_${placed[i + 1].id}`,
      source: p.id, target: placed[i + 1].id,
      sourceHandle: 'out', targetHandle: 'in',
      animated: true, style: edgeStyle, type: 'default',
    })));
    placeCount.current = placed.length;
    setAvatar((a) => ({ ...a, faceUniform: 'gala', status: 'idle', line: '', speaking: false }));
  }, [openConfig, setNodes, setEdges]);

  // ── SQUAD UP: execute the DAG ──────────────────────────────────────────────
  const runSquad = useCallback(async () => {
    if (nodes.length === 0 || running) return;
    setRunning(true);
    setAvatar((a) => ({ ...a, status: 'building', speaking: false, line: '', fps: 0 }));
    // reset statuses
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'idle' as const, purseActive: false } })));

    // build order from edges (topological-ish: follow the chain; fall back to placement order)
    const order = topoOrder(nodes.map((n) => n.id), edges);

    let finalLine = '';
    let faceUniform: DollData['uniform'] = 'gala';

    try {
      const payload = {
        nodes: nodes.map((n) => ({
          id: n.id, name: n.data.name, role: n.data.role, uniform: n.data.uniform,
          model: n.data.model, system: n.data.systemPrompt, temperature: n.data.temperature,
          tools: n.data.tools, isGpu: !!n.data.isGpu,
        })),
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
        goal: chat.filter((c) => c.role === 'user').slice(-1)[0]?.text || 'Greet the viewer warmly.',
      };
      const res = await fetch(`${API}/krewe/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = res.ok ? await res.json() : null;

      const steps: { id: string; output: string }[] =
        data?.steps ?? order.map((id) => ({ id, output: '…' }));
      finalLine = data?.final_line || '';

      // animate the trace doll-by-doll
      for (const step of steps) {
        const node = nodes.find((n) => n.id === step.id);
        if (node?.data.uniform === 'gala' || node?.data.uniform === 'artist') faceUniform = node.data.uniform;
        updateNodeData(step.id, { status: 'running', purseActive: node ? node.data.tools.length > 0 : false });
        await wait(620);
        updateNodeData(step.id, { status: 'done', purseActive: false, lastOutput: step.output });
      }
      if (!finalLine) finalLine = steps[steps.length - 1]?.output || 'Hello — the squad is live.';
    } catch {
      // resilient fallback — simulate
      for (const id of order) {
        updateNodeData(id, { status: 'running', purseActive: true });
        await wait(500);
        updateNodeData(id, { status: 'done', purseActive: false });
      }
      finalLine = 'Hello! Your KREWE squad is connected and live.';
    }

    // drive the avatar stage
    setAvatar({ faceUniform, speaking: true, line: finalLine, status: 'live', fps: 0 });
    // fps ramp
    let f = 0; const fpsTimer = setInterval(() => {
      f = Math.min(28, f + 4 + Math.random() * 3);
      setAvatar((a) => ({ ...a, fps: f }));
      if (f >= 28) clearInterval(fpsTimer);
    }, 200);
    // stop speaking after a beat proportional to line length
    const speakMs = Math.min(9000, 1800 + finalLine.length * 45);
    setTimeout(() => setAvatar((a) => ({ ...a, speaking: false })), speakMs);
    setRunning(false);
  }, [nodes, edges, running, chat, setNodes, updateNodeData]);

  // ── Build via chat: AI designs the squad ───────────────────────────────────
  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || planning) return;
    setChat((c) => [...c, { role: 'user', text }]);
    setChatInput('');
    setPlanning(true);
    try {
      const res = await fetch(`${API}/krewe/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: text, roster: KREWE_ROSTER.map((r) => ({ key: r.key, role: r.role, blurb: r.blurb })) }),
      });
      const plan = res.ok ? await res.json() : null;
      if (plan?.dolls?.length) {
        applyPlan(plan.dolls, plan.edges || []);
        setChat((c) => [...c, { role: 'assistant', text: plan.note || `Assigned ${plan.dolls.length} dolls and held their hands. Hit SQUAD UP to go live.` }]);
      } else {
        // fallback: load the canonical avatar squad
        loadAvatarSquad();
        setChat((c) => [...c, { role: 'assistant', text: 'I dropped in the full Avatar Squad as a starting point — tweak any doll\'s head or purse, then SQUAD UP.' }]);
      }
    } catch {
      loadAvatarSquad();
      setChat((c) => [...c, { role: 'assistant', text: 'Backend offline — I placed the default Avatar Squad locally so you can keep building.' }]);
    }
    setPlanning(false);
  }, [chatInput, planning, loadAvatarSquad]);

  const applyPlan = useCallback((dollKeys: string[], pairs: [string, string][] | { from: string; to: string }[]) => {
    setNodes([]); setEdges([]); idCounter.current = 0; placeCount.current = 0;
    const idByKey: Record<string, string> = {};
    dollKeys.forEach((key, i) => {
      const entry = KREWE_ROSTER.find((r) => r.key === key);
      if (!entry) return;
      const id = `doll_${++idCounter.current}`;
      idByKey[key] = id;
      setNodes((nds) => nds.concat({
        id, type: 'doll',
        position: { x: 40 + i * 230, y: 140 + (i % 2) * 70 },
        data: rosterToData(entry, openConfig),
      }));
    });
    const norm = (pairs as any[]).map((p) => Array.isArray(p) ? { from: p[0], to: p[1] } : p);
    setEdges(norm.filter((p) => idByKey[p.from] && idByKey[p.to]).map((p) => ({
      id: `e_${p.from}_${p.to}`, source: idByKey[p.from], target: idByKey[p.to],
      sourceHandle: 'out', targetHandle: 'in', animated: true, style: edgeStyle, type: 'default',
    })));
    placeCount.current = dollKeys.length;
  }, [openConfig, setNodes, setEdges]);

  const clearCanvas = () => { setNodes([]); setEdges([]); setAvatar((a) => ({ ...a, status: 'idle', speaking: false, line: '' })); placeCount.current = 0; };

  const configNode = useMemo(() => nodes.find((n) => n.id === configTarget?.id), [nodes, configTarget]);

  return (
    <div className="flex flex-1 overflow-hidden bg-midnight-950">
      {/* ── LEFT RAIL: build chat + roster ───────────────────────────────── */}
      <div className="w-[300px] shrink-0 border-r border-midnight-800 flex flex-col bg-midnight-900">
        <div className="flex border-b border-midnight-800">
          {(['build', 'roster'] as const).map((t) => (
            <button key={t} onClick={() => setLeftTab(t)}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${
                leftTab === t ? 'text-oldgold-400 border-b-2 border-oldgold-400 bg-midnight-800/50' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t === 'build' ? <Bot className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              {t === 'build' ? 'Foreman' : 'Roster'}
            </button>
          ))}
        </div>

        {leftTab === 'build' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chat.map((m, i) => (
                <div key={i} className={`text-[12px] leading-relaxed ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block px-3 py-2 rounded-xl max-w-[90%] ${
                    m.role === 'user' ? 'bg-oldgold-500 text-midnight-950 font-medium' : 'bg-midnight-800 text-slate-200 border border-midnight-700'
                  }`}>{m.text}</div>
                </div>
              ))}
              {planning && (
                <div className="flex items-center gap-2 text-[11px] text-oldgold-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning the squad…
                </div>
              )}
            </div>
            <div className="p-2.5 border-t border-midnight-800">
              <div className="flex items-end gap-1.5">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  rows={2}
                  placeholder="Describe the avatar to build…"
                  className="flex-1 resize-none bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-oldgold-500 outline-none"
                />
                <button onClick={sendChat} disabled={planning}
                  className="p-2 rounded-lg bg-oldgold-500 text-midnight-950 hover:bg-oldgold-400 disabled:opacity-40 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {KREWE_ROSTER.map((r) => {
              const u = UNIFORMS[r.uniform];
              return (
                <button key={r.key} onClick={() => addDoll(r)}
                  className="w-full text-left p-2.5 rounded-xl bg-midnight-800/60 border border-midnight-700 hover:border-oldgold-500/60 hover:bg-midnight-800 transition-all group">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                         style={{ background: `${u.dress}33`, border: `1px solid ${u.accent}55` }}>{u.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-bold text-white truncate">{r.name}</span>
                        {r.isGpu && <span className="px-1 py-0.5 rounded bg-amber-500 text-[7px] font-black text-midnight-950">GPU</span>}
                      </div>
                      <span className="text-[9px] text-oldgold-400/80 uppercase tracking-wider">{r.role}</span>
                    </div>
                    <Plus className="w-4 h-4 text-slate-600 group-hover:text-oldgold-400 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-snug line-clamp-2">{r.blurb}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CENTER: the canvas ───────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} nodeTypes={nodeTypes}
          fitView proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: true, style: edgeStyle, type: 'default' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2438" />
          <Controls className="!bg-midnight-900 !border-midnight-700" />
          <MiniMap
            className="!bg-midnight-900 !border !border-midnight-700"
            nodeColor={(n) => UNIFORMS[(n.data as DollData)?.uniform]?.dress || '#666'}
            maskColor="rgba(13,6,20,0.7)"
          />

          {/* top toolbar */}
          <Panel position="top-center">
            <div className="flex items-center gap-1.5 bg-midnight-900/90 backdrop-blur-xl rounded-full p-1.5 border border-oldgold-500/30 shadow-[0_0_24px_rgba(212,175,55,0.15)]">
              <button onClick={runSquad} disabled={running || nodes.length === 0}
                className="px-4 py-1.5 rounded-full text-[11px] font-black flex items-center gap-1.5 bg-gradient-to-r from-oldgold-500 to-amber-500 text-midnight-950 hover:brightness-110 disabled:opacity-40 transition-all">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                SQUAD UP
              </button>
              <div className="w-px h-5 bg-midnight-700 mx-0.5" />
              <button onClick={loadAvatarSquad} title="Load the full Avatar Squad pipeline"
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-oldgold-400 hover:bg-midnight-800 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> Avatar Squad
              </button>
              <button onClick={() => setLeftTab('roster')} title="Add a doll"
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-oldgold-400 hover:bg-midnight-800 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Doll
              </button>
              <button onClick={clearCanvas} title="Clear canvas"
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-red-400 hover:bg-midnight-800 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </Panel>

          {nodes.length === 0 && (
            <Panel position="top-center">
              <div className="mt-20 text-center pointer-events-none select-none">
                <Users className="w-10 h-10 text-midnight-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Your canvas is empty</p>
                <p className="text-[11px] text-slate-600 mt-1">Ask the <span className="text-oldgold-400 font-bold">Foreman</span> to build a squad, or load the <span className="text-oldgold-400 font-bold">Avatar Squad</span></p>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* ── CONFIG DRAWER (head / torso / purse) ──────────────────────── */}
        {configTarget && configNode && (
          <ConfigDrawer
            section={configTarget.section}
            node={configNode}
            onClose={() => setConfigTarget(null)}
            onChange={(patch) => updateNodeData(configTarget.id, patch)}
          />
        )}
      </div>

      {/* ── RIGHT: live avatar stage ─────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 border-l border-midnight-800">
        <AvatarStage
          faceUniform={avatar.faceUniform}
          speaking={avatar.speaking}
          line={avatar.line}
          status={avatar.status}
          fps={avatar.fps}
        />
      </div>
    </div>
  );
}

// ── Config drawer ────────────────────────────────────────────────────────────
const ConfigDrawer: React.FC<{
  section: 'head' | 'torso' | 'purse';
  node: DollNodeType;
  onClose: () => void;
  onChange: (patch: Partial<DollData>) => void;
}> = ({ section, node, onClose, onChange }) => {
  const d = node.data;
  const [toolInput, setToolInput] = useState('');
  const meta = {
    head:  { icon: <Brain className="w-4 h-4" />, title: 'Head · Persona & Instructions' },
    torso: { icon: <Cpu className="w-4 h-4" />,   title: 'Torso · Model & Engine' },
    purse: { icon: <Wrench className="w-4 h-4" />, title: 'Purse · Tools & Functions' },
  }[section];

  return (
    <div className="absolute top-0 right-0 h-full w-[340px] bg-midnight-900 border-l border-midnight-700 shadow-2xl z-20 flex flex-col animate-[slideIn_0.15s_ease-out]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-midnight-800">
        <div className="flex items-center gap-2 text-oldgold-400">
          {meta.icon}
          <span className="text-[11px] font-bold uppercase tracking-wider">{meta.title}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-4 py-2 border-b border-midnight-800 flex items-center gap-2">
        <span className="text-2xl">{UNIFORMS[d.uniform].icon}</span>
        <div>
          <div className="text-sm font-bold text-white">{d.name}</div>
          <div className="text-[10px] text-oldgold-400/80 uppercase tracking-wider">{d.role}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {section === 'head' && (
          <>
            <Field label="System Instructions">
              <textarea value={d.systemPrompt} onChange={(e) => onChange({ systemPrompt: e.target.value })}
                rows={9} className="w-full resize-none bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:border-oldgold-500 outline-none" />
            </Field>
            <Field label={`Temperature · ${d.temperature.toFixed(2)}`}>
              <input type="range" min={0} max={1.5} step={0.05} value={d.temperature}
                onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-oldgold-500" />
            </Field>
          </>
        )}
        {section === 'torso' && (
          <>
            <Field label="Core Model / Engine">
              <input list="krewe-models" value={d.model} onChange={(e) => onChange({ model: e.target.value })}
                className="w-full bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:border-oldgold-500 outline-none" />
              <datalist id="krewe-models">
                {MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </Field>
            {d.isGpu && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-300">
                <Layers className="w-4 h-4 shrink-0" />
                This doll runs on HuggingFace GPU. Heavy renders (warp / lip-sync) execute here.
              </div>
            )}
            <p className="text-[10px] text-slate-500 leading-relaxed">
              The torso is the execution engine. Use an <code className="text-oldgold-400">ollama/*</code> id to run local & private,
              an HF repo id for hosted inference, or a special engine (<code className="text-oldgold-400">hf-gpu</code>, <code className="text-oldgold-400">ove-voice</code>, <code className="text-oldgold-400">comfyui</code>).
            </p>
          </>
        )}
        {section === 'purse' && (
          <>
            <Field label="Tools (Function Calling)">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {d.tools.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-midnight-800 border border-midnight-700 text-[11px] text-slate-300">
                    {t}
                    <button onClick={() => onChange({ tools: d.tools.filter((x) => x !== t) })} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {d.tools.length === 0 && <span className="text-[11px] text-slate-600 italic">No tools yet</span>}
              </div>
              <div className="flex gap-1.5">
                <input value={toolInput} onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && toolInput.trim()) { onChange({ tools: [...d.tools, toolInput.trim()] }); setToolInput(''); } }}
                  placeholder="add a tool…"
                  className="flex-1 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:border-oldgold-500 outline-none" />
                <button onClick={() => { if (toolInput.trim()) { onChange({ tools: [...d.tools, toolInput.trim()] }); setToolInput(''); } }}
                  className="px-2.5 rounded-lg bg-oldgold-500 text-midnight-950"><Plus className="w-4 h-4" /></button>
              </div>
            </Field>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              The purse fires tools in parallel to the torso runtime — webhooks, database queries, GPU jobs — regardless of hand-holding order.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
    {children}
  </div>
);

// ── helpers ──────────────────────────────────────────────────────────────────
function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function topoOrder(ids: string[], edges: Edge[]): string[] {
  const indeg: Record<string, number> = {}; const adj: Record<string, string[]> = {};
  ids.forEach((id) => { indeg[id] = 0; adj[id] = []; });
  edges.forEach((e) => { if (adj[e.source]) { adj[e.source].push(e.target); indeg[e.target] = (indeg[e.target] || 0) + 1; } });
  const q = ids.filter((id) => indeg[id] === 0); const out: string[] = [];
  while (q.length) {
    const id = q.shift()!; out.push(id);
    (adj[id] || []).forEach((t) => { indeg[t]--; if (indeg[t] === 0) q.push(t); });
  }
  // append any stragglers (cycles / disconnected) in placement order
  ids.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}

export default function KrewePage() {
  return (
    <ReactFlowProvider>
      <KreweCanvas />
    </ReactFlowProvider>
  );
}
