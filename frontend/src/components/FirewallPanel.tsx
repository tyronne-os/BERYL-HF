import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Flame, ShieldOff, ShieldCheck, Ban, CheckCircle2, RefreshCw,
  Lock, Unlock, Wifi, WifiOff, AlertTriangle, Terminal,
  Globe, XCircle, Plus, Activity, Server,
} from 'lucide-react';
import { API } from '../api';

interface FwStatus {
  domain?:              { on: boolean; policy: string };
  private?:             { on: boolean; policy: string };
  public?:              { on: boolean; policy: string };
  default_block_inbound: boolean;
  divert_active:        boolean;
  blocked_ip_count:     number;
  total_bans_ever:      number;
  safe_ports:           number[];
}

interface BlockedIP {
  ip:       string;
  reason:   string;
  ban_ts:   string;
  attempts: number;
  banned:   boolean;
}

interface BfEvent {
  ip:         string;
  count:      number;
  logon_type: string;
  user:       string;
}

interface FwLogEntry { ts: string; level: string; msg: string; }

const RISK_COLOR: Record<string, string> = {
  'BLOCK':      'text-red-400',
  'AUTO-BAN':   'text-red-400',
  'FW-BAN':     'text-orange-400',
  'BAN':        'text-orange-400',
  'SYN-FLOOD':  'text-rose-400',
  'UNBLOCK':    'text-green-400',
  'ALLOW':      'text-green-400',
  'POLICY':     'text-yellow-400',
  'INFO':       'text-slate-400',
  'WARN':       'text-yellow-400',
  'ERROR':      'text-rose-400',
};

const stamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });

const FirewallPanel: React.FC = () => {
  const [status, setStatus]   = useState<FwStatus | null>(null);
  const [blocked, setBlocked] = useState<BlockedIP[]>([]);
  const [fwLogs, setFwLogs]   = useState<FwLogEntry[]>([]);
  const [bfEvents, setBfEvents] = useState<BfEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualReason, setManualReason] = useState('manual block');
  const [newPort, setNewPort] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'blocked' | 'brute' | 'logs'>('dashboard');
  const [actionMsg, setActionMsg] = useState('');

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ data: st }, { data: bl }, { data: lg }] = await Promise.all([
        axios.get(`${API}/firewall/status`),
        axios.get(`${API}/firewall/blocked`),
        axios.get(`${API}/firewall/logs?limit=120`),
      ]);
      setStatus(st);
      setBlocked(bl.blocked || []);
      setFwLogs(lg.logs || []);
    } catch { /* backend warming */ }
    setLoading(false);
  };

  const scanBruteForce = async () => {
    setScanning(true);
    try {
      const { data } = await axios.get(`${API}/firewall/scan_brute_force`);
      setBfEvents(data.events || []);
      if (data.auto_banned > 0) {
        flash(`Auto-banned ${data.auto_banned} brute-force IP(s)`);
      } else {
        flash(`Scan complete — ${data.total_ips} suspicious IPs tracked`);
      }
      await refresh();
    } catch { flash('Scan failed — backend error'); }
    setScanning(false);
  };

  const blockManual = async () => {
    if (!manualIp.trim()) return;
    try {
      const { data } = await axios.post(`${API}/firewall/block`, { ip: manualIp.trim(), reason: manualReason });
      flash(data.status === 'blocked' ? `BLOCKED ${manualIp}` : `Error blocking ${manualIp}`);
      setManualIp('');
      await refresh();
    } catch { flash('Block request failed'); }
  };

  const unblock = async (ip: string) => {
    try {
      await axios.post(`${API}/firewall/unblock`, { ip });
      flash(`Unblocked ${ip}`);
      await refresh();
    } catch { flash('Unblock failed'); }
  };

  const blockAllInbound = async () => {
    try {
      const { data } = await axios.post(`${API}/firewall/block_all_inbound`);
      flash(data.status === 'enabled'
        ? 'Default inbound: BLOCK ALL — BERYL ports kept open'
        : 'Failed to set block-all policy (run as Admin)');
      await refresh();
    } catch { flash('Policy change failed'); }
  };

  const restoreInbound = async () => {
    try {
      await axios.post(`${API}/firewall/allow_inbound`);
      flash('Default inbound restored to ALLOW');
      await refresh();
    } catch { flash('Restore failed'); }
  };

  const addAllowPort = async () => {
    if (!newPort.trim()) return;
    try {
      const { data } = await axios.post(`${API}/firewall/allow_port`, { port: parseInt(newPort) });
      flash(data.status === 'added' ? `Port ${newPort} allowed inbound` : `Failed`);
      setNewPort('');
    } catch { flash('Port allow failed'); }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const ProfileBadge: React.FC<{ name: string; on: boolean; policy: string }> = ({ name, on, policy }) => (
    <div className={`flex-1 rounded-xl border p-3 ${on ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold mb-1">{name}</p>
      <div className="flex items-center gap-1.5">
        {on ? <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> : <ShieldOff className="w-3.5 h-3.5 text-red-400" />}
        <span className={`text-[10px] font-black ${on ? 'text-green-400' : 'text-red-400'}`}>{on ? 'ON' : 'OFF'}</span>
      </div>
      <p className="text-[8px] text-slate-600 mt-1 truncate">{policy}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-midnight-950 overflow-hidden select-none">

      {/* Header */}
      <div className="shrink-0 px-5 py-2.5 bg-midnight-900/90 border-b border-red-500/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Flame className="w-6 h-6 text-red-400" />
            <div>
              <div className="text-[7px] text-slate-600 font-bold uppercase tracking-[0.25em]">GEN SHERMAN</div>
              <div className="text-sm font-black tracking-[0.15em] text-red-400">FIREWALL ENGINE</div>
            </div>
          </div>

          <div className="h-6 w-px bg-midnight-800" />

          {/* Tab switcher */}
          <div className="flex items-center bg-midnight-950/80 rounded-xl p-1 border border-midnight-800/60 gap-0.5">
            {(['dashboard', 'blocked', 'brute', 'logs'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activeTab === tab ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-600 hover:text-slate-400'
                }`}>
                {tab === 'dashboard' ? 'FIREWALL' : tab === 'blocked' ? `BLOCKED (${blocked.length})` : tab === 'brute' ? 'BRUTE FORCE' : 'LOGS'}
              </button>
            ))}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 ml-auto">
            {status?.default_block_inbound && (
              <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] font-black uppercase tracking-widest">
                DEFAULT BLOCK ACTIVE
              </span>
            )}
            {status?.divert_active && (
              <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[8px] font-black uppercase tracking-widest">
                WinDivert LIVE
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[8px] font-black uppercase">
              {status?.blocked_ip_count ?? 0} BANNED
            </span>
            <button onClick={refresh}
              className="p-1.5 rounded-lg bg-midnight-800 border border-midnight-700 text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="mt-1.5 text-[10px] font-mono text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-1.5">
            {stamp()} — {actionMsg}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <div className="h-full overflow-y-auto p-5 space-y-4">

            {/* Windows Firewall Profiles */}
            <div>
              <p className="text-[8px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">Windows Firewall Profiles</p>
              <div className="flex gap-3">
                {status?.domain  && <ProfileBadge name="Domain"  on={status.domain.on}  policy={status.domain.policy}  />}
                {status?.private && <ProfileBadge name="Private" on={status.private.on} policy={status.private.policy} />}
                {status?.public  && <ProfileBadge name="Public"  on={status.public.on}  policy={status.public.policy}  />}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Blocked IPs',   val: status?.blocked_ip_count ?? 0,  color: 'text-red-400'    },
                { label: 'Total Bans',    val: status?.total_bans_ever ?? 0,    color: 'text-orange-400' },
                { label: 'Safe Ports',    val: status?.safe_ports?.length ?? 0, color: 'text-green-400'  },
                { label: 'WinDivert',     val: status?.divert_active ? 'LIVE' : 'OFF', color: status?.divert_active ? 'text-purple-400' : 'text-slate-600' },
              ].map(c => (
                <div key={c.label} className="bg-midnight-800 border border-midnight-700 rounded-xl p-3 text-center">
                  <p className="text-[8px] text-slate-600 uppercase tracking-widest font-bold mb-1">{c.label}</p>
                  <p className={`text-base font-black font-mono ${c.color}`}>{String(c.val)}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Block all inbound */}
              <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">Block All Inbound</span>
                </div>
                <p className="text-[9px] text-slate-500 mb-3">Set Windows Firewall default policy to block ALL incoming connections. BERYL service ports stay open automatically.</p>
                <div className="flex gap-2">
                  <button onClick={blockAllInbound}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] font-black uppercase hover:bg-red-500/20 transition-all">
                    <Lock className="w-3 h-3" /> LOCKDOWN
                  </button>
                  <button onClick={restoreInbound}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[9px] font-black uppercase hover:bg-slate-700 transition-all">
                    <Unlock className="w-3 h-3" /> RESTORE
                  </button>
                </div>
              </div>

              {/* Manual block */}
              <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="w-4 h-4 text-orange-400" />
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Manual IP Block</span>
                </div>
                <input
                  type="text"
                  value={manualIp}
                  onChange={e => setManualIp(e.target.value)}
                  placeholder="1.2.3.4"
                  className="w-full bg-midnight-900 border border-midnight-700 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 mb-2 focus:outline-none focus:border-orange-500/50"
                />
                <input
                  type="text"
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  placeholder="reason"
                  className="w-full bg-midnight-900 border border-midnight-700 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 mb-2 focus:outline-none focus:border-orange-500/50"
                />
                <button onClick={blockManual}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-black uppercase hover:bg-orange-500/20 transition-all">
                  <Ban className="w-3 h-3" /> BLOCK IP
                </button>
              </div>
            </div>

            {/* Add allow port */}
            <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-green-400" />
                <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">Allow Inbound Port</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newPort}
                  onChange={e => setNewPort(e.target.value)}
                  placeholder="Port number (e.g. 3000)"
                  className="flex-1 bg-midnight-900 border border-midnight-700 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-green-500/50"
                />
                <button onClick={addAllowPort}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-[9px] font-black uppercase hover:bg-green-500/20 transition-all">
                  <Plus className="w-3 h-3" /> ADD
                </button>
              </div>
              <p className="text-[8px] text-slate-600 mt-2">
                Whitelisted: {status?.safe_ports?.join(', ') ?? '—'}
              </p>
            </div>

            {/* Brute force quick scan */}
            <div className="bg-midnight-800 border border-midnight-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-yellow-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Brute Force Scanner
                  </p>
                  <p className="text-[9px] text-slate-500">Scans Windows Security Event Log (Event 4625) for failed logons. Auto-bans IPs with 5+ attempts in 5 min.</p>
                </div>
                <button onClick={scanBruteForce} disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[9px] font-black uppercase hover:bg-yellow-500/20 transition-all disabled:opacity-50">
                  {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  {scanning ? 'SCANNING...' : 'SCAN NOW'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BLOCKED IPs TAB ── */}
        {activeTab === 'blocked' && (
          <div className="h-full flex flex-col">
            <div className="shrink-0 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60 flex items-center justify-between">
              <span className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em]">{blocked.length} Blocked IPs — Windows Firewall Rules</span>
              <button onClick={refresh} className="text-slate-600 hover:text-slate-400"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {blocked.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-700">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-green-700" />
                  <p className="text-[10px]">No IPs currently blocked</p>
                </div>
              ) : blocked.map((b, i) => (
                <div key={i} className="flex items-center gap-3 bg-midnight-800 border border-midnight-700 rounded-xl px-4 py-2.5 hover:border-red-500/30 transition-colors">
                  <Ban className="w-4 h-4 text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-red-300">{b.ip}</span>
                      {b.attempts > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">
                          {b.attempts} attempts
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] text-slate-500 mt-0.5">{b.reason} · {b.ban_ts}</p>
                  </div>
                  <button onClick={() => unblock(b.ip)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-[8px] font-black uppercase hover:bg-green-500/20 transition-all">
                    <Unlock className="w-3 h-3" /> UNBLOCK
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BRUTE FORCE TAB ── */}
        {activeTab === 'brute' && (
          <div className="h-full flex flex-col">
            <div className="shrink-0 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black text-yellow-400 uppercase tracking-[0.2em]">Brute Force Attack Monitor</span>
                <p className="text-[8px] text-slate-600 mt-0.5">Event 4625 (failed logons) + connection surge detection. Auto-ban at 5+ attempts/5 min.</p>
              </div>
              <button onClick={scanBruteForce} disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[9px] font-black uppercase disabled:opacity-50 hover:bg-yellow-500/20 transition-all">
                {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                {scanning ? 'SCANNING...' : 'SCAN NOW'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {bfEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-700">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-green-700" />
                  <p className="text-[10px]">Run a scan to check for brute force attacks</p>
                  <p className="text-[9px] text-slate-700 mt-1">Reads Windows Security Event Log (requires Event Log access)</p>
                </div>
              ) : bfEvents.map((ev, i) => {
                const banned = blocked.some(b => b.ip === ev.ip);
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border transition-colors ${
                    banned ? 'bg-red-500/5 border-red-500/20' : ev.count >= 5 ? 'bg-orange-500/5 border-orange-500/30' : 'bg-midnight-800 border-midnight-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${banned ? 'bg-red-500' : ev.count >= 5 ? 'bg-orange-500 animate-pulse' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-200">{ev.ip}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                          ev.count >= 10 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          ev.count >= 5  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>{ev.count} ATTEMPTS</span>
                        {banned && <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">BANNED</span>}
                      </div>
                      <p className="text-[8px] text-slate-500 mt-0.5">User: {ev.user || '—'} · Logon type: {ev.logon_type || '—'}</p>
                    </div>
                    {!banned && (
                      <button onClick={() => { axios.post(`${API}/firewall/block`, { ip: ev.ip, reason: `brute_force (${ev.count} attempts)` }).then(refresh); flash(`Blocked ${ev.ip}`); }}
                        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[8px] font-black uppercase hover:bg-red-500/20 transition-all">
                        <Ban className="w-3 h-3" /> BAN
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {activeTab === 'logs' && (
          <div className="h-full flex flex-col">
            <div className="shrink-0 px-4 py-2.5 border-b border-midnight-800 bg-midnight-900/60 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Firewall Event Log ({fwLogs.length} entries)</span>
              <button onClick={refresh} className="text-slate-600 hover:text-slate-400"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {fwLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-700">
                  <Terminal className="w-6 h-6 mb-2" />
                  <p className="text-[9px]">No firewall events yet</p>
                </div>
              ) : fwLogs.map((entry, i) => (
                <div key={i} className="flex flex-col gap-0.5 px-3 py-1.5 hover:bg-midnight-800/30 rounded mx-1 mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[7.5px] text-slate-700 shrink-0 tabular-nums">{entry.ts}</span>
                    <span className={`text-[8px] font-black shrink-0 ${RISK_COLOR[entry.level] || 'text-slate-400'}`}>{entry.level}</span>
                  </div>
                  <p className="text-[8.5px] font-mono text-slate-400 leading-tight pl-1">{entry.msg}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirewallPanel;
