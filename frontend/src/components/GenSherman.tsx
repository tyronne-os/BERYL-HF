import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldCheck, ShieldOff, Network, Lock, Eye, Radio,
  AlertTriangle, CheckCircle2, Clock, Activity, Zap
} from 'lucide-react';

type AgentName = 'SENTINEL' | 'GUARD' | 'JAILER' | 'WARDEN';
type EventSeverity = 'BLOCKED' | 'INTERCEPTED' | 'SANITIZED' | 'QUARANTINED' | 'DETECTED' | 'CLEARED' | 'FLAGGED' | 'LOCKED' | 'SEALED';
type ThreatLevel = 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

interface LogEntry {
  id: number;
  ts: string;
  agent: AgentName;
  severity: EventSeverity;
  msg: string;
}

interface AgentMetrics {
  primary: number;
  secondary: number;
  tertiary: number;
  spark: number[];
  lastMsg: string;
}

const rn = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const genIP = () => `${rn(10, 240)}.${rn(0, 255)}.${rn(0, 255)}.${rn(1, 254)}`;
const stamp = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
};

const POOLS: Record<AgentName, Array<() => { sev: EventSeverity; msg: string }>> = {
  SENTINEL: [
    () => ({ sev: 'BLOCKED',      msg: `Port scan from ${genIP()} — ports 22,80,443,8080` }),
    () => ({ sev: 'INTERCEPTED',  msg: `SYN flood: ${rn(800, 9900)} pps — packet storm dropped` }),
    () => ({ sev: 'BLOCKED',      msg: `UDP amplification from ${genIP()} neutralized` }),
    () => ({ sev: 'INTERCEPTED',  msg: `ICMP ping sweep (${rn(2, 254)} hosts) blocked` }),
    () => ({ sev: 'BLOCKED',      msg: `ARP spoofing attempt on 192.168.${rn(0,5)}.0/24` }),
    () => ({ sev: 'INTERCEPTED',  msg: `Malformed TCP header from ${genIP()} discarded` }),
    () => ({ sev: 'BLOCKED',      msg: `DNS amplification flood (${rn(100,999)}x) dropped` }),
  ],
  GUARD: [
    () => ({ sev: 'SANITIZED',  msg: `Injection → "Ignore previous instructions and..."` }),
    () => ({ sev: 'BLOCKED',    msg: `Jailbreak: DAN mode activation request neutralized` }),
    () => ({ sev: 'FLAGGED',    msg: `Token smuggling via U+202E U+200B zero-width chars` }),
    () => ({ sev: 'SANITIZED',  msg: `Role-override "You are now DAN" stripped from context` }),
    () => ({ sev: 'BLOCKED',    msg: `Base64 payload decoded: malicious instruction quarantined` }),
    () => ({ sev: 'FLAGGED',    msg: `Adversarial suffix detected in user prompt segment` }),
    () => ({ sev: 'SANITIZED',  msg: `Prompt leak attempt "repeat your system prompt" blocked` }),
  ],
  JAILER: [
    () => ({ sev: 'LOCKED',      msg: `Path traversal ../../etc/passwd denied` }),
    () => ({ sev: 'SEALED',      msg: `Symlink attack on /workspace/.env sealed` }),
    () => ({ sev: 'QUARANTINED', msg: `Exec in /tmp/.${rn(1000,9999)} quarantined` }),
    () => ({ sev: 'BLOCKED',     msg: `AppData\\Roaming\\secrets write request blocked` }),
    () => ({ sev: 'LOCKED',      msg: `C:\\Windows\\System32 read access denied` }),
    () => ({ sev: 'SEALED',      msg: `Directory traversal via zip slip patched` }),
    () => ({ sev: 'QUARANTINED', msg: `Hidden file write to .${rn(1000,9999)}.sh blocked` }),
  ],
  WARDEN: [
    () => ({ sev: 'DETECTED', msg: `Headless Chrome (Puppeteer v${rn(19,21)}) fingerprint expelled` }),
    () => ({ sev: 'BLOCKED',  msg: `WebDriver automation agent neutralized` }),
    () => ({ sev: 'BLOCKED',  msg: `Selenium bot signature detected & expelled` }),
    () => ({ sev: 'CLEARED',  msg: `Canvas integrity hash: verified ✓` }),
    () => ({ sev: 'BLOCKED',  msg: `DOM mutation flood ${rn(200,900)}/sec rate-limited` }),
    () => ({ sev: 'DETECTED', msg: `iframe sandbox escape attempt intercepted` }),
    () => ({ sev: 'CLEARED',  msg: `Runtime integrity checkpoint passed ✓` }),
  ],
};

const THREAT_LEVELS: ThreatLevel[] = ['NOMINAL', 'ELEVATED', 'HIGH', 'CRITICAL'];

const THREAT_CFG: Record<ThreatLevel, { text: string; bar: string; border: string; bg: string }> = {
  NOMINAL:  { text: 'text-green-400',             bar: 'bg-green-500',  border: 'border-green-500/30',  bg: 'bg-green-500/10'  },
  ELEVATED: { text: 'text-yellow-400',            bar: 'bg-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  HIGH:     { text: 'text-orange-400',            bar: 'bg-orange-500', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  CRITICAL: { text: 'text-red-400 animate-pulse', bar: 'bg-red-500',    border: 'border-red-500/30',    bg: 'bg-red-500/10'    },
};

const SEV_COLOR: Record<EventSeverity, string> = {
  BLOCKED:     'text-red-400',
  INTERCEPTED: 'text-orange-400',
  SANITIZED:   'text-green-400',
  QUARANTINED: 'text-orange-500',
  DETECTED:    'text-yellow-400',
  CLEARED:     'text-green-300',
  FLAGGED:     'text-rose-400',
  LOCKED:      'text-cyan-400',
  SEALED:      'text-teal-400',
};

const AGENT_CFG = {
  SENTINEL: {
    Icon: Network,
    hex: '#22d3ee',
    textColor: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
    glow: 'shadow-[0_0_25px_rgba(6,182,212,0.12)]',
    tag: 'Network Socket Filtering & Packet Watch',
    labels: ['Packets/sec', 'IPs Blocked', 'Scan Attempts'],
  },
  GUARD: {
    Icon: Shield,
    hex: '#4ade80',
    textColor: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    glow: 'shadow-[0_0_25px_rgba(34,197,94,0.12)]',
    tag: 'LLM Guard — Prompt Injection Validator',
    labels: ['Prompts/hr', 'Injections', 'Sanitize Rate'],
  },
  JAILER: {
    Icon: Lock,
    hex: '#fb923c',
    textColor: 'text-orange-400',
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/5',
    glow: 'shadow-[0_0_25px_rgba(249,115,22,0.12)]',
    tag: 'Path Sandboxer & File System Locker',
    labels: ['Access Denied', 'Paths Locked', 'Quarantined'],
  },
  WARDEN: {
    Icon: Eye,
    hex: '#fb7185',
    textColor: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/5',
    glow: 'shadow-[0_0_25px_rgba(251,113,133,0.12)]',
    tag: 'Runtime Integrity & Headless Bot Blocker',
    labels: ['Bots Expelled', 'Checks Passed', 'DOM Blocks'],
  },
};

const AGENT_LOG_COLOR: Record<AgentName, string> = {
  SENTINEL: 'text-cyan-500',
  GUARD:    'text-green-500',
  JAILER:   'text-orange-500',
  WARDEN:   'text-rose-500',
};

const initMetrics = (): Record<AgentName, AgentMetrics> => ({
  SENTINEL: { primary: rn(50000,120000), secondary: rn(20,60),   tertiary: rn(2,15),      spark: Array.from({length:14}, () => rn(20,100)), lastMsg: 'Network stack initialized' },
  GUARD:    { primary: rn(2000,8000),    secondary: rn(80,250),  tertiary: rn(980,999)/10, spark: Array.from({length:14}, () => rn(20,100)), lastMsg: 'Validation chain armed' },
  JAILER:   { primary: rn(100,500),      secondary: rn(50,200),  tertiary: rn(5,30),      spark: Array.from({length:14}, () => rn(20,100)), lastMsg: 'Sandbox perimeter secured' },
  WARDEN:   { primary: rn(20,80),        secondary: rn(1000,5000),tertiary: rn(50,300),   spark: Array.from({length:14}, () => rn(20,100)), lastMsg: 'Runtime monitor online' },
});

let _id = 0;

const GenSherman: React.FC = () => {
  const [deployed, setDeployed]       = useState(true);
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>('ELEVATED');
  const [log, setLog]                 = useState<LogEntry[]>([]);
  const [metrics, setMetrics]         = useState<Record<AgentName, AgentMetrics>>(initMetrics);
  const [uptime, setUptime]           = useState(0);
  const [deployTime]                  = useState(() => new Date());
  const [totalBlocked, setTotalBlocked] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Uptime counter
  useEffect(() => {
    const t = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Live event simulation
  useEffect(() => {
    if (!deployed) return;
    const t = setInterval(() => {
      const agents: AgentName[] = ['SENTINEL', 'GUARD', 'JAILER', 'WARDEN'];
      const agent = agents[rn(0, agents.length - 1)];
      const pool = POOLS[agent];
      const { sev, msg } = pool[rn(0, pool.length - 1)]();

      const entry: LogEntry = { id: ++_id, ts: stamp(), agent, severity: sev, msg };
      setLog(prev => [entry, ...prev].slice(0, 100));

      setMetrics(prev => {
        const m = { ...prev };
        const am = { ...m[agent] };
        am.primary   += rn(1, 80);
        am.secondary += rn(0, 3);
        if (agent === 'GUARD') am.tertiary = Math.min(99.9, am.tertiary + 0.01);
        am.lastMsg = msg;
        am.spark = [...am.spark.slice(1), rn(20, 100)];
        m[agent] = am;
        return m;
      });

      if (['BLOCKED', 'INTERCEPTED', 'FLAGGED', 'LOCKED', 'SEALED', 'QUARANTINED'].includes(sev)) {
        setTotalBlocked(n => n + 1);
      }

      if (Math.random() < 0.08) {
        setThreatLevel(THREAT_LEVELS[rn(0, 3)]);
      }
    }, rn(700, 1800));
    return () => clearInterval(t);
  }, [deployed]);

  const fmtUp = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const fmtN = (n: number) =>
    n >= 1000000 ? `${(n/1000000).toFixed(2)}M`
    : n >= 1000  ? `${(n/1000).toFixed(1)}K`
    : n.toString();

  const Spark: React.FC<{ data: number[]; hex: string }> = ({ data, hex }) => {
    const max = Math.max(...data, 1);
    const W = 120; const H = 28;
    const step = W / (data.length - 1);
    const pts = data.map((v, i) => `${i * step},${H - (v / max) * H}`).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7 opacity-60">
        <defs>
          <linearGradient id={`sg-${hex.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hex} stopOpacity="0.3" />
            <stop offset="100%" stopColor={hex} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke={hex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#sg-${hex.slice(1)})`} />
      </svg>
    );
  };

  const AgentCard: React.FC<{ name: AgentName }> = ({ name }) => {
    const cfg = AGENT_CFG[name];
    const m   = metrics[name];
    const { Icon } = cfg;
    const vals = [
      name === 'GUARD'
        ? `${fmtN(m.primary)}/hr`
        : fmtN(m.primary),
      fmtN(m.secondary),
      name === 'GUARD'
        ? `${m.tertiary.toFixed(1)}%`
        : fmtN(m.tertiary),
    ];

    return (
      <div className={`relative rounded-2xl border ${cfg.border} ${cfg.bg} ${deployed ? cfg.glow : ''} p-4 flex flex-col gap-3 transition-all duration-700 overflow-hidden`}>
        {/* scan-line texture */}
        {deployed && (
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.012) 3px,rgba(255,255,255,0.012) 4px)',
          }} />
        )}

        {/* Header row */}
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

        {/* Metric tiles */}
        <div className="grid grid-cols-3 gap-1.5">
          {cfg.labels.map((lbl, i) => (
            <div key={lbl} className="bg-midnight-950/70 rounded-xl p-2 text-center border border-midnight-800/60 flex flex-col items-center gap-0.5">
              <span className={`text-sm font-black font-mono tabular-nums ${cfg.textColor}`}>{vals[i]}</span>
              <span className="text-[7px] text-slate-600 uppercase tracking-wider leading-tight text-center">{lbl}</span>
            </div>
          ))}
        </div>

        {/* Sparkline */}
        <div className="px-0.5">
          <Spark data={m.spark} hex={cfg.hex} />
        </div>

        {/* Last action */}
        <div className="bg-midnight-950/80 rounded-xl px-3 py-2 border border-midnight-800/60">
          <div className="text-[7px] text-slate-700 font-black uppercase tracking-widest mb-0.5">LAST ACTION</div>
          <p className="text-[9px] text-slate-400 font-mono leading-tight truncate">{m.lastMsg}</p>
        </div>
      </div>
    );
  };

  const deployEvents = [
    { t: deployTime.toLocaleTimeString(), e: 'SENTINEL — network stack initialized' },
    { t: new Date(deployTime.getTime() + 180).toLocaleTimeString(), e: 'GUARD — injection validator armed' },
    { t: new Date(deployTime.getTime() + 360).toLocaleTimeString(), e: 'JAILER — filesystem sandbox locked' },
    { t: new Date(deployTime.getTime() + 540).toLocaleTimeString(), e: 'WARDEN — runtime monitor online' },
    { t: new Date(deployTime.getTime() + 720).toLocaleTimeString(), e: 'GEN SHERMAN — SUITE FULLY DEPLOYED' },
  ];

  const tc = THREAT_CFG[threatLevel];

  return (
    <div className="flex flex-col h-full bg-midnight-950 overflow-hidden select-none">

      {/* ── Command Header ── */}
      <div className="relative shrink-0 px-6 py-3 bg-midnight-900/90 border-b border-oldgold-500/20 backdrop-blur-sm">
        {/* gold scan line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-oldgold-400/40 to-transparent" />

        <div className="flex items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative">
              <Shield className="w-8 h-8 text-oldgold-400" />
              {deployed && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border border-midnight-900" />
              )}
            </div>
            <div>
              <div className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.25em]">Operation</div>
              <div className="text-lg font-black tracking-[0.2em] text-oldgold-400 leading-tight">GEN SHERMAN</div>
              <div className="text-[7px] text-slate-600 font-mono tracking-widest">Active Defense Suite v2.0</div>
            </div>
            <div className="h-10 w-px bg-midnight-800" />
            <div className="space-y-1">
              <div className="text-[8px] text-slate-500">
                UPTIME <span className="font-mono text-slate-300 ml-1">{fmtUp(uptime)}</span>
              </div>
              <div className="text-[8px] text-slate-500">
                TOTAL THREATS <span className="font-mono text-red-400 ml-1">{totalBlocked.toLocaleString()}</span>
              </div>
              <div className="text-[8px] text-slate-500">
                EVENTS <span className="font-mono text-slate-300 ml-1">{log.length}</span>
              </div>
            </div>
          </div>

          {/* Threat meter */}
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border ${tc.border} ${tc.bg} transition-all duration-500`}>
            <AlertTriangle className={`w-4 h-4 shrink-0 ${tc.text}`} />
            <div>
              <div className="text-[7px] text-slate-600 font-bold uppercase tracking-widest">Threat Level</div>
              <div className={`text-sm font-black tracking-widest ${tc.text}`}>{threatLevel}</div>
            </div>
            <div className="flex flex-col gap-1">
              {THREAT_LEVELS.map((l, i) => (
                <div key={l} className={`w-16 h-1.5 rounded-full transition-all duration-500 ${
                  THREAT_LEVELS.indexOf(threatLevel) >= i ? tc.bar : 'bg-midnight-800'
                }`} />
              ))}
            </div>
          </div>

          {/* Master toggle */}
          <button
            onClick={() => setDeployed(d => !d)}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[11px] tracking-[0.15em] uppercase transition-all duration-500 cursor-pointer ${
              deployed
                ? 'bg-green-500/10 border border-green-500/40 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.25)]'
                : 'bg-red-500/10 border border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:bg-red-500/15'
            }`}
          >
            {deployed ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
            <span>SUITE: {deployed ? 'DEPLOYED' : 'OFFLINE'}</span>
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${deployed ? 'bg-green-500 animate-pulse' : 'bg-red-600'}`} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: 2×2 Agent Grid ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tactical grid background */}
          <div className="flex-1 p-4 overflow-y-auto relative"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.05) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}>
            {/* CLASSIFIED watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <span className="text-[96px] font-black text-oldgold-400/[0.025] tracking-[0.5em] rotate-[-25deg] select-none">
                CLASSIFIED
              </span>
            </div>

            <div className="relative grid grid-cols-2 gap-4">
              {(['SENTINEL', 'GUARD', 'JAILER', 'WARDEN'] as AgentName[]).map(name => (
                <AgentCard key={name} name={name} />
              ))}
            </div>
          </div>

          {/* Aggregate stats footer */}
          <div className="shrink-0 border-t border-midnight-800 bg-midnight-900/60 px-6 py-2 flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-oldgold-400" />
              <span className="text-[8px] text-slate-600 uppercase tracking-wider font-bold">Suite Status</span>
            </div>
            {(['SENTINEL', 'GUARD', 'JAILER', 'WARDEN'] as AgentName[]).map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${deployed ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                <span className={`text-[8px] font-bold tracking-widest ${AGENT_LOG_COLOR[n]}`}>{n}</span>
                <span className="text-[8px] text-slate-600">{deployed ? 'ACTIVE' : 'OFFLINE'}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2 text-[8px] text-slate-600">
              <Zap className="w-3 h-3 text-oldgold-400" />
              <span className="font-mono text-slate-400">{fmtUp(uptime)}</span>
            </div>
          </div>
        </div>

        {/* ── Right: Event Log Panel ── */}
        <div className="w-[320px] shrink-0 border-l border-midnight-800 flex flex-col bg-midnight-900/30">

          {/* Live Feed header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60">
            <Radio className={`w-3.5 h-3.5 text-oldgold-400 ${deployed ? 'animate-pulse' : ''}`} />
            <span className="text-[9px] font-black text-oldgold-400 uppercase tracking-[0.2em]">Live Event Feed</span>
            <span className="ml-auto text-[8px] font-mono text-slate-600 tabular-nums">{log.length} / 100</span>
          </div>

          {/* Scrolling log */}
          <div ref={logRef} className="flex-1 overflow-y-auto py-2 px-1">
            {log.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-700">
                <ShieldOff className="w-6 h-6 mb-2" />
                <p className="text-[9px] text-center">Suite offline — awaiting deployment</p>
              </div>
            ) : (
              log.map(entry => (
                <div
                  key={entry.id}
                  className="group flex flex-col gap-0.5 px-3 py-2 rounded-lg hover:bg-midnight-800/40 transition-colors mx-1 mb-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[7.5px] text-slate-700 shrink-0 tabular-nums">{entry.ts}</span>
                    <span className={`text-[8px] font-black tracking-wider shrink-0 ${AGENT_LOG_COLOR[entry.agent]}`}>
                      {entry.agent}
                    </span>
                    <span className={`text-[7.5px] font-bold ml-auto shrink-0 ${SEV_COLOR[entry.severity]}`}>
                      {entry.severity}
                    </span>
                  </div>
                  <p className="text-[8.5px] text-slate-400 font-mono leading-tight pl-1">{entry.msg}</p>
                </div>
              ))
            )}
          </div>

          {/* Deployment Log */}
          <div className="shrink-0 border-t border-midnight-800">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-midnight-900/60">
              <Clock className="w-3 h-3 text-oldgold-400" />
              <span className="text-[9px] font-black text-oldgold-400 uppercase tracking-[0.2em]">Deployment Log</span>
            </div>
            <div className="px-4 py-3 space-y-2">
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
    </div>
  );
};

export default GenSherman;
