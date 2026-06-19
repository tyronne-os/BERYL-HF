import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, BarChart3, Server, RefreshCw, Wallet, Gauge, HardDrive, Cpu, Activity, Edit3, X, Save, Heart, Sparkles } from 'lucide-react';
import { API } from '../api';

interface ModelLedgerRow {
  model: string;
  calls: number;
  prompt: number;
  completion: number;
  tokens: number;
  cost: number;
  favorite: boolean;
  first_used: string | null;
  last_used: string | null;
  price_in: number;
  price_out: number;
  is_local: boolean;
}

interface Billing {
  plan: string;
  credits: number;
  automatic_recharge: string | null;
  current_period_usage: number;
  period_start: string;
  period_ends: string;
  storage: { private_tb_used: number; private_tb_total: number; public_tb_used: number; public_tb_total: number };
  compute: { zerogpu_used_min: number; zerogpu_total_min: number; inference_used: number; inference_total: number };
  rate_limits: { hub_apis_used: number; hub_apis_total: number; resolvers_used: number; resolvers_total: number; pages_used: number; pages_total: number };
  inference_breakdown: { total_requests: number; total_cost: number; providers: { name: string; requests: number }[] };
  compute_usage: { spaces_total: number; items: { name: string; hardware: string; duration: string; cost: number }[] };
  last_updated: string;
}

interface Usage {
  by_model: Record<string, { prompt: number; completion: number; calls: number }>;
  total: number;
  velocity_per_min: number;
  calls: number;
  elapsed_min: number;
}

const Bar: React.FC<{ used: number; total: number; color: string }> = ({ used, total, color }) => {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
      <div className={`${color} h-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const CostTracker: React.FC = () => {
  const [bill, setBill] = useState<Billing | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [ledger, setLedger] = useState<ModelLedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Billing | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchBilling = async () => {
    try {
      const { data } = await axios.get<Billing>(`${API}/hf/billing`);
      setBill(data);
    } catch (e) { console.error('billing fetch failed', e); }
    finally { setLoading(false); }
  };

  const fetchUsage = async () => {
    try {
      const { data } = await axios.get<Usage>(`${API}/usage`);
      setUsage(data);
    } catch (e) { /* backend may be warming */ }
  };

  const fetchLedger = async () => {
    try {
      const { data } = await axios.get<{ models: ModelLedgerRow[]; total_cost: number }>(`${API}/usage/models`);
      setLedger(data.models || []);
      setLedgerTotal(data.total_cost || 0);
    } catch (e) { /* backend may be warming */ }
  };

  const toggleFavorite = async (model: string) => {
    try {
      await axios.post(`${API}/usage/models/favorite`, { model });
      fetchLedger();
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    fetchBilling();
    fetchUsage();
    fetchLedger();
    const t = setInterval(() => { fetchUsage(); fetchLedger(); }, 5000);
    return () => clearInterval(t);
  }, []);

  const openEditor = () => { setDraft(JSON.parse(JSON.stringify(bill))); setEditing(true); };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/hf/billing`, draft);
      setBill(data.data);
      setEditing(false);
    } catch (e) { console.error('save failed', e); }
    finally { setSaving(false); }
  };

  const upd = (path: string, value: any) => {
    if (!draft) return;
    const next: any = JSON.parse(JSON.stringify(draft));
    const keys = path.split('.');
    let o = next;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
    setDraft(next);
  };

  if (loading || !bill) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900 text-slate-500">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-bold uppercase tracking-widest">Loading HF Billing Mirror…</span>
        </div>
      </div>
    );
  }

  const creditLow = bill.credits < 10;

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <DollarSign className="w-8 h-8 text-oldgold-400" />
              <span>Billing &amp; Usage</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-oldgold-500/15 text-oldgold-400 border border-oldgold-500/30 tracking-widest">{bill.plan}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm flex items-center space-x-2">
              <span>Mirror of your Hugging Face billing dashboard.</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">Updated {bill.last_updated}</span>
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`rounded-xl px-6 py-3 border flex items-center space-x-3 ${creditLow ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
              <Wallet className={`w-5 h-5 ${creditLow ? 'text-red-400' : 'text-green-400'}`} />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Credits Balance</p>
                <p className={`text-xl font-bold ${creditLow ? 'text-red-400' : 'text-green-400'}`}>${bill.credits.toFixed(2)}</p>
              </div>
            </div>
            <button onClick={openEditor} className="bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 px-4 py-3 rounded-xl font-bold text-sm flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              <Edit3 className="w-4 h-4" />
              <span>Update from HF</span>
            </button>
          </div>
        </div>

        {creditLow && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Low credit balance — ${bill.credits.toFixed(2)} remaining. Top up to avoid Space downtime.</span>
          </div>
        )}

        {/* FREE PRO INFERENCE ALLOWANCE TRACKER — free→paid transition */}
        {(() => {
          const used = bill.compute.inference_used;
          const total = bill.compute.inference_total;
          const remaining = Math.max(total - used, 0);
          const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
          const onPaid = used >= total;
          const nearLimit = pct >= 80 && !onPaid;
          const overage = onPaid ? used - total : 0;
          return (
            <div className={`mb-8 rounded-2xl border p-6 ${onPaid ? 'border-red-500/40 bg-red-500/5' : nearLimit ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                  <Gauge className={`w-6 h-6 ${onPaid ? 'text-red-400' : nearLimit ? 'text-yellow-400' : 'text-green-400'}`} />
                  <div>
                    <h2 className="text-lg font-bold">Free PRO Inference Allowance</h2>
                    <p className="text-xs text-slate-500">$2.00/mo included with PRO · MiniMax-M3 + other provider calls draw from this first</p>
                  </div>
                </div>
                <span className={`text-[11px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${onPaid ? 'bg-red-500/15 text-red-400 border-red-500/40' : nearLimit ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' : 'bg-green-500/15 text-green-400 border-green-500/40'}`}>
                  {onPaid ? '⚠ Paid Inference Active' : nearLimit ? 'Approaching Limit' : '✓ On Free Tier'}
                </span>
              </div>
              <div className="relative w-full bg-slate-950 h-4 rounded-full overflow-hidden border border-slate-800 mb-3">
                <div className={`h-full transition-all duration-700 ${onPaid ? 'bg-red-500' : nearLimit ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                {/* transition marker at 100% (the free→paid line) */}
                <div className="absolute top-0 right-0 h-full w-0.5 bg-white/40" title="Free → Paid transition" />
              </div>
              <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <span className="text-slate-400">Used <span className="font-bold text-slate-200">${used.toFixed(2)}</span> of <span className="font-bold text-slate-200">${total.toFixed(2)}</span> free</span>
                {onPaid ? (
                  <span className="text-red-400 font-bold">Free exhausted — now billing paid inference (+${overage.toFixed(2)} over)</span>
                ) : (
                  <span className="text-slate-400"><span className="font-bold text-green-400">${remaining.toFixed(2)}</span> free remaining before paid kicks in</span>
                )}
              </div>
              {nearLimit && !onPaid && (
                <p className="mt-3 text-xs text-yellow-400/90 flex items-center space-x-2"><Activity className="w-3.5 h-3.5" /><span>You're at {pct.toFixed(0)}% of free inference. After ${total.toFixed(2)}, calls bill to your ${bill.credits.toFixed(2)} credits / payment method. Switch heavy work to local Ollama models to stay free.</span></p>
              )}
              {onPaid && (
                <p className="mt-3 text-xs text-red-400/90 flex items-center space-x-2"><Activity className="w-3.5 h-3.5" /><span>Free allowance spent. M3 calls now bill paid inference against your ${bill.credits.toFixed(2)} credit balance. Consider the local Ollama fallback for unlimited free generation.</span></p>
              )}
            </div>
          );
        })()}

        {/* ── MODEL COST TRACKER — "Models I've Tried / Love" ── */}
        <div className="mb-8 bg-slate-800 border border-oldgold-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
            <h2 className="text-lg font-bold flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-oldgold-400" />
              <span>Model Cost Tracker</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-oldgold-500/15 text-oldgold-400 border border-oldgold-500/30 tracking-widest">{ledger.length} TRIED</span>
            </h2>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Lifetime Inference Spend</p>
              <p className="text-xl font-bold text-oldgold-400">${ledgerTotal.toFixed(4)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-5">Every model you try is logged here with its estimated cost. Tap the heart to mark the ones you love. Estimates use provider rates (USD / 1M tokens) — local Ollama models are free.</p>

          {ledger.length === 0 ? (
            <p className="text-sm text-slate-600 italic text-center py-6">No models tried yet. Pick a model and send a message — it'll show up here with its running cost.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
                    <th className="text-left font-bold py-2 pr-2">Love</th>
                    <th className="text-left font-bold py-2 pr-2">Model</th>
                    <th className="text-right font-bold py-2 px-2">Calls</th>
                    <th className="text-right font-bold py-2 px-2">Tokens</th>
                    <th className="text-right font-bold py-2 px-2">Rate (in/out)</th>
                    <th className="text-right font-bold py-2 px-2">Last Used</th>
                    <th className="text-right font-bold py-2 pl-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((m) => (
                    <tr key={m.model} className={`border-b border-slate-700/40 hover:bg-slate-900/40 transition-colors ${m.favorite ? 'bg-rose-500/[0.04]' : ''}`}>
                      <td className="py-2.5 pr-2">
                        <button onClick={() => toggleFavorite(m.model)} title={m.favorite ? 'Unfavorite' : 'Mark as loved'}
                          className={`transition-colors ${m.favorite ? 'text-rose-400' : 'text-slate-600 hover:text-rose-400'}`}>
                          <Heart className="w-4 h-4" fill={m.favorite ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">{m.model.split('/').pop()}</span>
                          {m.is_local
                            ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">FREE</span>
                            : m.favorite && <Sparkles className="w-3 h-3 text-rose-400/70" />}
                        </div>
                        <span className="text-[10px] text-slate-600">{m.model.split('/')[0]}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-300">{m.calls}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">{m.tokens.toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] text-slate-500">{m.is_local ? '—' : `$${m.price_in}/$${m.price_out}`}</td>
                      <td className="py-2.5 px-2 text-right text-[11px] text-slate-500">{m.last_used ? new Date(m.last_used).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td className="py-2.5 pl-2 text-right font-mono font-bold text-oldgold-400">${m.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top stat row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm">Current Period Usage</span>
              <span className="text-[10px] text-slate-500 font-bold">{bill.period_start} – {bill.period_ends}</span>
            </div>
            <p className="text-3xl font-bold text-oldgold-400">${bill.current_period_usage.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Ends {bill.period_ends}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm flex items-center space-x-1"><Cpu className="w-4 h-4 text-cyan-400" /><span>ZeroGPU</span></span>
              <span className="text-[10px] text-slate-500 font-bold">minutes</span>
            </div>
            <p className="text-3xl font-bold">{bill.compute.zerogpu_used_min}<span className="text-base font-normal text-slate-500"> / {bill.compute.zerogpu_total_min}</span></p>
            <div className="mt-3"><Bar used={bill.compute.zerogpu_used_min} total={bill.compute.zerogpu_total_min} color="bg-cyan-500" /></div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm flex items-center space-x-1"><Gauge className="w-4 h-4 text-yellow-400" /><span>Inference Usage</span></span>
            </div>
            <p className="text-3xl font-bold">${bill.compute.inference_used.toFixed(2)}<span className="text-base font-normal text-slate-500"> / ${bill.compute.inference_total.toFixed(2)}</span></p>
            <div className="mt-3"><Bar used={bill.compute.inference_used} total={bill.compute.inference_total} color="bg-yellow-500" /></div>
          </div>
        </div>

        {/* Storage */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-6 flex items-center space-x-2"><HardDrive className="w-5 h-5 text-teal-400" /><span>Storage</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between text-sm mb-2"><span className="text-slate-300">Private Storage</span><span className="text-slate-400 font-mono">{bill.storage.private_tb_used} / {bill.storage.private_tb_total} TB</span></div>
              <Bar used={bill.storage.private_tb_used} total={bill.storage.private_tb_total} color="bg-teal-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2"><span className="text-slate-300">Public Storage</span><span className="text-slate-400 font-mono">{bill.storage.public_tb_used} / {bill.storage.public_tb_total} TB</span></div>
              <Bar used={bill.storage.public_tb_used} total={bill.storage.public_tb_total} color="bg-teal-500" />
            </div>
          </div>
        </div>

        {/* Two columns: inference breakdown + compute usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center space-x-2"><BarChart3 className="w-5 h-5 text-cyan-400" /><span>Inference Usage</span></h2>
              <span className="text-sm font-mono text-slate-400">{bill.inference_breakdown.total_requests} req · ${bill.inference_breakdown.total_cost.toFixed(2)}</span>
            </div>
            <div className="space-y-4">
              {bill.inference_breakdown.providers.map((p, i) => {
                const pct = bill.inference_breakdown.total_requests > 0 ? (p.requests / bill.inference_breakdown.total_requests) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2"><span className="font-medium text-slate-200">{p.name}</span><span className="text-slate-400">{p.requests} requests</span></div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div className="bg-cyan-500 h-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center space-x-2"><Server className="w-5 h-5 text-oldgold-400" /><span>Compute · Spaces</span></h2>
              <span className="text-lg font-bold text-oldgold-400">${bill.compute_usage.spaces_total.toFixed(2)}</span>
            </div>
            <div className="space-y-3">
              {bill.compute_usage.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-200 truncate">{it.name}</p>
                    <p className="text-[11px] text-slate-500"><span className="text-cyan-400 font-bold">{it.hardware}</span> · {it.duration}</p>
                  </div>
                  <span className="font-mono text-oldgold-400 font-bold shrink-0 ml-3">${it.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rate limits */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-6 flex items-center space-x-2"><Activity className="w-5 h-5 text-green-400" /><span>Hub Rate Limits</span><span className="text-[10px] text-slate-500 font-normal">(per 5-min interval)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Hub APIs', used: bill.rate_limits.hub_apis_used, total: bill.rate_limits.hub_apis_total },
              { label: 'Resolvers', used: bill.rate_limits.resolvers_used, total: bill.rate_limits.resolvers_total },
              { label: 'Pages', used: bill.rate_limits.pages_used, total: bill.rate_limits.pages_total },
            ].map((r, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-2"><span className="text-slate-300">{r.label}</span><span className="text-slate-400 font-mono">{r.used} / {r.total.toLocaleString()}</span></div>
                <Bar used={r.used} total={r.total} color="bg-green-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Live local session telemetry (real, from Beryl) */}
        <div className="bg-slate-800 border border-oldgold-500/30 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center space-x-2"><Activity className="w-5 h-5 text-oldgold-400" /><span>Live Session · Beryl Inference Ledger</span></h2>
          <p className="text-xs text-slate-500 mb-6">Real token throughput tracked locally this session (not billed by HF for local/Ollama models).</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50"><p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total Tokens</p><p className="text-2xl font-bold text-oldgold-400">{usage ? usage.total.toLocaleString() : '0'}</p></div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50"><p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Velocity / min</p><p className="text-2xl font-bold">{usage ? usage.velocity_per_min.toLocaleString() : '0'}</p></div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50"><p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Inference Calls</p><p className="text-2xl font-bold">{usage ? usage.calls : 0}</p></div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50"><p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Session Min</p><p className="text-2xl font-bold">{usage ? usage.elapsed_min.toFixed(1) : '0'}</p></div>
          </div>
          {usage && Object.keys(usage.by_model).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(usage.by_model).map(([model, v]) => (
                <div key={model} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-700/40 text-sm">
                  <span className="font-mono text-slate-300 truncate">{model}</span>
                  <span className="text-slate-400 font-mono shrink-0 ml-3">{(v.prompt + v.completion).toLocaleString()} tok · {v.calls} calls</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 italic text-center py-4">No inference yet this session — send a message in Chat to start tracking.</p>
          )}
        </div>
      </div>

      {/* Editor modal */}
      {editing && draft && (
        <div className="fixed inset-0 bg-midnight-950/90 z-[100] flex items-center justify-center p-6" onClick={() => setEditing(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <div>
                <h2 className="text-xl font-bold flex items-center space-x-2"><Edit3 className="w-5 h-5 text-oldgold-400" /><span>Update HF Billing Snapshot</span></h2>
                <p className="text-xs text-slate-500 mt-1">Paste the latest figures from your HF billing dashboard.</p>
              </div>
              <button onClick={() => setEditing(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Credits Balance ($)" value={draft.credits} onChange={(v) => upd('credits', v)} />
                <Field label="Current Period Usage ($)" value={draft.current_period_usage} onChange={(v) => upd('current_period_usage', v)} />
                <Field label="ZeroGPU Used (min)" value={draft.compute.zerogpu_used_min} onChange={(v) => upd('compute.zerogpu_used_min', v)} />
                <Field label="ZeroGPU Total (min)" value={draft.compute.zerogpu_total_min} onChange={(v) => upd('compute.zerogpu_total_min', v)} />
                <Field label="Inference Used ($)" value={draft.compute.inference_used} onChange={(v) => upd('compute.inference_used', v)} />
                <Field label="Inference Total ($)" value={draft.compute.inference_total} onChange={(v) => upd('compute.inference_total', v)} />
                <Field label="Private Storage Used (TB)" value={draft.storage.private_tb_used} onChange={(v) => upd('storage.private_tb_used', v)} />
                <Field label="Public Storage Used (TB)" value={draft.storage.public_tb_used} onChange={(v) => upd('storage.public_tb_used', v)} />
                <Field label="Spaces Compute Total ($)" value={draft.compute_usage.spaces_total} onChange={(v) => upd('compute_usage.spaces_total', v)} />
                <Field label="Inference Requests" value={draft.inference_breakdown.total_requests} onChange={(v) => upd('inference_breakdown.total_requests', v)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Spaces Compute Items (JSON)</label>
                <textarea
                  defaultValue={JSON.stringify(draft.compute_usage.items, null, 2)}
                  onChange={(e) => { try { upd('compute_usage.items', JSON.parse(e.target.value)); } catch { /* ignore until valid */ } }}
                  className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-oldgold-500"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-900 flex items-center justify-end space-x-3 sticky bottom-0">
              <button onClick={() => setEditing(false)} className="px-5 py-2 rounded-xl text-slate-400 hover:bg-slate-800">Cancel</button>
              <button onClick={saveDraft} disabled={saving} className="px-6 py-2 bg-oldgold-500 hover:bg-oldgold-400 text-midnight-950 rounded-xl font-bold flex items-center space-x-2 disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-xs text-slate-500 font-bold uppercase block mb-2">{label}</label>
    <input
      type="number" step="0.01" value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:border-oldgold-500"
    />
  </div>
);

export default CostTracker;
