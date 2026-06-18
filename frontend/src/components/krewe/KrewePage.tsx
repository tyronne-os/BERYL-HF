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
  HeartPulse, Wand2, BookmarkPlus, Grid3x3, Factory,
} from 'lucide-react';
import DollNode, { UNIFORMS } from './DollNode';
import type { DollData, DollNodeType } from './DollNode';
import FlowEdge from './FlowEdge';
import type { EdgeStatus } from './FlowEdge';
import TheVanity from './TheVanity';
import VanityGallery, { ReportOverlay } from './VanityGallery';
import type { PortfolioEntry } from './VanityGallery';
import AssemblyLine from './AssemblyLine';
import GalleryView from './GalleryView';
import type { AssemblyEntry, AssemblyStats } from './types';
import PaperBanner from './PaperBanner';
import PaperOverlay from './PaperOverlay';
import type { ArxivPaper } from './PaperBanner';
import { KREWE_ROSTER, rosterToData, AVATAR_PIPELINE } from './roster';
import type { RosterEntry } from './roster';
import { API } from '../../api';

const nodeTypes = { doll: DollNode };
const edgeTypes = { flow: FlowEdge };

const BASE_EDGE_STYLE = { stroke: '#3a3050', strokeWidth: 2 };

interface ChatMsg {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

interface RunStep {
  id: string;
  status: 'done' | 'error';
  output: string;
  latency_ms: number;
  error: string | null;
}

// ── Pipeline health helpers ──────────────────────────────────────────────────
function calcHealth(nodes: DollNodeType[]) {
  const total = nodes.length;
  const done  = nodes.filter((n) => n.data.status === 'done').length;
  const error = nodes.filter((n) => n.data.status === 'error').length;
  return { total, done, error, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// ── Topo sort ────────────────────────────────────────────────────────────────
function topoOrder(ids: string[], edges: Edge[]): string[] {
  const indeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  ids.forEach((id) => { indeg[id] = 0; adj[id] = []; });
  edges.forEach((e) => {
    if (adj[e.source]) { adj[e.source].push(e.target); indeg[e.target] = (indeg[e.target] || 0) + 1; }
  });
  const q = ids.filter((id) => indeg[id] === 0);
  const out: string[] = [];
  while (q.length) {
    const id = q.shift()!; out.push(id);
    (adj[id] || []).forEach((t) => { if (--indeg[t] === 0) q.push(t); });
  }
  ids.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Main canvas component ────────────────────────────────────────────────────
function KreweCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<DollNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const idCounter = useRef(0);
  const placeCount = useRef(0);

  const [configTarget, setConfigTarget] = useState<{ id: string; section: 'head' | 'torso' | 'purse' } | null>(null);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [leftTab, setLeftTab] = useState<'build' | 'roster' | 'assembly'>('build');
  const [rosterCat, setRosterCat] = useState<'avatar' | 'ai-infra' | 'all'>('all');
  const [showGallery, setShowGallery] = useState(false);
  const [assemblyStats, setAssemblyStats] = useState<AssemblyStats | null>(null);

  // chat
  const [chat, setChat] = useState<ChatMsg[]>([{
    role: 'assistant',
    text: 'I\'m your KREWE Foreman. Describe the avatar you want to build — I\'ll assign dolls and connect the pipeline. Or use the Roster tab to drop dolls manually.\n\nTry: "A confident news anchor reading sports updates" or "Fix the Mechanic" after a run.',
  }]);
  const [chatInput, setChatInput] = useState('');
  const [planning, setPlanning] = useState(false);

  // last run errors for auto-heal
  const [lastErrors, setLastErrors] = useState<{ name: string; model: string; error: string }[]>([]);

  // avatar stage
  const [avatar, setAvatar] = useState({
    faceUniform: 'executive' as DollData['uniform'],
    speaking: false,
    line: '',
    status: 'idle' as 'idle' | 'building' | 'live',
    fps: 0,
  });

  // portfolio gallery
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('krewe-portfolio') ?? '[]'); } catch { return []; }
  });
  const [saving, setSaving] = useState(false);
  const [reportEntry, setReportEntry] = useState<PortfolioEntry | null>(null);
  const [lastGoal, setLastGoal] = useState('');
  const [lastHealth, setLastHealth] = useState({ total: 0, done: 0, failed: 0 });
  const [activePaper, setActivePaper] = useState<ArxivPaper | null>(null);

  // ── callbacks passed into DollData (stable refs) ──────────────────────────
  const openConfig = useCallback((id: string, section: 'head' | 'torso' | 'purse') => {
    setConfigTarget({ id, section });
  }, []);

  const swapModel = useCallback((id: string, model: string) => {
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, model, status: 'idle' as const, errorMsg: undefined, outputSnippet: undefined, latencyMs: undefined } } : n
    ));
    setEdges((eds) => eds.map((e) =>
      e.source === id || e.target === id ? { ...e, data: { ...e.data, status: 'idle' as EdgeStatus } } : e
    ));
    setChat((c) => [...c, {
      role: 'system',
      text: `Model swapped → ${model}. Edge status reset. Ready to re-run.`,
    }]);
  }, [setNodes, setEdges]);

  // ── node creation ─────────────────────────────────────────────────────────
  const newId = () => `doll_${++idCounter.current}`;

  const addDoll = useCallback((entry: RosterEntry, pos?: { x: number; y: number }) => {
    const i = placeCount.current++;
    const position = pos ?? { x: 80 + (i % 4) * 220, y: 60 + Math.floor(i / 4) * 300 };
    const id = newId();
    setNodes((nds) => nds.concat({
      id, type: 'doll', position,
      data: rosterToData(entry, openConfig, swapModel),
    }));
    return id;
  }, [openConfig, swapModel, setNodes]);

  const updateNodeData = useCallback((id: string, patch: Partial<DollData>) => {
    setNodes((nds) => nds.map((n) =>
      n.id === id
        ? { ...n, data: { ...n.data, ...patch, onOpen: openConfig, onSwapModel: swapModel } }
        : n
    ));
  }, [setNodes, openConfig, swapModel]);

  // ── edge helpers ──────────────────────────────────────────────────────────
  const setEdgeStatus = useCallback((sourceId: string, status: EdgeStatus) => {
    setEdges((eds) => eds.map((e) =>
      e.source === sourceId ? { ...e, type: 'flow', data: { status } } : e
    ));
  }, [setEdges]);

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({
      ...c, type: 'flow', animated: false,
      data: { status: 'idle' as EdgeStatus },
      style: BASE_EDGE_STYLE,
    }, eds));
  }, [setEdges]);

  // ── reset canvas state ────────────────────────────────────────────────────
  const resetStatuses = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, status: 'idle' as const, purseActive: false,
              latencyMs: undefined, errorMsg: undefined, outputSnippet: undefined,
              onOpen: openConfig, onSwapModel: swapModel },
    })));
    setEdges((eds) => eds.map((e) => ({ ...e, type: 'flow', data: { status: 'idle' as EdgeStatus } })));
  }, [setNodes, setEdges, openConfig, swapModel]);

  // ── SAVE SQUAD UP ─────────────────────────────────────────────────────────
  const saveSquad = useCallback(async () => {
    if (saving || avatar.status !== 'live') return;
    setSaving(true);
    const squadData = nodes.map((n) => ({
      name: n.data.name,
      role: n.data.role,
      uniform: n.data.uniform,
      model: n.data.model,
      status: n.data.status,
      latencyMs: n.data.latencyMs,
    }));
    const entry: Omit<PortfolioEntry, 'id' | 'created_at'> = {
      name: lastGoal.slice(0, 40) || 'Squad Run',
      prompt: lastGoal,
      squad: squadData,
      avatar_output: avatar.line,
      face_uniform: avatar.faceUniform,
      health: lastHealth,
    };
    try {
      const res = await fetch(`${API}/krewe/portfolio/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.entry) {
        const saved = data.entry as PortfolioEntry;
        setPortfolio((p) => {
          const updated = [saved, ...p];
          localStorage.setItem('krewe-portfolio', JSON.stringify(updated));
          return updated;
        });
        setChat((c) => [...c, { role: 'system', text: `✦ Squad saved to portfolio. Report generated by Gemma.` }]);
      }
    } catch {
      // offline fallback: save locally with a generated id
      const local: PortfolioEntry = {
        ...entry,
        id: `local_${Date.now()}`,
        created_at: new Date().toISOString(),
        report: '(Report unavailable — backend offline)',
      };
      setPortfolio((p) => {
        const updated = [local, ...p];
        localStorage.setItem('krewe-portfolio', JSON.stringify(updated));
        return updated;
      });
    }
    setSaving(false);
  }, [saving, avatar, nodes, lastGoal, lastHealth]);

  const addAssemblyEntry = useCallback((entry: AssemblyEntry) => {
    setPortfolio((p) => {
      const asPortfolio = entry as unknown as PortfolioEntry;
      const updated = [asPortfolio, ...p];
      localStorage.setItem('krewe-portfolio', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deletePortfolioEntry = useCallback((id: string) => {
    setPortfolio((p) => {
      const updated = p.filter((e) => e.id !== id);
      localStorage.setItem('krewe-portfolio', JSON.stringify(updated));
      return updated;
    });
    if (reportEntry?.id === id) setReportEntry(null);
  }, [reportEntry]);

  // ── SQUAD UP: step-by-step DAG execution with real connectivity checks ────
  const runSquad = useCallback(async () => {
    if (nodes.length === 0 || running) return;
    setRunning(true);
    setLastErrors([]);
    resetStatuses();
    setAvatar((a) => ({ ...a, status: 'building', speaking: false, line: '', fps: 0 }));

    const order = topoOrder(nodes.map((n) => n.id), edges);
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const goal = chat.filter((c) => c.role === 'user').slice(-1)[0]?.text || 'Greet the viewer.';
    setLastGoal(goal);

    let payloadCtx = `SQUAD GOAL: ${goal}\n`;
    let finalLine = '';
    let faceUniform: DollData['uniform'] = 'executive';
    const errors: typeof lastErrors = [];

    for (const nid of order) {
      const node = nodeMap[nid];
      if (!node) continue;

      // mark running
      updateNodeData(nid, { status: 'running', purseActive: node.data.tools.length > 0 });
      // mark incoming edges as flowing
      setEdgeStatus(nid, 'flowing');   // edges whose source = nid will pulse next doll
      // incoming edges to this node (target = nid)
      setEdges((eds) => eds.map((e) =>
        e.target === nid && (nodeMap[e.source]?.data.status === 'done')
          ? { ...e, type: 'flow', data: { status: 'flowing' as EdgeStatus } }
          : e
      ));

      let result: RunStep;
      try {
        const res = await fetch(`${API}/krewe/step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: {
              id: nid,
              name: node.data.name,
              role: node.data.role,
              uniform: node.data.uniform,
              model: node.data.model,
              system: node.data.systemPrompt,
              temperature: node.data.temperature,
              tools: node.data.tools,
              isGpu: !!node.data.isGpu,
            },
            context: payloadCtx,
            goal,
          }),
        });
        result = res.ok ? await res.json() : {
          status: 'error', output: '', latency_ms: 0, error: `HTTP ${res.status}`,
        };
      } catch (e) {
        result = { status: 'error', output: '', latency_ms: 0, error: String(e) };
      }

      const success = result.status === 'done';

      if (success) {
        updateNodeData(nid, {
          status: 'done',
          purseActive: false,
          latencyMs: result.latency_ms,
          outputSnippet: result.output.slice(0, 80),
          errorMsg: undefined,
        });
        // mark outgoing edges green
        setEdgeStatus(nid, 'done');
        // mark incoming edges green
        setEdges((eds) => eds.map((e) =>
          e.target === nid ? { ...e, type: 'flow', data: { status: 'done' as EdgeStatus } } : e
        ));
        payloadCtx += `\n[${node.data.name} · ${node.data.role}]: ${result.output}\n`;
        if (['gala', 'executive', 'doctor', 'conductor'].includes(node.data.uniform as string)) {
          if (result.output && !result.output.startsWith('(') && result.output.length > 10) finalLine = result.output;
        }
        if (['gala', 'executive', 'artist', 'stylist'].includes(node.data.uniform as string)) {
          faceUniform = node.data.uniform;
        }
      } else {
        updateNodeData(nid, {
          status: 'error',
          purseActive: false,
          latencyMs: result.latency_ms,
          errorMsg: result.error ?? 'Unknown error',
          outputSnippet: undefined,
        });
        setEdgeStatus(nid, 'error');
        setEdges((eds) => eds.map((e) =>
          e.target === nid ? { ...e, type: 'flow', data: { status: 'error' as EdgeStatus } } : e
        ));
        errors.push({ name: node.data.name, model: node.data.model, error: result.error ?? '' });
      }

      await wait(200); // brief gap so the UI renders each transition
    }

    setLastErrors(errors);
    setLastHealth({ total: nodes.length, done: nodes.length - errors.length, failed: errors.length });

    if (errors.length > 0) {
      setAvatar((a) => ({ ...a, status: 'idle' }));
      setChat((c) => [...c, {
        role: 'assistant',
        text: `⚠️ Pipeline ran with ${errors.length} error${errors.length > 1 ? 's' : ''}:\n${errors.map((e) => `• ${e.name}: ${e.error.slice(0, 60)}`).join('\n')}\n\nClick ✨ Fix It to auto-heal, or use the model dropdown on the red doll to swap its engine.`,
      }]);
    } else {
      const spoken = (finalLine || 'Hello — the squad is live!').trim().replace(/^"|"$/g, '');
      setAvatar({ faceUniform, speaking: true, line: spoken, status: 'live', fps: 0 });
      let f = 0;
      const fpsTimer = setInterval(() => {
        f = Math.min(28, f + 3 + Math.random() * 4);
        setAvatar((a) => ({ ...a, fps: f }));
        if (f >= 28) clearInterval(fpsTimer);
      }, 180);
      setTimeout(() => {
        setAvatar((a) => ({ ...a, speaking: false }));
        clearInterval(fpsTimer);
      }, Math.min(9000, 1800 + spoken.length * 48));
    }

    setRunning(false);
  }, [nodes, edges, running, chat, resetStatuses, updateNodeData, setEdgeStatus, setEdges]);

  // ── PING TEST: check each doll independently BEFORE full run ─────────────
  const pingTest = useCallback(async () => {
    if (nodes.length === 0 || testing) return;
    setTesting(true);
    resetStatuses();
    setChat((c) => [...c, { role: 'system', text: '🔬 Connectivity test started — pinging each doll...' }]);

    const results: string[] = [];
    for (const node of nodes) {
      updateNodeData(node.id, { status: 'running' });
      let ok = false;
      try {
        const res = await fetch(`${API}/krewe/step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: { id: node.id, name: node.data.name, role: node.data.role,
                    uniform: node.data.uniform, model: node.data.model,
                    system: node.data.systemPrompt, temperature: node.data.temperature,
                    tools: node.data.tools, isGpu: !!node.data.isGpu },
            context: 'PING TEST: respond with a single word "PONG".',
            goal: 'Connectivity ping',
          }),
        });
        const r = res.ok ? await res.json() : null;
        ok = r?.status === 'done';
      } catch { ok = false; }

      updateNodeData(node.id, {
        status: ok ? 'done' : 'error',
        latencyMs: undefined,
        errorMsg: ok ? undefined : 'Engine not responding',
        outputSnippet: ok ? '✓ PONG' : undefined,
      });
      results.push(`${ok ? '🟢' : '🔴'} ${node.data.name}`);
      await wait(120);
    }

    setTesting(false);
    setChat((c) => [...c, {
      role: 'assistant',
      text: `Connectivity test complete:\n${results.join('\n')}\n\nRed dolls need a model swap before SQUAD UP.`,
    }]);
  }, [nodes, testing, resetStatuses, updateNodeData]);

  // ── AUTO-HEAL ─────────────────────────────────────────────────────────────
  const autoHeal = useCallback(async () => {
    if (lastErrors.length === 0 || planning) return;
    setPlanning(true);
    try {
      const res = await fetch(`${API}/krewe/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Auto-heal: fix the failing dolls by suggesting better models',
          nodes: nodes.map((n) => ({ id: n.id, name: n.data.name, role: n.data.role,
            model: n.data.model, status: n.data.status, error: n.data.errorMsg })),
          errors: lastErrors,
        }),
      });
      const plan = res.ok ? await res.json() : null;
      if (plan?.swaps?.length) {
        plan.swaps.forEach(({ nodeId, model }: { nodeId: string; model: string }) => {
          swapModel(nodeId, model);
        });
        setChat((c) => [...c, { role: 'assistant', text: plan.note || `Applied ${plan.swaps.length} fix(es). Hit SQUAD UP to retry.` }]);
      } else {
        setChat((c) => [...c, { role: 'assistant', text: 'Try swapping the red dolls\' models using the dropdown, then re-run.' }]);
      }
    } catch {
      setChat((c) => [...c, { role: 'assistant', text: 'Use the model dropdown on red dolls to swap engines, then SQUAD UP again.' }]);
    }
    setPlanning(false);
  }, [lastErrors, nodes, planning, swapModel]);

  // ── FOREMAN CHAT ──────────────────────────────────────────────────────────
  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || planning) return;
    setChat((c) => [...c, { role: 'user', text }]);
    setChatInput('');
    setPlanning(true);

    const pipelineState = nodes.map((n) => ({
      id: n.id, name: n.data.name, role: n.data.role, model: n.data.model,
      status: n.data.status, error: n.data.errorMsg,
    }));

    try {
      // detect adjustment vs. new design
      const isAdjustment = nodes.length > 0 &&
        /swap|fix|change|replace|retry|what went wrong|error|fail|add|insert|remove/i.test(text);

      if (isAdjustment) {
        const res = await fetch(`${API}/krewe/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, nodes: pipelineState, errors: lastErrors }),
        });
        const plan = res.ok ? await res.json() : null;
        if (plan?.swaps?.length) {
          plan.swaps.forEach(({ nodeId, model }: { nodeId: string; model: string }) => swapModel(nodeId, model));
        }
        setChat((c) => [...c, { role: 'assistant', text: plan?.note || 'Done — check the canvas.' }]);
      } else {
        const res = await fetch(`${API}/krewe/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: text,
            roster: KREWE_ROSTER.map((r) => ({ key: r.key, role: r.role, blurb: r.blurb })),
          }),
        });
        const plan = res.ok ? await res.json() : null;
        if (plan?.dolls?.length) {
          applyPlan(plan.dolls, plan.edges || []);
          setChat((c) => [...c, { role: 'assistant', text: plan.note || `Squad of ${plan.dolls.length} dolls placed. SQUAD UP when ready!` }]);
        } else {
          loadAvatarSquad();
          setChat((c) => [...c, { role: 'assistant', text: 'Placed the default Avatar Squad — customize any doll and SQUAD UP.' }]);
        }
      }
    } catch {
      if (nodes.length === 0) {
        loadAvatarSquad();
        setChat((c) => [...c, { role: 'assistant', text: 'Backend offline — placed the default Avatar Squad locally.' }]);
      } else {
        setChat((c) => [...c, { role: 'assistant', text: 'Use the model dropdown to swap engines on failing dolls, then retry.' }]);
      }
    }
    setPlanning(false);
  }, [chatInput, planning, nodes, lastErrors, swapModel]);

  // ── Load avatar squad template ────────────────────────────────────────────
  const loadAvatarSquad = useCallback(() => {
    setNodes([]); setEdges([]);
    placeCount.current = 0; idCounter.current = 0;
    const placed: { key: string; id: string }[] = [];

    AVATAR_PIPELINE.forEach((key, i) => {
      const entry = KREWE_ROSTER.find((r) => r.key === key)!;
      const id = `doll_${++idCounter.current}`;
      placed.push({ key, id });
      setNodes((nds) => nds.concat({
        id, type: 'doll',
        position: { x: 40 + i * 230, y: 120 + (i % 2) * 80 },
        data: rosterToData(entry, openConfig, swapModel),
      }));
    });
    setEdges(placed.slice(0, -1).map((p, i) => ({
      id: `e_${p.id}_${placed[i + 1].id}`,
      source: p.id, target: placed[i + 1].id,
      sourceHandle: 'out', targetHandle: 'in',
      type: 'flow', data: { status: 'idle' as EdgeStatus },
    })));
    placeCount.current = placed.length;
    setAvatar((a) => ({ ...a, faceUniform: 'executive', status: 'idle', line: '', speaking: false }));
  }, [openConfig, swapModel, setNodes, setEdges]);

  const applyPlan = useCallback((dollKeys: string[], pairs: ([string, string] | { from: string; to: string })[]) => {
    setNodes([]); setEdges([]);
    idCounter.current = 0; placeCount.current = 0;
    const idByKey: Record<string, string> = {};
    dollKeys.forEach((key, i) => {
      const entry = KREWE_ROSTER.find((r) => r.key === key);
      if (!entry) return;
      const id = `doll_${++idCounter.current}`;
      idByKey[key] = id;
      setNodes((nds) => nds.concat({
        id, type: 'doll',
        position: { x: 40 + i * 230, y: 120 + (i % 2) * 80 },
        data: rosterToData(entry, openConfig, swapModel),
      }));
    });
    const norm = pairs.map((p) => Array.isArray(p) ? { from: p[0], to: p[1] } : p);
    setEdges(norm.filter((p) => idByKey[p.from] && idByKey[p.to]).map((p) => ({
      id: `e_${p.from}_${p.to}`,
      source: idByKey[p.from], target: idByKey[p.to],
      sourceHandle: 'out', targetHandle: 'in',
      type: 'flow', data: { status: 'idle' as EdgeStatus },
    })));
    if (!norm.length && dollKeys.length > 1) {
      setEdges(dollKeys.slice(0, -1).map((key, i) => ({
        id: `e_${key}_${dollKeys[i + 1]}`,
        source: idByKey[key], target: idByKey[dollKeys[i + 1]],
        sourceHandle: 'out', targetHandle: 'in',
        type: 'flow', data: { status: 'idle' as EdgeStatus },
      })));
    }
    placeCount.current = dollKeys.length;
  }, [openConfig, swapModel, setNodes, setEdges]);

  const clearCanvas = useCallback(() => {
    setNodes([]); setEdges([]); placeCount.current = 0;
    setAvatar((a) => ({ ...a, status: 'idle', speaking: false, line: '' }));
    setLastErrors([]);
  }, [setNodes, setEdges]);

  const handlePaperSquadIt = useCallback((
    dolls: string[],
    edges: [string, string][],
    goal: string,
    note: string,
  ) => {
    applyPlan(dolls, edges);
    setLastGoal(goal);
    setLeftTab('build');
    setChat((c) => [
      ...c,
      {
        role: 'assistant' as const,
        text: `📄 **SQUAD IT applied!**\n\n${goal}\n\n${note}\n\nHit **SQUAD UP** to test the science.`,
      },
    ]);
  }, [applyPlan]);

  // ── Vanity speak callback (from chat) ────────────────────────────────────
  const onSpeakLine = useCallback((line: string) => {
    setAvatar((a) => ({ ...a, speaking: true, line, status: 'live' }));
    setTimeout(() => setAvatar((a) => ({ ...a, speaking: false })),
      Math.min(8000, 1600 + line.length * 50));
  }, []);

  const avatarContext = useMemo(() =>
    `GOAL: ${lastGoal}\nLAST LINE: ${avatar.line}`,
  [lastGoal, avatar.line]);

  // ── derived state ─────────────────────────────────────────────────────────
  const health = useMemo(() => calcHealth(nodes), [nodes]);
  const healthColor = health.error > 0 ? '#ff2244' : health.done > 0 ? '#00ff88' : '#d4af37';
  const configNode = useMemo(() => nodes.find((n) => n.id === configTarget?.id), [nodes, configTarget]);
  const rosterEntries = useMemo(() =>
    rosterCat === 'all' ? KREWE_ROSTER : KREWE_ROSTER.filter((r) => r.category === rosterCat),
  [rosterCat]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-midnight-950">
      {/* ── RESEARCH PAPER BANNER ─────────────────────────────────────────── */}
      <PaperBanner onSelect={setActivePaper} />

      {/* ── PAPER OVERLAY ─────────────────────────────────────────────────── */}
      {activePaper && (
        <PaperOverlay
          paper={activePaper}
          onClose={() => setActivePaper(null)}
          onSquadIt={(dolls, edges, goal, note) => {
            handlePaperSquadIt(dolls, edges as [string, string][], goal, note);
            setActivePaper(null);
          }}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
      {/* ── LEFT RAIL ──────────────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 border-r border-midnight-800 flex flex-col bg-midnight-900">
        <div className="flex border-b border-midnight-800">
          {([
            ['build',    'Foreman',  <Bot className="w-3 h-3" />],
            ['roster',   'Roster',   <Users className="w-3 h-3" />],
            ['assembly', 'Assembly', <Factory className="w-3 h-3" />],
          ] as const).map(([t, label, icon]) => (
            <button key={t} onClick={() => setLeftTab(t as any)}
              className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${
                leftTab === t ? 'text-oldgold-400 border-b-2 border-oldgold-400 bg-midnight-800/50' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {icon}{label}
              {t === 'assembly' && assemblyStats && assemblyStats.done > 0 && (
                <span className="ml-0.5 px-1 rounded-full bg-oldgold-500 text-midnight-950 text-[7px] font-black">{assemblyStats.done}</span>
              )}
            </button>
          ))}
        </div>

        {leftTab === 'build' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5" ref={chatEndRef}>
              {chat.map((m, i) => (
                <div key={i} className={`text-[12px] leading-relaxed ${m.role === 'user' ? 'text-right' : ''}`}>
                  {m.role === 'system' ? (
                    <div className="text-[10px] text-slate-500 italic text-center">{m.text}</div>
                  ) : (
                    <div className={`inline-block px-3 py-2 rounded-xl max-w-[92%] whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-oldgold-500 text-midnight-950 font-medium'
                        : 'bg-midnight-800 text-slate-200 border border-midnight-700'
                    }`}>{m.text}</div>
                  )}
                </div>
              ))}
              {planning && (
                <div className="flex items-center gap-2 text-[11px] text-oldgold-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working on it…
                </div>
              )}

              {/* Auto-Heal button when errors present */}
              {lastErrors.length > 0 && !running && !planning && (
                <div className="mt-2">
                  <button onClick={autoHeal}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-[11px] font-bold transition-all">
                    <Wand2 className="w-3.5 h-3.5" />
                    ✨ Auto-Heal ({lastErrors.length} error{lastErrors.length > 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </div>
            <div className="p-2.5 border-t border-midnight-800">
              <div className="flex items-end gap-1.5">
                <textarea value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  rows={2}
                  placeholder="Describe avatar… or 'fix The Mechanic'…"
                  className="flex-1 resize-none bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-oldgold-500 outline-none" />
                <button onClick={sendChat} disabled={planning}
                  className="p-2 rounded-lg bg-oldgold-500 text-midnight-950 hover:bg-oldgold-400 disabled:opacity-40 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : leftTab === 'assembly' ? (
          <AssemblyLine
            onEntryProduced={addAssemblyEntry}
            onStatsUpdate={setAssemblyStats}
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* category filter */}
            <div className="flex gap-1 p-2 border-b border-midnight-800">
              {(['all', 'avatar', 'ai-infra'] as const).map((cat) => (
                <button key={cat} onClick={() => setRosterCat(cat)}
                  className={`flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    rosterCat === cat ? 'bg-oldgold-500 text-midnight-950' : 'text-slate-500 hover:text-slate-300 hover:bg-midnight-800'
                  }`}>
                  {cat === 'all' ? 'All' : cat === 'avatar' ? '🎭 Avatar' : '🤖 AI Infra'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {rosterEntries.map((r) => {
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
          </div>
        )}
      </div>

      {/* ── CANVAS ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          fitView proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'flow', data: { status: 'idle' } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2438" />
          <Controls className="!bg-midnight-900 !border-midnight-700" />
          <MiniMap
            className="!bg-midnight-900 !border !border-midnight-700"
            nodeColor={(n) => {
              const s = (n.data as DollData)?.status;
              return s === 'done' ? '#00ff88' : s === 'error' ? '#ff2244' : s === 'running' ? '#d4af37' : UNIFORMS[(n.data as DollData)?.uniform]?.dress || '#666';
            }}
            maskColor="rgba(13,6,20,0.7)"
          />

          {/* ── TOP TOOLBAR ────────────────────────────────────────────── */}
          <Panel position="top-center">
            <div className="flex items-center gap-1.5 bg-midnight-900/90 backdrop-blur-xl rounded-full p-1.5 border border-oldgold-500/30 shadow-[0_0_24px_rgba(212,175,55,0.15)]">
              {/* pipeline health orb */}
              {nodes.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-midnight-800/60 border border-midnight-700">
                  <div className="relative w-4 h-4">
                    <svg viewBox="0 0 16 16" className="w-4 h-4 -rotate-90">
                      <circle cx="8" cy="8" r="6" stroke="#1a1520" strokeWidth="3" fill="none" />
                      <circle cx="8" cy="8" r="6" stroke={healthColor} strokeWidth="3" fill="none"
                              strokeDasharray={`${(health.pct / 100) * 37.7} 37.7`}
                              style={{ filter: `drop-shadow(0 0 4px ${healthColor})`, transition: 'stroke-dasharray 0.4s ease' }} />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold" style={{ color: healthColor }}>
                    {health.done}/{health.total}
                  </span>
                </div>
              )}

              <button onClick={runSquad} disabled={running || testing || nodes.length === 0}
                className="px-4 py-1.5 rounded-full text-[11px] font-black flex items-center gap-1.5 bg-gradient-to-r from-oldgold-500 to-amber-500 text-midnight-950 hover:brightness-110 disabled:opacity-40 transition-all shadow-[0_0_16px_rgba(212,175,55,0.3)]">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                SQUAD UP
              </button>

              <button onClick={pingTest} disabled={running || testing || nodes.length === 0}
                title="Connectivity Pulse Test — ping each doll before running"
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-oldgold-400 hover:bg-midnight-800 disabled:opacity-40 transition-colors">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-oldgold-400" /> : <HeartPulse className="w-3.5 h-3.5" />}
                TEST
              </button>

              <div className="w-px h-5 bg-midnight-700 mx-0.5" />

              <button onClick={loadAvatarSquad}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-oldgold-400 hover:bg-midnight-800 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> Avatar Squad
              </button>

              <button onClick={() => setLeftTab('roster')}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-oldgold-400 hover:bg-midnight-800 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Doll
              </button>

              <button onClick={clearCanvas}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-red-400 hover:bg-midnight-800 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Gallery button */}
              {portfolio.length > 0 && (
                <>
                  <div className="w-px h-5 bg-midnight-700 mx-0.5" />
                  <button onClick={() => setShowGallery(true)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-oldgold-400 hover:bg-midnight-800 transition-colors border border-midnight-700">
                    <Grid3x3 className="w-3.5 h-3.5" />
                    GALLERY ({portfolio.length})
                  </button>
                </>
              )}

              {/* Save Squad Up — only when live */}
              {avatar.status === 'live' && !running && (
                <>
                  <div className="w-px h-5 bg-midnight-700 mx-0.5" />
                  <button onClick={saveSquad} disabled={saving}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 text-oldgold-300 hover:text-oldgold-400 hover:bg-midnight-800 disabled:opacity-40 transition-colors border border-oldgold-500/30">
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    SAVE
                  </button>
                </>
              )}
            </div>
          </Panel>

          {/* empty state hint */}
          {nodes.length === 0 && (
            <Panel position="top-center">
              <div className="mt-20 text-center pointer-events-none select-none">
                <Users className="w-10 h-10 text-midnight-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Canvas empty</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Ask the <span className="text-oldgold-400 font-bold">Foreman</span> or click
                  <span className="text-oldgold-400 font-bold"> Avatar Squad</span>
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* CONFIG DRAWER */}
        {configTarget && configNode && (
          <ConfigDrawer
            section={configTarget.section}
            node={configNode}
            onClose={() => setConfigTarget(null)}
            onChange={(patch) => updateNodeData(configTarget.id, patch)}
          />
        )}
      </div>

      {/* ── GALLERY OVERLAY ─────────────────────────────────────────────── */}
      {showGallery && (
        <GalleryView
          entries={portfolio as any}
          onClose={() => setShowGallery(false)}
          onDelete={deletePortfolioEntry}
        />
      )}

      {/* ── RIGHT RAIL: THE VANITY + PORTFOLIO ──────────────────────────── */}
      <div className="w-[320px] shrink-0 border-l border-midnight-800 flex flex-col relative">
        <TheVanity
          faceUniform={avatar.faceUniform}
          speaking={avatar.speaking}
          line={avatar.line}
          status={avatar.status}
          fps={avatar.fps}
          avatarContext={avatarContext}
          onSpeakLine={onSpeakLine}
        />
        <VanityGallery
          entries={portfolio}
          saving={saving}
          onDelete={deletePortfolioEntry}
          onViewReport={setReportEntry}
        />
        {reportEntry && (
          <ReportOverlay entry={reportEntry} onClose={() => setReportEntry(null)} />
        )}
      </div>
      </div>{/* end inner flex row */}
    </div>
  );
}

// ── Config Drawer ─────────────────────────────────────────────────────────────
const ConfigDrawer: React.FC<{
  section: 'head' | 'torso' | 'purse';
  node: DollNodeType;
  onClose: () => void;
  onChange: (patch: Partial<DollData>) => void;
}> = ({ section, node, onClose, onChange }) => {
  const d = node.data;
  const [toolInput, setToolInput] = useState('');
  const meta = {
    head:  { icon: <Brain className="w-4 h-4" />,  title: 'Head · Persona & Instructions' },
    torso: { icon: <Cpu className="w-4 h-4" />,    title: 'Torso · Model & Engine' },
    purse: { icon: <Wrench className="w-4 h-4" />, title: 'Purse · Tools & Functions' },
  }[section];

  return (
    <div className="absolute top-0 right-0 h-full w-[340px] bg-midnight-900 border-l border-midnight-700 shadow-2xl z-20 flex flex-col"
         style={{ animation: 'slideIn 0.15s ease-out' }}>
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
            <Lbl label="System Instructions">
              <textarea value={d.systemPrompt} onChange={(e) => onChange({ systemPrompt: e.target.value })}
                rows={9} className="w-full resize-none bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:border-oldgold-500 outline-none" />
            </Lbl>
            <Lbl label={`Temperature · ${d.temperature.toFixed(2)}`}>
              <input type="range" min={0} max={1.5} step={0.05} value={d.temperature}
                onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-oldgold-500" />
            </Lbl>
          </>
        )}
        {section === 'torso' && (
          <>
            <Lbl label="Core Model / Engine">
              <input value={d.model} onChange={(e) => onChange({ model: e.target.value })}
                className="w-full bg-midnight-950 border border-midnight-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:border-oldgold-500 outline-none" />
            </Lbl>
            {d.isGpu && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-300">
                <Layers className="w-4 h-4 shrink-0" /> HF GPU doll — heavy renders execute on HuggingFace GPU hardware.
              </div>
            )}
          </>
        )}
        {section === 'purse' && (
          <Lbl label="Tools (Function Calling)">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {d.tools.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-midnight-800 border border-midnight-700 text-[11px] text-slate-300">
                  {t}
                  <button onClick={() => onChange({ tools: d.tools.filter((x) => x !== t) })} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={toolInput} onChange={(e) => setToolInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && toolInput.trim()) { onChange({ tools: [...d.tools, toolInput.trim()] }); setToolInput(''); } }}
                placeholder="add a tool…"
                className="flex-1 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:border-oldgold-500 outline-none" />
              <button onClick={() => { if (toolInput.trim()) { onChange({ tools: [...d.tools, toolInput.trim()] }); setToolInput(''); } }}
                className="px-2.5 rounded-lg bg-oldgold-500 text-midnight-950"><Plus className="w-4 h-4" /></button>
            </div>
          </Lbl>
        )}
      </div>
    </div>
  );
};

const Lbl: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
    {children}
  </div>
);

export default function KrewePage() {
  return (
    <ReactFlowProvider>
      <KreweCanvas />
    </ReactFlowProvider>
  );
}
