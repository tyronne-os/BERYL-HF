import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { TerminalSquare, Activity, Cpu, MemoryStick, Play, Trash2, CornerDownLeft } from 'lucide-react';
import { API } from '../api';

interface Line { kind: 'cmd' | 'out' | 'err' | 'info'; text: string; }
interface Stats { cpu_percent: number; cpu_count: number; ram_used_gb: number; ram_total_gb: number; ram_percent: number; node_mem_gb: number; py_mem_gb: number; }

const CLIDashboard: React.FC = () => {
  const [lines, setLines] = useState<Line[]>([
    { kind: 'info', text: 'Beryl embedded PowerShell — real execution on this machine. Type a command and press Enter.' },
  ]);
  const [cmd, setCmd] = useState('');
  const [cwd, setCwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [stats, setStats] = useState<Stats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [lines]);
  useEffect(() => {
    const poll = async () => { try { const { data } = await axios.get<Stats>(`${API}/system/stats`); setStats(data); } catch {} };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const run = async () => {
    const c = cmd.trim();
    if (!c || busy) return;
    setLines((p) => [...p, { kind: 'cmd', text: c }]);
    setHistory((p) => [...p, c]); setHistIdx(-1);
    setCmd(''); setBusy(true);
    if (c === 'clear' || c === 'cls') { setLines([]); setBusy(false); return; }
    try {
      const { data } = await axios.post(`${API}/cli/exec`, { command: c, cwd: cwd || undefined });
      if (data.cwd) setCwd(data.cwd);
      if (data.stdout) setLines((p) => [...p, { kind: 'out', text: data.stdout.replace(/\n$/, '') }]);
      if (data.stderr) setLines((p) => [...p, { kind: 'err', text: data.stderr.replace(/\n$/, '') }]);
      if (!data.stdout && !data.stderr) setLines((p) => [...p, { kind: 'info', text: `(exit ${data.exit_code})` }]);
    } catch {
      setLines((p) => [...p, { kind: 'err', text: 'Backend unreachable — is the API running on :8001?' }]);
    } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); run(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const i = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1); if (history[i] !== undefined) { setHistIdx(i); setCmd(history[i]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx >= 0) { const i = histIdx + 1; if (i >= history.length) { setHistIdx(-1); setCmd(''); } else { setHistIdx(i); setCmd(history[i]); } } }
  };

  const quick = ['Get-Process | Sort-Object WS -Descending | Select-Object -First 5 Name,@{n="MB";e={[math]::Round($_.WS/1MB)}}', 'Get-ChildItem', 'git status', 'node --version'];

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center space-x-3"><TerminalSquare className="w-8 h-8 text-green-500" /><span>Beryl CLI &amp; Telemetry</span></h1>
          <p className="text-slate-400 mt-2">Live PowerShell execution and real system telemetry.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Terminal */}
          <div className="lg:col-span-2">
            <div className="bg-slate-950 rounded-2xl border border-slate-700 overflow-hidden flex flex-col h-[560px]">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" /><div className="w-3 h-3 rounded-full bg-yellow-500" /><div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[10px] text-slate-500 font-mono ml-3 truncate max-w-[280px]">{cwd || 'PowerShell'}</span>
                </div>
                <button onClick={() => setLines([])} className="text-slate-500 hover:text-slate-300 flex items-center space-x-1 text-xs"><Trash2 className="w-3 h-3" /><span>Clear</span></button>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed space-y-1" onClick={() => inputRef.current?.focus()}>
                {lines.map((l, i) => (
                  <div key={i} className={
                    l.kind === 'cmd' ? 'text-white' : l.kind === 'err' ? 'text-red-400 whitespace-pre-wrap' : l.kind === 'info' ? 'text-slate-500 italic' : 'text-slate-300 whitespace-pre-wrap'
                  }>
                    {l.kind === 'cmd' && <span className="text-green-400">PS&gt; </span>}
                    {l.text}
                  </div>
                ))}
                {busy && <div className="text-oldgold-400 animate-pulse">running…</div>}
                <div className="flex items-center text-white">
                  <span className="text-green-400 mr-1">PS&gt;</span>
                  <input ref={inputRef} value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={onKey} autoFocus spellCheck={false}
                    className="flex-1 bg-transparent outline-none border-none text-white font-mono" placeholder="" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {quick.map((q) => (
                <button key={q} onClick={() => { setCmd(q); setTimeout(run, 0); }} className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-mono truncate max-w-[220px] flex items-center space-x-1">
                  <Play className="w-3 h-3 text-green-400 shrink-0" /><span className="truncate">{q.split(' ')[0]} {q.split(' ')[1] || ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Telemetry */}
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center space-x-2"><Activity className="w-4 h-4" /><span>Live System Telemetry</span></h2>
              {stats ? (
                <div className="space-y-4">
                  <Meter label="CPU" icon={<Cpu className="w-4 h-4" />} pct={stats.cpu_percent} text={`${Math.round(stats.cpu_percent)}% · ${stats.cpu_count} cores`} color="bg-cyan-500" />
                  <Meter label="RAM" icon={<MemoryStick className="w-4 h-4" />} pct={stats.ram_percent} text={`${stats.ram_used_gb} / ${stats.ram_total_gb} GB`} color="bg-oldgold-500" />
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-center"><div className="text-lg font-bold text-slate-200">{stats.node_mem_gb} GB</div><div className="text-[9px] text-slate-500 uppercase font-bold mt-1">Node / Vite</div></div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-center"><div className="text-lg font-bold text-slate-200">{stats.py_mem_gb} GB</div><div className="text-[9px] text-slate-500 uppercase font-bold mt-1">Python / API</div></div>
                  </div>
                </div>
              ) : <p className="text-xs text-slate-500">Reading telemetry…</p>}
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center space-x-2"><CornerDownLeft className="w-4 h-4" /><span>Shortcuts</span></h2>
              <ul className="text-xs text-slate-400 space-y-2">
                <li><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">↑</kbd> / <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">↓</kbd> command history</li>
                <li><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">clear</kbd> wipe the screen</li>
                <li>Commands run in a real PowerShell with a 30s timeout.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Meter: React.FC<{ label: string; icon: React.ReactNode; pct: number; text: string; color: string }> = ({ label, icon, pct, text, color }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-400 flex items-center space-x-1">{icon}<span>{label}</span></span>
      <span className="font-mono font-bold text-slate-300">{text}</span>
    </div>
    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden"><div className={`${color} h-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
  </div>
);

export default CLIDashboard;
