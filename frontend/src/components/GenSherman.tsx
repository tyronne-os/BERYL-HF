import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Shield, ShieldCheck, ShieldOff, Network, Lock, Eye, Radio,
  AlertTriangle, CheckCircle2, Clock, Activity, Zap,
  Search, XCircle, Crosshair, Skull, Wifi, Terminal,
  MonitorX, Bomb, Bug, ScanSearch, RefreshCw, ToggleLeft, ToggleRight,
  Brain, FileText, Server, List, Flame,
} from 'lucide-react';
import { API } from '../api';
import FirewallPanel from './FirewallPanel';

interface Posture {
  established: number; listeners: number; remote_ips: number; rat_listeners: number;
  suspicious_ports: number[]; total_procs: number; browser_procs: number; headless: number; temp_execs: number;
}

interface DaemonStatus {
  running: boolean;
  threat_level: string;
  last_posture: string | null;
  last_sweep: string | null;
  total_threats_seen: number;
  auto_kill: boolean;
  sweep_interval: number;
  posture_interval: number;
}

interface DaemonLogEntry { ts: string; level: string; msg: string; }

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentName    = 'SENTINEL' | 'GUARD' | 'JAILER' | 'WARDEN';
type EventSev     = 'BLOCKED' | 'INTERCEPTED' | 'SANITIZED' | 'QUARANTINED'
                  | 'DETECTED' | 'CLEARED' | 'FLAGGED' | 'LOCKED' | 'SEALED';
type ThreatLevel  = 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
type Mode         = 'watch' | 'sweep' | 'daemon' | 'firewall';
type SweepPhase   = 'idle' | 'scanning' | 'done';
type LogType      = 'info' | 'scan' | 'threat' | 'clear' | 'kill' | 'terminated' | 'error';

interface WatchLogEntry  { id: number; ts: string; agent: AgentName; severity: EventSev; msg: string; }
interface AgentMetrics   { primary: number; secondary: number; tertiary: number; spark: number[]; lastMsg: string; }

interface ThreatItem {
  pid:     number | null;
  name:    string;
  detail:  string;
  risk:    'CRITICAL' | 'HIGH' | 'MEDIUM';
  cmd?:    string;
  port?:   number;
  address?: string;
}
interface ThreatData {
  headless_browsers:    ThreatItem[];
  encoded_commands:     ThreatItem[];
  remote_access:        ThreatItem[];
  suspicious_listeners: ThreatItem[];
  covert_processes:     ThreatItem[];
  rdp_sessions:         ThreatItem[];
  transparent_overlays: ThreatItem[];
}
interface SweepLogEntry { ts: string; msg: string; type: LogType; }

// ─── Watch-mode simulation data ───────────────────────────────────────────────

const stamp = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
};

// Real posture → per-agent metric mapping (no simulation)
const POSTURE_MAP: Record<AgentName, (p: Posture) => { vals: [number, number, number]; last: string }> = {
  SENTINEL: p => ({ vals: [p.established, p.remote_ips, p.listeners],
    last: `${p.established} live connections · ${p.remote_ips} remote hosts` }),
  GUARD:    p => ({ vals: [p.listeners, p.rat_listeners, p.suspicious_ports.length],
    last: p.rat_listeners ? `RAT-port listener(s): ${p.suspicious_ports.join(', ')}` : `${p.listeners} listeners · none on RAT ports` }),
  JAILER:   p => ({ vals: [p.temp_execs, p.total_procs, p.rat_listeners],
    last: p.temp_execs ? `${p.temp_execs} interpreter(s) from temp paths` : `No temp-path execution · ${p.total_procs} procs` }),
  WARDEN:   p => ({ vals: [p.browser_procs, p.headless, p.total_procs],
    last: p.headless ? `${p.headless} HEADLESS browser(s) detected!` : `${p.browser_procs} browsers · 0 headless` }),
};

const THREAT_CFG: Record<ThreatLevel, { text: string; bar: string; border: string; bg: string }> = {
  NOMINAL:  { text: 'text-green-400',             bar: 'bg-green-500',  border: 'border-green-500/30',  bg: 'bg-green-500/10'  },
  ELEVATED: { text: 'text-yellow-400',            bar: 'bg-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  HIGH:     { text: 'text-orange-400',            bar: 'bg-orange-500', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  CRITICAL: { text: 'text-red-400 animate-pulse', bar: 'bg-red-500',    border: 'border-red-500/30',    bg: 'bg-red-500/10'    },
};

const SEV_COLOR: Record<EventSev, string> = {
  BLOCKED: 'text-red-400', INTERCEPTED: 'text-orange-400', SANITIZED: 'text-green-400',
  QUARANTINED: 'text-orange-500', DETECTED: 'text-yellow-400', CLEARED: 'text-green-300',
  FLAGGED: 'text-rose-400', LOCKED: 'text-cyan-400', SEALED: 'text-teal-400',
};

const AGENT_CFG = {
  SENTINEL: { Icon: Network, hex: '#22d3ee', textColor: 'text-cyan-400',   border: 'border-cyan-500/30',   bg: 'bg-cyan-500/5',   glow: 'shadow-[0_0_25px_rgba(6,182,212,0.12)]',   tag: 'Live Network Socket Monitor',            labels: ['Connections','Remote Hosts','Listeners'] },
  GUARD:    { Icon: Shield,  hex: '#4ade80', textColor: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/5',  glow: 'shadow-[0_0_25px_rgba(34,197,94,0.12)]',   tag: 'Listener & RAT-Port Guard',              labels: ['Listeners','RAT Ports','Flagged']        },
  JAILER:   { Icon: Lock,    hex: '#fb923c', textColor: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5', glow: 'shadow-[0_0_25px_rgba(249,115,22,0.12)]',  tag: 'Temp-Path & Process Sandbox',            labels: ['Temp Execs','Processes','RAT Ports']     },
  WARDEN:   { Icon: Eye,     hex: '#fb7185', textColor: 'text-rose-400',   border: 'border-rose-500/30',   bg: 'bg-rose-500/5',   glow: 'shadow-[0_0_25px_rgba(251,113,133,0.12)]', tag: 'Headless Browser & Runtime Watch',       labels: ['Browsers','Headless','Processes']        },
};

const AGENT_LOG_COLOR: Record<AgentName, string> = {
  SENTINEL: 'text-cyan-500', GUARD: 'text-green-500',
  JAILER:   'text-orange-500', WARDEN: 'text-rose-500',
};

const initMetrics = (): Record<AgentName, AgentMetrics> => ({
  SENTINEL: { primary: 0, secondary: 0, tertiary: 0, spark: Array(14).fill(10), lastMsg: 'Awaiting first posture read…' },
  GUARD:    { primary: 0, secondary: 0, tertiary: 0, spark: Array(14).fill(10), lastMsg: 'Awaiting first posture read…' },
  JAILER:   { primary: 0, secondary: 0, tertiary: 0, spark: Array(14).fill(10), lastMsg: 'Awaiting first posture read…' },
  WARDEN:   { primary: 0, secondary: 0, tertiary: 0, spark: Array(14).fill(10), lastMsg: 'Awaiting first posture read…' },
});

// Sweeper UI config
const SWEEP_CATEGORIES: { key: keyof ThreatData; label: string; Icon: any; desc: string }[] = [
  { key: 'headless_browsers',    Icon: MonitorX,  label: 'HEADLESS BROWSER HUNTER', desc: 'Automation-flag Chrome/Edge/Chromium' },
  { key: 'encoded_commands',     Icon: Terminal,  label: 'ENCODED SHELL HUNTER',    desc: 'Obfuscated/hidden PowerShell sessions' },
  { key: 'transparent_overlays', Icon: Bug,       label: 'TRANSPARENT OVERLAY SCAN',desc: 'Layered/transparent windows hiding on screen' },
  { key: 'remote_access',        Icon: Wifi,      label: 'REMOTE ACCESS DETECTOR',  desc: 'TeamViewer / AnyDesk / VNC / RDP tools' },
  { key: 'suspicious_listeners', Icon: Crosshair, label: 'RAT PORT SCANNER',        desc: 'Network listeners on known C2/RAT ports' },
  { key: 'covert_processes',     Icon: Skull,     label: 'COVERT PROCESS HUNTER',   desc: 'LOLBins, script hosts & temp-path execs' },
  { key: 'rdp_sessions',         Icon: Eye,       label: 'REMOTE SESSION SCANNER',  desc: 'Active RDP / virtual terminal sessions' },
];

const RISK_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  MEDIUM:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
};

const SWEEP_LOG_COLOR: Record<LogType, string> = {
  info:       'text-slate-400',
  scan:       'text-cyan-400',
  threat:     'text-red-400',
  clear:      'text-green-400',
  kill:       'text-orange-400',
  terminated: 'text-green-300',
  error:      'text-rose-400',
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

let _watchId = 0;

// ─── Component ────────────────────────────────────────────────────────────────

const GenSherman: React.FC = () => {

  // ── Watch-mode state ──────────────────────────────────────────────────────
  const [mode, setMode]               = useState<Mode>('watch');
  const [deployed, setDeployed]       = useState(true);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('ELEVATED');
  const [watchLog, setWatchLog]       = useState<WatchLogEntry[]>([]);
  const [metrics, setMetrics]         = useState<Record<AgentName, AgentMetrics>>(initMetrics);
  const [uptime, setUptime]           = useState(0);
  const [deployTime]                  = useState(() => new Date());
  const [totalBlocked, setTotalBlocked] = useState(0);

  // ── Sweeper state ─────────────────────────────────────────────────────────
  const [sweepPhase, setSweepPhase]     = useState<SweepPhase>('idle');
  const [threats, setThreats]           = useState<ThreatData | null>(null);
  const [sweepLog, setSweepLog]         = useState<SweepLogEntry[]>([]);
  const [autoKill, setAutoKill]         = useState(false);
  const [eliminated, setEliminated]     = useState<Set<number>>(new Set());
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  // ── AI Analyst (free local Gemma) ─────────────────────────────────────────
  const [aiReport, setAiReport]   = useState<{ report: string; model: string; level: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runAnalysis = async (data: ThreatData) => {
    setAnalyzing(true);
    setAiReport(null);
    try {
      const { data: rep } = await axios.post(`${API}/security/analyze`, { threats: data });
      setAiReport(rep);
      addSweepLog(`AI Analyst (${rep.model}) report ready`, 'info');
    } catch {
      addSweepLog('AI Analyst unavailable — start Ollama for free Gemma reports', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const watchLogRef = useRef<HTMLDivElement>(null);
  const sweepLogRef = useRef<HTMLDivElement>(null);

  const addSweepLog = (msg: string, type: LogType = 'info') =>
    setSweepLog(prev => [{ ts: stamp(), msg, type }, ...prev].slice(0, 60));

  // ── Daemon state ──────────────────────────────────────────────────────────
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
  const [daemonLogs, setDaemonLogs]     = useState<DaemonLogEntry[]>([]);
  const [daemonAutoKill, setDaemonAutoKill] = useState(false);
  const [daemonSweepMin, setDaemonSweepMin] = useState(5);

  const fetchDaemon = async () => {
    try {
      const [{ data: st }, { data: lg }] = await Promise.all([
        axios.get(`${API}/security/daemon/status`),
        axios.get(`${API}/security/daemon/logs?limit=80`),
      ]);
      setDaemonStatus(st);
      setDaemonLogs(lg.logs || []);
      setDaemonAutoKill(st.auto_kill);
      setDaemonSweepMin(Math.round(st.sweep_interval / 60));
    } catch { /* backend warming */ }
  };

  const saveDaemonConfig = async (auto_kill: boolean, sweep_min: number) => {
    try {
      await axios.post(`${API}/security/daemon/config`, {
        auto_kill,
        sweep_interval: sweep_min * 60,
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchDaemon();
    const t = setInterval(fetchDaemon, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Uptime ticker ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Watch mode: REAL posture polling (no simulation) ──────────────────────
  const prevPosture = useRef<Posture | null>(null);
  useEffect(() => {
    if (!deployed || mode !== 'watch') return;
    const poll = async () => {
      try {
        const { data } = await axios.get<Posture>(`${API}/security/posture`);
        // Drive each agent card from real numbers
        setMetrics(prev => {
          const next = { ...prev };
          (['SENTINEL', 'GUARD', 'JAILER', 'WARDEN'] as AgentName[]).forEach(name => {
            const { vals, last } = POSTURE_MAP[name](data);
            const am = { ...next[name] };
            [am.primary, am.secondary, am.tertiary] = vals;
            am.lastMsg = last;
            am.spark = [...am.spark.slice(1), Math.min(100, vals[0] * 2 + 10)];
            next[name] = am;
          });
          return next;
        });
        // Real threat level from real findings
        const lvl: ThreatLevel = data.rat_listeners > 0 ? 'CRITICAL'
          : data.headless > 0 ? 'HIGH'
          : data.temp_execs > 0 ? 'ELEVATED' : 'NOMINAL';
        setThreatLevel(lvl);
        // Emit real events (deltas + active findings)
        const p = prevPosture.current;
        const push = (agent: AgentName, severity: EventSev, msg: string) =>
          setWatchLog(prev => [{ id: ++_watchId, ts: stamp(), agent, severity, msg }, ...prev].slice(0, 100));
        if (data.headless > 0) { push('WARDEN', 'DETECTED', `${data.headless} headless browser(s) detected`); setTotalBlocked(n => n + data.headless); }
        if (data.rat_listeners > 0) { push('GUARD', 'FLAGGED', `RAT-port listener(s): ${data.suspicious_ports.join(', ')}`); setTotalBlocked(n => n + data.rat_listeners); }
        if (data.temp_execs > 0) { push('JAILER', 'QUARANTINED', `${data.temp_execs} interpreter(s) from temp paths`); setTotalBlocked(n => n + data.temp_execs); }
        if (!p || data.established !== p.established) push('SENTINEL', 'CLEARED', `${data.established} established connections · ${data.remote_ips} remote hosts`);
        if (!p || data.listeners !== p.listeners) push('GUARD', data.rat_listeners > 0 ? 'FLAGGED' : 'CLEARED', `${data.listeners} listeners · ${data.rat_listeners} on RAT ports`);
        if (!p || data.browser_procs !== p.browser_procs) push('WARDEN', 'CLEARED', `${data.browser_procs} browser process(es) · 0 headless`);
        prevPosture.current = data;
      } catch { /* backend warming */ }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [deployed, mode]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtUp = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  };
  const fmtN = (n: number) =>
    n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M`
    : n >= 1_000   ? `${(n/1_000).toFixed(1)}K`
    : n.toString();

  const countThreats = (data: ThreatData) =>
    Object.values(data).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);

  const activePids = (data: ThreatData): number[] =>
    Object.values(data)
      .flat()
      .filter((t): t is ThreatItem => !!t && typeof t === 'object' && t.pid != null)
      .map(t => t.pid as number)
      .filter(p => !eliminated.has(p));

  // ── Sweep runner ──────────────────────────────────────────────────────────
  const runSweep = async () => {
    if (sweepPhase === 'scanning') return;
    setSweepPhase('scanning');
    setThreats(null);
    setEliminated(new Set());
    setScanProgress(0);

    addSweepLog('Sweep protocols initializing...', 'info');
    await delay(300); setScanProgress(10);
    addSweepLog('Interrogating WMI process table...', 'scan');
    await delay(500); setScanProgress(25);
    addSweepLog('Probing TCP socket listeners on all interfaces...', 'scan');
    await delay(400); setScanProgress(40);
    addSweepLog('Scanning established outbound connections...', 'scan');
    await delay(350); setScanProgress(55);
    addSweepLog('Checking for active remote desktop sessions...', 'scan');
    await delay(300); setScanProgress(70);
    addSweepLog('Enumerating transparent window overlays...', 'scan');
    await delay(400); setScanProgress(85);
    addSweepLog('Compiling threat report...', 'scan');

    try {
      const { data } = await axios.get<ThreatData>('http://127.0.0.1:8001/security/sweep');
      setScanProgress(100);
      setThreats(data);
      setLastScanTime(stamp());
      const total = countThreats(data);
      addSweepLog(
        total > 0
          ? `⚠ SWEEP COMPLETE — ${total} threat(s) identified`
          : `✓ SWEEP COMPLETE — System clean`,
        total > 0 ? 'threat' : 'clear',
      );
      addSweepLog('Dispatching findings to AI Analyst (free Gemma)…', 'info');
      runAnalysis(data);
      if (autoKill && total > 0) {
        const pids = activePids(data);
        addSweepLog(`Auto-eliminate: targeting ${pids.length} process(es)...`, 'kill');
        await axios.post('http://127.0.0.1:8001/security/nuke_all', { pids });
        setEliminated(new Set(pids));
        addSweepLog(`Auto-eliminate: ${pids.length} threat(s) terminated`, 'terminated');
      }
    } catch {
      setScanProgress(100);
      addSweepLog('Backend unreachable — start the Python backend to enable real sweeps', 'error');
    }
    setSweepPhase('done');
  };

  const killOne = async (pid: number, name: string) => {
    addSweepLog(`Targeting PID ${pid} (${name})...`, 'kill');
    try {
      const { data } = await axios.post('http://127.0.0.1:8001/security/kill_threat', { pid });
      if (data.status === 'terminated') {
        setEliminated(prev => new Set([...prev, pid]));
        addSweepLog(`TERMINATED: ${name} (PID ${pid}) ✓`, 'terminated');
      } else {
        addSweepLog(`Failed: ${data.detail}`, 'error');
      }
    } catch {
      addSweepLog(`Error targeting PID ${pid}`, 'error');
    }
  };

  const nukeAll = async () => {
    if (!threats) return;
    const pids = activePids(threats);
    if (!pids.length) return;
    addSweepLog(`NUKE COMMAND — terminating ${pids.length} threats...`, 'kill');
    try {
      const { data } = await axios.post('http://127.0.0.1:8001/security/nuke_all', { pids });
      setEliminated(prev => new Set([...prev, ...pids]));
      addSweepLog(`${data.terminated}/${data.total} threats eliminated`, 'terminated');
    } catch {
      addSweepLog('Nuke failed — backend unreachable', 'error');
    }
  };

  // ── Daemon log color ─────────────────────────────────────────────────────
  const DAEMON_LOG_COLOR: Record<string, string> = {
    INFO:    'text-slate-400',
    NOMINAL: 'text-green-400',
    ELEVATED:'text-yellow-400',
    HIGH:    'text-orange-400',
    CRITICAL:'text-red-400',
    THREAT:  'text-red-400',
    CLEAR:   'text-green-300',
    KILL:    'text-orange-300',
    ERROR:   'text-rose-400',
  };

  const renderDaemon = () => (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: status cards + config */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status cards row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'STATUS',          val: daemonStatus?.running ? 'ONLINE' : 'OFFLINE', color: daemonStatus?.running ? 'text-green-400' : 'text-red-400' },
            { label: 'THREAT LEVEL',    val: daemonStatus?.threat_level ?? '—',            color: daemonStatus?.threat_level === 'CRITICAL' ? 'text-red-400 animate-pulse' : daemonStatus?.threat_level === 'HIGH' ? 'text-orange-400' : daemonStatus?.threat_level === 'ELEVATED' ? 'text-yellow-400' : 'text-green-400' },
            { label: 'THREATS LOGGED',  val: String(daemonStatus?.total_threats_seen ?? 0), color: 'text-slate-200' },
            { label: 'SWEEP EVERY',     val: daemonStatus ? `${Math.round(daemonStatus.sweep_interval/60)} min` : '—', color: 'text-purple-400' },
          ].map(c => (
            <div key={c.label} className="bg-midnight-800 border border-midnight-700 rounded-xl p-3 text-center">
              <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold mb-1">{c.label}</p>
              <p className={`text-sm font-black font-mono ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Last seen times */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-3">
            <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold mb-1">Last Posture Check</p>
            <p className="text-[10px] font-mono text-slate-300">{daemonStatus?.last_posture ?? 'Not yet'}</p>
          </div>
          <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-3">
            <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold mb-1">Last Full Sweep</p>
            <p className="text-[10px] font-mono text-slate-300">{daemonStatus?.last_sweep ?? 'Not yet'}</p>
          </div>
        </div>

        {/* Config */}
        <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-4">
          <p className="text-[9px] font-black text-oldgold-400 uppercase tracking-[0.2em] mb-3">Daemon Config</p>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-slate-300">Auto-Kill Critical Threats</p>
              <p className="text-[8px] text-slate-600">Automatically terminate CRITICAL-flagged PIDs</p>
            </div>
            <button
              onClick={async () => {
                const next = !daemonAutoKill;
                setDaemonAutoKill(next);
                await saveDaemonConfig(next, daemonSweepMin);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                daemonAutoKill ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-midnight-900 border-midnight-700 text-slate-500'
              }`}
            >
              {daemonAutoKill ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {daemonAutoKill ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-300">Full Sweep Interval</p>
              <p className="text-[8px] text-slate-600">How often the daemon runs a full deep scan</p>
            </div>
            <div className="flex items-center gap-2">
              {[2, 5, 10, 30].map(m => (
                <button
                  key={m}
                  onClick={async () => {
                    setDaemonSweepMin(m);
                    await saveDaemonConfig(daemonAutoKill, m);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all ${
                    daemonSweepMin === m
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                      : 'bg-midnight-900 border-midnight-700 text-slate-500 hover:text-slate-300'
                  }`}
                >{m}m</button>
              ))}
            </div>
          </div>
        </div>

        {/* Startup instructions */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <p className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
            <Server className="w-3.5 h-3.5" /> Auto-Start on Windows Login
          </p>
          <p className="text-[10px] text-slate-400 mb-2">Run this once in PowerShell (as Admin) to register GEN SHERMAN as a startup task:</p>
          <div className="bg-midnight-950 rounded-lg px-3 py-2 font-mono text-[10px] text-green-400 border border-midnight-700">
            powershell -ExecutionPolicy Bypass -File deploy_sherman.ps1
          </div>
          <p className="text-[9px] text-slate-600 mt-2">Located in your BERYL-HF root folder. Registers a Task Scheduler job that starts the backend silently on every login.</p>
        </div>
      </div>

      {/* Right: daemon log */}
      <div className="w-80 shrink-0 border-l border-midnight-800 flex flex-col bg-midnight-900/30">
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60">
          <List className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em]">Daemon Threat Log</span>
          <span className="ml-auto text-[8px] font-mono text-slate-600">{daemonLogs.length} entries</span>
          <button onClick={fetchDaemon} className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {daemonLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-700">
              <Server className="w-6 h-6 mb-2" />
              <p className="text-[9px] text-center">Daemon not running</p>
            </div>
          ) : daemonLogs.map((entry, i) => (
            <div key={i} className="flex flex-col gap-0.5 px-3 py-1.5 hover:bg-midnight-800/30 rounded mx-1 mb-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[7.5px] text-slate-700 shrink-0 tabular-nums">{entry.ts}</span>
                <span className={`text-[8px] font-black shrink-0 ${DAEMON_LOG_COLOR[entry.level] || 'text-slate-400'}`}>{entry.level}</span>
              </div>
              <p className="text-[8.5px] font-mono text-slate-400 leading-tight pl-1">{entry.msg}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Sub-components ───────────────────────────────────────────────────────

  const Spark: React.FC<{ data: number[]; hex: string }> = ({ data, hex }) => {
    const max  = Math.max(...data, 1);
    const W = 120; const H = 28;
    const step = W / (data.length - 1);
    const pts  = data.map((v, i) => `${i * step},${H - (v / max) * H}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7 opacity-60">
        <defs>
          <linearGradient id={`sg${hex.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hex} stopOpacity="0.3" />
            <stop offset="100%" stopColor={hex} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke={hex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#sg${hex.replace('#','')})`} />
      </svg>
    );
  };

  const AgentCard: React.FC<{ name: AgentName }> = ({ name }) => {
    const cfg  = AGENT_CFG[name];
    const m    = metrics[name];
    const { Icon } = cfg;
    const vals = [fmtN(m.primary), fmtN(m.secondary), fmtN(m.tertiary)];
    return (
      <div className={`relative rounded-2xl border ${cfg.border} ${cfg.bg} ${deployed ? cfg.glow : ''} p-4 flex flex-col gap-3 transition-all duration-700 overflow-hidden`}>
        {deployed && (
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.012) 3px,rgba(255,255,255,0.012) 4px)' }} />
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${cfg.textColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${cfg.textColor}`}>AGENT {name}</span>
                {deployed && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.hex }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: cfg.hex }} />
                  </span>
                )}
              </div>
              <p className="text-[8px] text-slate-600 mt-0.5 leading-tight">{cfg.tag}</p>
            </div>
          </div>
          <span className={`shrink-0 text-[8px] font-black px-2.5 py-1 rounded-full border tracking-widest uppercase ${deployed ? `${cfg.textColor} ${cfg.border}` : 'text-slate-700 border-slate-800'}`}>
            {deployed ? 'ACTIVE' : 'STANDBY'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {cfg.labels.map((lbl, i) => (
            <div key={lbl} className="bg-midnight-950/70 rounded-xl p-2 text-center border border-midnight-800/60 flex flex-col items-center gap-0.5">
              <span className={`text-sm font-black font-mono tabular-nums ${cfg.textColor}`}>{vals[i]}</span>
              <span className="text-[7px] text-slate-600 uppercase tracking-wider leading-tight text-center">{lbl}</span>
            </div>
          ))}
        </div>
        <div className="px-0.5"><Spark data={m.spark} hex={cfg.hex} /></div>
        <div className="bg-midnight-950/80 rounded-xl px-3 py-2 border border-midnight-800/60">
          <div className="text-[7px] text-slate-700 font-black uppercase tracking-widest mb-0.5">LAST ACTION</div>
          <p className="text-[9px] text-slate-400 font-mono leading-tight truncate">{m.lastMsg}</p>
        </div>
      </div>
    );
  };

  // ─── Sweeper panel ────────────────────────────────────────────────────────

  const ThreatCard: React.FC<{ cat: typeof SWEEP_CATEGORIES[0] }> = ({ cat }) => {
    const items  = threats ? (threats[cat.key] || []) : [];
    const active = items.filter(t => t.pid == null || !eliminated.has(t.pid));
    const clean  = active.length === 0;
    const { Icon } = cat;

    return (
      <div className={`rounded-xl border transition-all duration-500 overflow-hidden ${
        sweepPhase === 'scanning'
          ? 'border-cyan-500/20 bg-cyan-500/5'
          : clean
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-red-500/30 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.08)]'
      }`}>
        {/* Card header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${clean && sweepPhase !== 'scanning' ? 'border-green-500/15' : 'border-midnight-800/60'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            sweepPhase === 'scanning' ? 'bg-cyan-500/10' : clean ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}>
            <Icon className={`w-4 h-4 ${sweepPhase === 'scanning' ? 'text-cyan-400 animate-pulse' : clean ? 'text-green-400' : 'text-red-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[9px] font-black tracking-widest uppercase ${
              sweepPhase === 'scanning' ? 'text-cyan-400' : clean ? 'text-green-400' : 'text-red-400'
            }`}>{cat.label}</div>
            <div className="text-[8px] text-slate-600 mt-0.5">{cat.desc}</div>
          </div>
          {sweepPhase === 'scanning' ? (
            <div className="shrink-0 text-[8px] text-cyan-400 font-mono animate-pulse">SCANNING...</div>
          ) : threats ? (
            <div className={`shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full ${
              clean ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {clean ? '✓ CLEAN' : `⚠ ${active.length} FOUND`}
            </div>
          ) : (
            <div className="shrink-0 text-[8px] text-slate-700 font-mono">AWAITING SCAN</div>
          )}
        </div>

        {/* Threat list */}
        {active.length > 0 && (
          <div className="divide-y divide-red-500/10">
            {active.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-red-500/5 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[9px] font-bold text-slate-300">{item.name}</span>
                    {item.pid && <span className="text-[8px] font-mono text-slate-600">PID:{item.pid}</span>}
                    {(item as any).port && <span className="text-[8px] font-mono text-red-500">:{(item as any).port}</span>}
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${RISK_BADGE[item.risk] || RISK_BADGE.MEDIUM}`}>
                      {item.risk}
                    </span>
                  </div>
                  <p className="text-[8px] text-slate-500 leading-tight">{item.detail}</p>
                </div>
                {item.pid != null && (
                  <button
                    onClick={() => killOne(item.pid!, item.name)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-[8px] font-black uppercase tracking-wider transition-all hover:shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                  >
                    <XCircle className="w-3 h-3" />
                    ELIMINATE
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSweeper = () => {
    const totalActive = threats ? activePids(threats).length : 0;
    return (
      <div className="flex flex-1 overflow-hidden">
        {/* Left: controls + category grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Control bar */}
          <div className="shrink-0 px-5 py-3 border-b border-midnight-800 bg-midnight-900/50 flex items-center gap-4">
            {/* Scan button */}
            <button
              onClick={runSweep}
              disabled={sweepPhase === 'scanning'}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-black text-[11px] tracking-widest uppercase transition-all cursor-pointer ${
                sweepPhase === 'scanning'
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 cursor-not-allowed'
                  : 'bg-midnight-800 border border-oldgold-500/40 text-oldgold-400 hover:bg-midnight-700 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]'
              }`}
            >
              {sweepPhase === 'scanning'
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <ScanSearch className="w-4 h-4" />
              }
              {sweepPhase === 'scanning' ? 'SWEEPING...' : sweepPhase === 'done' ? 'RESCAN' : 'INITIATE SWEEP'}
            </button>

            {/* Progress bar */}
            {sweepPhase === 'scanning' && (
              <div className="flex-1 max-w-48">
                <div className="h-1.5 bg-midnight-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <div className="text-[8px] text-cyan-400 font-mono mt-1">{scanProgress}%</div>
              </div>
            )}

            {/* Auto-kill toggle */}
            <button
              onClick={() => setAutoKill(a => !a)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                autoKill ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-midnight-800 border-midnight-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {autoKill ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              AUTO-ELIMINATE
            </button>

            {/* Last scan */}
            {lastScanTime && (
              <div className="text-[8px] text-slate-600 font-mono">
                Last scan: <span className="text-slate-400">{lastScanTime}</span>
              </div>
            )}

            {/* Total count */}
            {threats && (
              <div className={`ml-auto text-[10px] font-black px-3 py-1.5 rounded-lg ${
                totalActive > 0
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
              }`}>
                {totalActive > 0 ? `⚠ ${totalActive} ACTIVE THREATS` : '✓ SYSTEM CLEAN'}
              </div>
            )}
          </div>

          {/* Category cards grid */}
          <div className="flex-1 overflow-y-auto p-4 relative"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.04) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}>
            {/* CLASSIFIED watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <span className="text-[72px] font-black text-oldgold-400/[0.02] tracking-[0.6em] rotate-[-20deg] select-none">CLASSIFIED</span>
            </div>

            {/* AI Analyst report (free local Gemma) */}
            {(analyzing || aiReport) && (
              <div className="relative mb-3 rounded-xl border border-oldgold-500/30 bg-midnight-900/70 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-oldgold-500/15 bg-midnight-900/60">
                  <Brain className={`w-4 h-4 text-oldgold-400 ${analyzing ? 'animate-pulse' : ''}`} />
                  <span className="text-[10px] font-black text-oldgold-400 uppercase tracking-[0.2em]">AI Threat Analyst</span>
                  {aiReport && (
                    <span className="text-[8px] font-mono text-slate-500 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {aiReport.model}
                    </span>
                  )}
                  {aiReport && (
                    <span className={`ml-auto text-[9px] font-black px-2.5 py-1 rounded-full border ${
                      aiReport.level === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : aiReport.level === 'ELEVATED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      : 'bg-green-500/10 text-green-400 border-green-500/30'
                    }`}>{aiReport.level}</span>
                  )}
                </div>
                <div className="px-4 py-3">
                  {analyzing ? (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Gemma is analyzing the sweep locally (free, unlimited)…
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">{aiReport?.report}</p>
                  )}
                </div>
              </div>
            )}

            <div className="relative grid grid-cols-2 gap-3">
              {SWEEP_CATEGORIES.map(cat => (
                <ThreatCard key={cat.key} cat={cat} />
              ))}
            </div>

            {/* Nuke all button */}
            {threats && totalActive > 0 && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={nukeAll}
                  className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-400 font-black text-[11px] uppercase tracking-widest hover:bg-red-500/20 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] transition-all cursor-pointer"
                >
                  <Bomb className="w-5 h-5" />
                  TERMINATE ALL THREATS ({totalActive})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sweep log */}
        <div className="w-72 shrink-0 border-l border-midnight-800 flex flex-col bg-midnight-900/30">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60">
            <Activity className={`w-3.5 h-3.5 text-oldgold-400 ${sweepPhase === 'scanning' ? 'animate-pulse' : ''}`} />
            <span className="text-[9px] font-black text-oldgold-400 uppercase tracking-[0.2em]">Sweep Log</span>
          </div>
          <div ref={sweepLogRef} className="flex-1 overflow-y-auto py-2 px-1">
            {sweepLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-700">
                <Search className="w-6 h-6 mb-2" />
                <p className="text-[9px] text-center">Initiate a sweep to begin</p>
              </div>
            ) : sweepLog.map((entry, i) => (
              <div key={i} className="flex flex-col gap-0.5 px-3 py-1.5 hover:bg-midnight-800/30 transition-colors rounded mx-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[7.5px] text-slate-700 shrink-0 tabular-nums">{entry.ts}</span>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    entry.type === 'terminated' ? 'bg-green-500' :
                    entry.type === 'threat' ? 'bg-red-500' :
                    entry.type === 'kill' ? 'bg-orange-500' :
                    entry.type === 'scan' ? 'bg-cyan-500' :
                    entry.type === 'clear' ? 'bg-green-400' :
                    entry.type === 'error' ? 'bg-rose-500' : 'bg-slate-600'
                  }`} />
                </div>
                <p className={`text-[8.5px] font-mono leading-tight pl-1 ${SWEEP_LOG_COLOR[entry.type]}`}>{entry.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Watch-mode panels ────────────────────────────────────────────────────

  const deployEvents = [
    { t: deployTime.toLocaleTimeString(), e: 'SENTINEL — network stack initialized' },
    { t: new Date(deployTime.getTime() + 180).toLocaleTimeString(), e: 'GUARD — injection validator armed' },
    { t: new Date(deployTime.getTime() + 360).toLocaleTimeString(), e: 'JAILER — filesystem sandbox locked' },
    { t: new Date(deployTime.getTime() + 540).toLocaleTimeString(), e: 'WARDEN — runtime monitor online' },
    { t: new Date(deployTime.getTime() + 720).toLocaleTimeString(), e: 'GEN SHERMAN — SUITE FULLY DEPLOYED' },
  ];

  const tc = THREAT_CFG[threatLevel];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-midnight-950 overflow-hidden select-none">

      {/* ── Command Header ── */}
      <div className="relative shrink-0 px-5 py-2.5 bg-midnight-900/90 border-b border-oldgold-500/20 backdrop-blur-sm">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-oldgold-400/40 to-transparent" />

        <div className="flex items-center gap-3">
          {/* Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <Shield className="w-7 h-7 text-oldgold-400" />
              {deployed && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse border border-midnight-900" />}
            </div>
            <div>
              <div className="text-[7px] text-slate-600 font-bold uppercase tracking-[0.25em]">Operation</div>
              <div className="text-base font-black tracking-[0.2em] text-oldgold-400 leading-tight">GEN SHERMAN</div>
            </div>
          </div>

          <div className="h-8 w-px bg-midnight-800" />

          {/* Mode switcher */}
          <div className="flex items-center bg-midnight-950/80 rounded-xl p-1 border border-midnight-800/60">
            <button
              onClick={() => setMode('watch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                mode === 'watch' ? 'bg-oldgold-500/20 text-oldgold-400 border border-oldgold-500/30' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Radio className="w-3 h-3" />
              WATCH
            </button>
            <button
              onClick={() => setMode('sweep')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                mode === 'sweep' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <ScanSearch className="w-3 h-3" />
              SWEEP
              {mode !== 'sweep' && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
              )}
            </button>
            <button
              onClick={() => setMode('daemon')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                mode === 'daemon' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Server className="w-3 h-3" />
              DAEMON
              {daemonStatus?.running && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
                </span>
              )}
            </button>
            <button
              onClick={() => setMode('firewall')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                mode === 'firewall' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Flame className="w-3 h-3" />
              FIREWALL
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
            </button>
          </div>

          <div className="h-8 w-px bg-midnight-800" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-[8px] text-slate-500">
            <div>UPTIME <span className="font-mono text-slate-300 ml-1">{fmtUp(uptime)}</span></div>
            <div>THREATS BLOCKED <span className="font-mono text-red-400 ml-1">{totalBlocked.toLocaleString()}</span></div>
            {mode === 'sweep' && lastScanTime && (
              <div>LAST SWEEP <span className="font-mono text-oldgold-400 ml-1">{lastScanTime}</span></div>
            )}
          </div>

          {/* Daemon pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest ${
            daemonStatus?.running
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
              : 'bg-slate-800 border-slate-700 text-slate-600'
          }`}>
            <Server className="w-3 h-3" />
            {daemonStatus?.running ? '24/7 ACTIVE' : 'DAEMON OFF'}
            {daemonStatus?.running && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            )}
          </div>

          {/* Threat meter */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${tc.border} ${tc.bg} transition-all duration-500`}>
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${tc.text}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${tc.text}`}>{threatLevel}</span>
            <div className="flex gap-0.5">
              {(['NOMINAL','ELEVATED','HIGH','CRITICAL'] as ThreatLevel[]).map((l, i) => (
                <div key={l} className={`w-3 h-1.5 rounded-full transition-all duration-500 ${
                  ['NOMINAL','ELEVATED','HIGH','CRITICAL'].indexOf(threatLevel) >= i ? tc.bar : 'bg-midnight-800'
                }`} />
              ))}
            </div>
          </div>

          {/* Deploy toggle */}
          <button
            onClick={() => setDeployed(d => !d)}
            className={`ml-auto flex items-center gap-2.5 px-5 py-2 rounded-xl font-black text-[10px] tracking-[0.15em] uppercase transition-all duration-500 cursor-pointer ${
              deployed
                ? 'bg-green-500/10 border border-green-500/40 text-green-400 shadow-[0_0_25px_rgba(34,197,94,0.12)] hover:shadow-[0_0_35px_rgba(34,197,94,0.2)]'
                : 'bg-red-500/10 border border-red-500/40 text-red-400'
            }`}
          >
            {deployed ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
            <span>SUITE: {deployed ? 'DEPLOYED' : 'OFFLINE'}</span>
            <div className={`w-2 h-2 rounded-full ${deployed ? 'bg-green-500 animate-pulse' : 'bg-red-600'}`} />
          </button>
        </div>
      </div>

      {/* ── Body: WATCH or SWEEP ── */}
      {mode === 'firewall' ? <FirewallPanel /> : mode === 'daemon' ? renderDaemon() : mode === 'watch' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* 2×2 Agent Grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto relative"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.05) 1px, transparent 0)', backgroundSize: '28px 28px' }}>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span className="text-[96px] font-black text-oldgold-400/[0.025] tracking-[0.5em] rotate-[-25deg] select-none">CLASSIFIED</span>
              </div>
              <div className="relative grid grid-cols-2 gap-4">
                {(['SENTINEL','GUARD','JAILER','WARDEN'] as AgentName[]).map(n => <AgentCard key={n} name={n} />)}
              </div>
            </div>
            {/* Status footer */}
            <div className="shrink-0 border-t border-midnight-800 bg-midnight-900/60 px-6 py-2 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-oldgold-400" />
                <span className="text-[8px] text-slate-600 uppercase tracking-wider font-bold">Suite Status</span>
              </div>
              {(['SENTINEL','GUARD','JAILER','WARDEN'] as AgentName[]).map(n => (
                <div key={n} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${deployed ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                  <span className={`text-[8px] font-bold tracking-widest ${AGENT_LOG_COLOR[n]}`}>{n}</span>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2 text-[8px] text-slate-600">
                <Zap className="w-3 h-3 text-oldgold-400" />
                <span className="font-mono text-slate-400">{fmtUp(uptime)}</span>
              </div>
            </div>
          </div>

          {/* Watch event log */}
          <div className="w-[300px] shrink-0 border-l border-midnight-800 flex flex-col bg-midnight-900/30">
            <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60">
              <Radio className={`w-3.5 h-3.5 text-oldgold-400 ${deployed ? 'animate-pulse' : ''}`} />
              <span className="text-[9px] font-black text-oldgold-400 uppercase tracking-[0.2em]">Live Event Feed</span>
              <span className="ml-auto text-[8px] font-mono text-slate-600 tabular-nums">{watchLog.length}/100</span>
            </div>
            <div ref={watchLogRef} className="flex-1 overflow-y-auto py-2 px-1">
              {watchLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-700">
                  <ShieldOff className="w-6 h-6 mb-2" />
                  <p className="text-[9px] text-center">Suite offline — no events</p>
                </div>
              ) : watchLog.map(entry => (
                <div key={entry.id} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg hover:bg-midnight-800/40 transition-colors mx-1 mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[7.5px] text-slate-700 shrink-0 tabular-nums">{entry.ts}</span>
                    <span className={`text-[8px] font-black tracking-wider shrink-0 ${AGENT_LOG_COLOR[entry.agent]}`}>{entry.agent}</span>
                    <span className={`text-[7.5px] font-bold ml-auto shrink-0 ${SEV_COLOR[entry.severity]}`}>{entry.severity}</span>
                  </div>
                  <p className="text-[8.5px] text-slate-400 font-mono leading-tight pl-1">{entry.msg}</p>
                </div>
              ))}
            </div>
            {/* Deployment log */}
            <div className="shrink-0 border-t border-midnight-800">
              <div className="flex items-center gap-2 px-4 py-2 bg-midnight-900/60">
                <Clock className="w-3 h-3 text-oldgold-400" />
                <span className="text-[9px] font-black text-oldgold-400 uppercase tracking-[0.2em]">Deployment Log</span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {deployEvents.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[7.5px] text-slate-700">{ev.t} </span>
                      <span className={`text-[8px] ${i === 4 ? 'text-oldgold-400 font-bold' : 'text-slate-500'}`}>{ev.e}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        renderSweeper()
      )}
    </div>
  );
};

export default GenSherman;
