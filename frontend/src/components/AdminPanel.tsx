import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Zap, Cpu, Activity, Globe, Sliders, Key, CheckCircle, XCircle, Loader2, Github, Mic } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('A');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newKeyAlias, setNewKeyAlias] = useState('');
  const [keyType, setKeyType] = useState('huggingface');
  const [testResult, setTestResult] = useState<{ status: string; user?: string; detail?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  // Voice Settings State
  const [selectedVoice, setSelectedVoice] = useState('parler-tts/parler-tts-mini-v1');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/keys');
      setKeys(response.data);
    } catch (err) {
      console.error("Failed to fetch keys", err);
    }
  };

  const handleTestKey = async () => {
    if (!newKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await axios.post('http://127.0.0.1:8000/test_key', {
        key_type: keyType,
        token: newKey
      });
      setTestResult(response.data);
    } catch (err) {
      setTestResult({ status: 'error', detail: 'Connection failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveKey = async () => {
    try {
      await axios.post('http://127.0.0.1:8000/update_key', {
        key_type: keyType,
        token: newKey
      });
      fetchKeys();
      setNewKey('');
      setTestResult(null);
    } catch (err) {
      console.error("Failed to save key", err);
    }
  };

  const saveVoiceSettings = async () => {
     try {
        await axios.post('http://127.0.0.1:8000/voice/config', {
           model: selectedVoice,
           speed: voiceSpeed
        });
        // Feedback could be added here
     } catch(err) {
        console.error("Failed to update voice config", err);
     }
  };

  const panels = [
    { id: 'A', title: 'Token Allocation', icon: Activity },
    { id: 'B', title: 'MCP Permissions', icon: Shield },
    { id: 'C', title: 'Sandbox & Cache', icon: Cpu },
    { id: 'D', title: 'Hyperparameters', icon: Sliders },
    { id: 'E', title: 'Router Proxy', icon: Globe },
    { id: 'F', title: 'API Key Vault', icon: Key },
    { id: 'G', title: 'Voice Engine (O.V.E)', icon: Mic },
  ];

  return (
    <div className="flex space-x-8 h-[600px]">
      {/* Sidebar Navigation */}
      <div className="w-64 space-y-1">
        {panels.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveTab(p.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === p.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <p.icon className="w-5 h-5" />
            <span className="font-medium">Panel {p.id}: {p.title}</span>
          </button>
        ))}
      </div>

      {/* Panel Content Area */}
      <div className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 overflow-y-auto">
        {activeTab === 'A' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-green-400" />
              <span>Token Allocation & Safety Throttle</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Hard Stop Threshold</label>
                <input type="number" defaultValue={250000} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Monthly Budget (HF Pro)</label>
                <div className="text-lg font-mono text-blue-400">2,000,000 / 2,000,000</div>
              </div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 h-40 flex items-center justify-center text-slate-500 italic text-sm">
              Live Utilization Graph Placeholder
            </div>
          </div>
        )}

        {activeTab === 'B' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-400" />
              <span>Model Context Protocol (MCP) Permissions</span>
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Terminal Execution Blocks', enabled: true },
                { label: 'System File-Write Authorizations', enabled: false },
                { label: 'Local Git State Queries', enabled: true }
              ].map((opt, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${opt.enabled ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${opt.enabled ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>
              ))}
              <div className="mt-6">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Security Guardrails (Regex Paths)</label>
                <textarea 
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full h-24 text-slate-200 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  defaultValue={`^/(etc|var|usr|bin|root)/.*\n!^/Users/tjlsu/hf-desktop-client/.*`}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'C' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <span>Sandbox Port & Cache Optimization</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Vite HMR Port</label>
                <input type="number" defaultValue={5173} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Preview Port</label>
                <input type="number" defaultValue={8080} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl text-xs text-blue-300">
              <strong>Cache Symlinking Matrix:</strong> Prioritizing <code>~/.cache/huggingface/hub</code> for zero-latency local fallback.
            </div>
          </div>
        )}

        {activeTab === 'D' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-yellow-400" />
              <span>Advanced Generation Hyperparameters</span>
            </h3>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 font-mono text-sm">
              <pre className="text-blue-400">
                {`{
  "temperature": 0.15,
  "max_new_tokens": 8192,
  "repetition_penalty": 1.15
}`}
              </pre>
            </div>
            <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition-colors">
              Edit Configuration JSON
            </button>
          </div>
        )}

        {activeTab === 'E' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Globe className="w-5 h-5 text-blue-400" />
              <span>Router Proxy & Custom Endpoints</span>
            </h3>
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Base Endpoint URL</label>
                <input type="text" defaultValue="https://router.huggingface.co" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Local Gateway (Ollama)</label>
                <input type="text" placeholder="http://localhost:11434" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}
        {activeTab === 'F' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Key className="w-5 h-5 text-yellow-500" />
              <span>API Key Vault & Connectivity Test</span>
            </h3>
            
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Platform</label>
                    <select 
                      value={keyType}
                      onChange={(e) => setKeyType(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="huggingface">Hugging Face</option>
                      <option value="github_main">GitHub (Main)</option>
                      <option value="github_secondary">GitHub (Secondary)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Current Active Key</label>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 font-mono text-xs">
                      {keyType === 'huggingface' ? keys['HF_TOKEN'] || 'Not Set' : 
                       keyType === 'github_main' ? keys['GITHUB_MAIN'] || 'Not Set' : 
                       'See Secondary List Below'}
                    </div>
                  </div>
               </div>
               
               <div>
                 <label className="text-xs text-slate-500 font-bold uppercase block mb-2">New API Token / Key</label>
                 <div className="flex space-x-2 mb-2">
                    {keyType === 'github_secondary' && (
                      <input 
                        type="text" 
                        placeholder="Alias (e.g., Work)"
                        value={newKeyAlias}
                        onChange={(e) => setNewKeyAlias(e.target.value)}
                        className="w-1/3 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                    <input 
                      type="password" 
                      placeholder={`Enter ${keyType} token...`}
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button 
                      onClick={handleTestKey}
                      disabled={isTesting || !newKey.trim() || (keyType === 'github_secondary' && !newKeyAlias.trim())}
                      className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center space-x-2 disabled:opacity-50"
                    >
                      {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>TEST</span>}
                    </button>
                 </div>
                 {keyType.startsWith('github') && (
                   <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline">
                     Need a token? Generate a new GitHub Fine-Grained Token here.
                   </a>
                 )}
               </div>

               {testResult && (
                 <div className={`p-3 rounded-xl flex items-center justify-between border ${testResult.status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <div className="flex items-center space-x-3">
                       {testResult.status === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                       <div className="text-xs">
                          <p className="font-bold">{testResult.status === 'success' ? 'Connection Successful' : 'Connection Failed'}</p>
                          <p className="opacity-70">{testResult.status === 'success' ? `Authenticated as: ${testResult.user}` : testResult.detail}</p>
                       </div>
                    </div>
                    {testResult.status === 'success' && (
                      <button 
                        onClick={handleSaveKey}
                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-[10px] font-bold transition-all"
                      >
                        SAVE TO VAULT
                      </button>
                    )}
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                     <Zap className="w-5 h-5 text-blue-400" />
                     <span className="text-sm font-bold">Hugging Face</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${keys['HF_TOKEN'] !== 'Not Set' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {keys['HF_TOKEN'] !== 'Not Set' ? 'LINKED' : 'UNLINKED'}
                  </span>
               </div>
               <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                     <Github className="w-5 h-5 text-slate-100" />
                     <span className="text-sm font-bold">GitHub (Main)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${keys['GITHUB_MAIN'] !== 'Not Set' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {keys['GITHUB_MAIN'] !== 'Not Set' ? 'LINKED' : 'UNLINKED'}
                  </span>
               </div>
            </div>

            {/* GitHub Porting Utility */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
               <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                 <Github className="w-5 h-5 text-purple-400" />
                 <span>GitHub Repository Porter</span>
               </h3>
               <p className="text-xs text-slate-400 leading-relaxed">
                 Seamlessly port a repository from any linked secondary GitHub account to your main GitHub account.
               </p>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs text-slate-500 font-bold uppercase block mb-2">From Secondary Account</label>
                   <select className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500">
                      <option value="">Select Account...</option>
                      {/* Normally map over secondary keys here */}
                      <option value="mock">Work Account (Mock)</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Target Repository Name</label>
                   <input type="text" placeholder="e.g., owner/repo" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                 </div>
               </div>
               <button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] text-sm">
                 EXECUTE PORT TO MAIN
               </button>
            </div>
          </div>
        )}

        {activeTab === 'G' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <Mic className="w-5 h-5 text-purple-400" />
              <span>Voice Engine (O.V.E) Configuration</span>
            </h3>
            
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">TTS Model (Parler)</label>
                <select 
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="parler-tts/parler-tts-mini-v1">parler-tts-mini-v1 (Default, Fast)</option>
                  <option value="parler-tts/parler-tts-large-v1">parler-tts-large-v1 (High Quality, Slower)</option>
                </select>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Playback Speed: {voiceSpeed}x</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1"
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <button 
                onClick={saveVoiceSettings}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl transition-all shadow-lg shadow-purple-900/20"
              >
                Save O.V.E Preferences
              </button>
            </div>
            
            <div className="p-4 bg-purple-900/20 border border-purple-500/20 rounded-xl mt-4">
               <p className="text-xs text-purple-400 leading-relaxed font-medium">
                 Note: STT (Speech-to-Text) is hardcoded to use `openai/whisper-large-v3-turbo` on Hugging Face Inference Endpoints to guarantee maximum precision during real-time transcription.
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
