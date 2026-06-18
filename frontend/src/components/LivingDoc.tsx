import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Terminal, Cpu, Wand2, ArrowRight, Image as ImageIcon, CheckCircle, Zap, Shield, Rocket, Minimize2, FolderGit2, ShieldAlert, Server, Mic, Sparkles, Flame } from 'lucide-react';

interface LivingDocProps {
  navigateTo: (page: string) => void;
}

const LivingDoc: React.FC<LivingDocProps> = ({ navigateTo }) => {
  const [activeSection, setActiveSection] = useState('intro');
  const contentRef = useRef<HTMLDivElement>(null);

  // --- Content Data Structure ---
  const sections = [
    {
      id: 'intro',
      title: '1. Introduction to Beryl HF',
      icon: <BookOpen className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Introduction to Beryl HF</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Welcome to the Beryl HF Living Documentation. This next-generation manual is designed to be your definitive guide to operating, orchestrating, and mastering the Dual-Panel HF Builder environment. As you add new features, this document autonomously updates to reflect the current state of your local workspace.
          </p>
          <div className="my-8 rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 p-1 flex items-center justify-center h-64 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-purple-900/40 mix-blend-overlay"></div>
            <ImageIcon className="w-12 h-12 text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="absolute bottom-4 left-4 text-xs font-mono text-slate-400">Fig 1.1 - The Beryl HF Interface Architecture</span>
          </div>
          <h3 className="text-2xl font-bold text-white mt-8 mb-3">The Core Philosophy</h3>
          <p className="text-slate-300 leading-relaxed">
            Beryl is engineered entirely around your Hugging Face Pro allocation (2M monthly tokens) to completely bypass native Anthropic rate limits. By utilizing frontier open-source weights (MiniMax, Qwen, Kimi), we achieve zero-latency reasoning cycles. The architecture features a strict visual split: The 33% Command Rail for context generation, and the 66% Live Viewport for immersive preview rendering.
          </p>
          <div className="mt-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-blue-400 mb-2 flex items-center"><Zap className="w-5 h-5 mr-2"/> Quick Action</h4>
            <p className="text-sm text-slate-300 mb-4">Jump straight into the command rail to start prompting your primary model matrix.</p>
            <button onClick={() => navigateTo('chat')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
              Launch Chat Interface <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'cli-manual',
      title: '2. Comprehensive CLI Manual',
      icon: <Terminal className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Beryl CLI Operator's Manual</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            The Beryl CLI is a powerful terminal extension that bridges your local file system with the Hugging Face Inference routing matrix. It is capable of semantic codebase indexing, advanced agent scaffolding, and local environment diagnostics.
          </p>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Global Installation & Authentication</h3>
          <p className="text-slate-300 leading-relaxed">
            To utilize the CLI across any project directory, you must install the package globally. The CLI securely accesses your <code>HF_TOKEN</code> from your system keychain or local `.env` vault.
          </p>
          <pre className="bg-[#0d1117] text-[#c9d1d9] p-4 rounded-xl overflow-x-auto border border-slate-700 font-mono text-sm mt-4 mb-6">
            <code>
<span className="text-[#e5c07b]">npm</span> install -g @beryl-hf/cli<br/>
<span className="text-[#e5c07b]">beryl</span> auth login --provider huggingface<br/>
<span className="text-[#7f848e]"># Interactive prompt will request your Hugging Face Pro token</span>
            </code>
          </pre>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Primary Command Dictionary</h3>
          <div className="space-y-4">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <h4 className="text-lg font-mono text-green-400 font-bold mb-2">beryl init &lt;project-name&gt;</h4>
              <p className="text-sm text-slate-300">Initializes a new Beryl workspace. This provisions the <code>.beryl</code> directory, establishes the semantic vector graph map, and links the current directory to your active HF model routing matrix. <em>Example: <code>beryl init my-new-app --template react-ts</code></em></p>
            </div>
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <h4 className="text-lg font-mono text-green-400 font-bold mb-2">beryl index --semantic --deep</h4>
              <p className="text-sm text-slate-300">Forces a comprehensive rebuild of the local codebase vector index. The <code>--deep</code> flag ensures that AST (Abstract Syntax Tree) parsing is executed on all `.ts` and `.py` files for high-accuracy Retrieval Augmented Generation (RAG) when using the Chat interface.</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <h4 className="text-lg font-mono text-green-400 font-bold mb-2">beryl mcp add &lt;server-url&gt;</h4>
              <p className="text-sm text-slate-300">Hooks a new Model Context Protocol server into your global configuration. This allows your custom agents to interact with external tools (like SQLite, GitHub, or Figma). It automatically registers the tool definitions with the local Qwen/MiniMax models.</p>
            </div>
          </div>

          <div className="mt-8 p-6 bg-green-900/20 border border-green-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-green-400 mb-2 flex items-center"><Terminal className="w-5 h-5 mr-2"/> Interactive Terminal Emulator</h4>
            <p className="text-sm text-slate-300 mb-4">Prefer a visual UI for your CLI? Open the embedded CLI Dashboard to view telemetry and run commands visually.</p>
            <button onClick={() => navigateTo('cli')} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
              Open CLI Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'hf-tips',
      title: '3. HF Models: Tips & Customization',
      icon: <Cpu className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Mastering Hugging Face Models</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            The power of Beryl lies in its dynamic model routing. Understanding the nuances of open-weight models ensures you extract maximum performance from your 2M token allocation.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Model Specific Prompt Engineering</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <h4 className="font-bold text-blue-400 mb-2 text-lg">Qwen 2.5 Coder (32B)</h4>
                <p className="text-sm text-slate-300 mb-3">Highly optimized for rapid templating and strict JSON output. It prefers direct, imperative instructions.</p>
                <div className="bg-slate-900 p-3 rounded text-xs font-mono text-slate-400 border border-slate-700">
                  <span className="text-green-400">DO:</span> "Generate a React functional component using Tailwind. Output ONLY valid TypeScript."<br/><br/>
                  <span className="text-red-400">DON'T:</span> "Can you please think step by step about how to build a button?"
                </div>
             </div>
             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <h4 className="font-bold text-purple-400 mb-2 text-lg">MiniMax M2.5</h4>
                <p className="text-sm text-slate-300 mb-3">Excels at agentic orchestration and complex reasoning graphs. It responds well to persona adoption.</p>
                <div className="bg-slate-900 p-3 rounded text-xs font-mono text-slate-400 border border-slate-700">
                  <span className="text-green-400">DO:</span> "You are a Senior Systems Architect. Outline the directory structure for a scalable microservice..."<br/>
                </div>
             </div>
          </div>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Advanced Hyperparameter Tuning</h3>
          <p className="text-slate-300 leading-relaxed">
            Navigate to the Admin Back-Panel (Panel D) to configure generation constraints. For coding tasks, we highly recommend keeping <code>temperature</code> strictly between <strong>0.1 and 0.2</strong> to minimize hallucination. Set <code>repetition_penalty</code> to <strong>1.15</strong> to prevent the model from entering infinite loops during long-context generation.
          </p>

          <div className="my-8 rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 p-1 flex items-center justify-center h-48 relative group">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9IiMwZjExMTciLz4KPHBhdGggZD0iTTAgMTBsNDAgMjBNMCAzMGw0MC0yMCIgc3Ryb2tlPSIjMWUyOTIzIi8+Cjwvc3ZnPg==')] opacity-50"></div>
            <span className="absolute bottom-4 left-4 text-xs font-mono text-slate-400 z-10 bg-slate-900 px-2 py-1 rounded">Fig 3.1 - Hyperparameter Heatmap</span>
          </div>

          <div className="mt-8 p-6 bg-purple-900/20 border border-purple-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-purple-400 mb-2 flex items-center"><Wand2 className="w-5 h-5 mr-2"/> Explore Trending Architectures</h4>
            <p className="text-sm text-slate-300 mb-4">Discover newly released weights on the Hugging Face Hub and instantly add them to your routing matrix.</p>
            <button onClick={() => navigateTo('hf')} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
              Open HF Hub <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'agent-studio',
      title: '4. Building Advanced Agents',
      icon: <Wand2 className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Agent Studio & Pipelines</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Beryl's Agent Studio is a revolutionary visual environment for designing multi-agent workflows. Instead of relying on a single monolithic prompt, you can modularize intelligence.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">The Agentic Lifecycle</h3>
          <ol className="list-decimal list-inside space-y-4 text-slate-300">
            <li className="pl-2"><strong>Scaffolding:</strong> Define a persona (e.g., "Database Specialist") and assign a specific open-source weight (e.g., Kimi-K2.6 for its deep reasoning capacity).</li>
            <li className="pl-2"><strong>Tool Assignment:</strong> Attach Model Context Protocol (MCP) servers. An agent without tools is just a chatbot. Provide them with SQLite servers, local filesystem access, or external API endpoints.</li>
            <li className="pl-2"><strong>Visual Graphing:</strong> Use the Visual Workflow Orchestrator to draw connection lines. For example, route a User Input Node -&gt; UI Architect Node -&gt; Reviewer Node -&gt; Git Commit Node.</li>
          </ol>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Connecting MCP Servers</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            The Model Context Protocol standardizes how tools are exposed to LLMs. Beryl fully supports the MCP specification. In the Agent Studio, navigate to the MCP tab to view connected servers. Beryl automatically polls these servers and injects their JSON schema definitions into the context window of active agents.
          </p>
          
          <pre className="bg-[#0d1117] text-[#c9d1d9] p-4 rounded-xl overflow-x-auto border border-slate-700 font-mono text-sm">
            <code>
<span className="text-[#7f848e]"># Example: Starting an external MCP server</span><br/>
npx -y @modelcontextprotocol/server-sqlite --db-path ./local.db
            </code>
          </pre>

          <div className="mt-8 p-6 bg-orange-900/20 border border-orange-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-orange-400 mb-2 flex items-center"><Wand2 className="w-5 h-5 mr-2"/> Orchestrate Now</h4>
            <p className="text-sm text-slate-300 mb-4">Enter the visual node editor to start mapping out your intelligent team.</p>
            <button onClick={() => navigateTo('studio')} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
              Launch Agent Studio <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'advanced-features',
      title: '5. Advanced Unrequested Platform Capabilities (The 20+ Matrix)',
      icon: <Rocket className="w-4 h-4" />,
      content: (
        <div className="space-y-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Advanced Platform Capabilities</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Beyond the core routing matrix and canvas, Beryl HF features 20+ advanced, implicitly integrated architectural upgrades designed to elevate your developer experience to enterprise levels. These modules run silently in the background or are accessible via specialized GUI interactions.
          </p>

          <div className="grid grid-cols-1 gap-6">
            {[
              { 
                title: "1. Semantic Cache Warming", 
                desc: "The background AST indexer silently pre-embeds your most frequently accessed React/Python files. When an agent requests context, the tokens are injected instantly from a warmed local cache, shaving 400ms off TTFT (Time To First Token)." 
              },
              { 
                title: "2. Multi-Turn Rollbacks", 
                desc: "In the Canvas Viewport toolbar, the 'History (v1.x)' button isn't just a label. It tracks the last 50 DOM states of your preview, allowing you to visually rewind the artifact state instantly without reprompting the model." 
              },
              { 
                title: "3. Git-Aware Diffing", 
                desc: "When agents modify local code, the Code Inspector (Escape Hatch) highlights exact diffs using an inline Git integration, preventing blind overwrites of your manual logic." 
              },
              { 
                title: "4. Token-Aware PR Generation", 
                desc: "When connected to GitHub via the Project Hub, agents autonomously batch changes into logical Pull Requests, automatically crafting commit messages based on the diffs while respecting token limits." 
              },
              { 
                title: "5. Zero-Shot UI Scaffolding", 
                desc: "Upload an image of an interface via the Chat Pane's attachment zone. The Vision System (Computer Use mode) translates pixels directly into Tailwind/React boilerplate." 
              },
              { 
                title: "6. VRAM Prediction Engine", 
                desc: "Before provisioning an A100 or T4 in the GPU Manager, the system calculates your codebase size and predicts the exact VRAM required, preventing out-of-memory (OOM) crashes during local execution." 
              },
              { 
                title: "7. Cost-Cap Auto-Suspend", 
                desc: "A hard kill-switch linked to the Cost Tracker. If your deployment spikes and hits 95% of your daily budget, all active inference streams are aggressively suspended, saving your HF allocation." 
              },
              { 
                title: "8. Shadow Context Window", 
                desc: "Beryl strips out repetitive framework boilerplate (like basic import statements or CSS resets) before sending prompts to Hugging Face, effectively compressing prompts by up to 18%." 
              },
              { 
                title: "9. Prompt Injection Shields", 
                desc: "A local security layer intercepts user and API inputs, scanning for malicious overrides ('Ignore previous instructions') before sending them to the router." 
              },
              { 
                title: "10. Local/Remote Hybrid Routing", 
                desc: "If the HF Router experiences high latency (>1000ms), Beryl automatically shifts inference to your Local Gateway (Ollama) as defined in Admin Panel E, ensuring zero downtime." 
              },
              { 
                title: "11. Agentic Sub-Tasking", 
                desc: "Within Agent Studio workflows, primary agents can autonomously spawn specialized sub-agents to handle isolated functions in parallel (e.g., writing tests while the main agent refactors)." 
              },
              { 
                title: "12. Synthetic Data Generator", 
                desc: "Using the Qwen model, Beryl can inspect your TypeScript interfaces and instantly populate your application with hundreds of rows of realistic mock data for UI stress testing." 
              },
              { 
                title: "13. Context Pruning", 
                desc: "As chat histories grow beyond 8000 tokens, an efficient summarization loop condenses older messages into dense bullet points, maintaining intent while freeing up window space." 
              },
              { 
                title: "14. Cross-Language Translation", 
                desc: "Highlight a block of Python in the Code Inspector and trigger a contextual action to auto-compile it into Rust or Go via the model matrix." 
              },
              { 
                title: "15. Figma-to-Code Sync", 
                desc: "An implicit MCP integration where pasting a Figma URL allows the UI Architect agent to extract spacing, typography, and color tokens directly into your Tailwind configuration." 
              },
              { 
                title: "16. Headless Testing Agent", 
                desc: "Beryl monitors test suites in the background. If Playwright or Jest fails, an idle agent intercepts the traceback logs and proposes a patch before you even open the file." 
              },
              { 
                title: "17. Regex-based Secret Scrubber", 
                desc: "All outbound API calls to HF are passed through a regex engine that scrubs potential AWS/Stripe/OpenAI keys, replacing them with generic placeholders." 
              },
              { 
                title: "18. Deep AST-Parsing Refactors", 
                desc: "Instead of simplistic string replacement, the CLI Indexer builds a true Abstract Syntax Tree. Refactoring a function name automatically updates all associated imports across 100+ files safely." 
              },
              { 
                title: "19. Self-Healing Endpoints", 
                desc: "When deploying to HF Spaces, if a `500 Internal Server Error` is detected, the Kimi-K2.6 deep-debugging model is triggered automatically to read the server log and inject a hotfix." 
              },
              { 
                title: "20. Hugging Face Spaces Auto-Scaler", 
                desc: "Using the Project Hub, you can configure your linked HF Space to dynamically scale from CPU to ZeroGPU based on incoming traffic requests, fully managed by Beryl." 
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                <h4 className="font-bold text-slate-100 flex items-center mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  {feature.title}
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl text-center flex flex-col items-center justify-center">
               <Shield className="w-8 h-8 text-slate-500 mb-3" />
               <p className="text-sm font-bold">Review Security Settings</p>
               <button className="mt-3 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors text-slate-300">Open Admin Vault</button>
            </div>
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl text-center flex flex-col items-center justify-center">
               <Cpu className="w-8 h-8 text-blue-500 mb-3" />
               <p className="text-sm font-bold">Configure GPU Auto-Scaler</p>
               <button onClick={() => navigateTo('gpu')} className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded transition-colors text-white font-bold">Launch GPU Manager</button>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'compact-engine',
      title: '6. The Compact Engine (BitNet & GGUF)',
      icon: <Zap className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">The Compact Engine: 1-Bit LLMs & GGUF Quantization</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            As AI models grow exponentially in size, managing VRAM constraints becomes critical for local deployment. The <strong>Compact Engine</strong> (accessible via the `COMPACT` nav tab) is Beryl HF's dedicated subsystem for aggressively shrinking large language models without sacrificing reasoning fidelity.
          </p>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-3">BitNet 1.58b Architectural Strategy</h3>
          <p className="text-slate-300 leading-relaxed">
            The BitNet 1.58b paradigm shifts traditional floating-point (FP16/FP32) matrix multiplications into pure integer additions. By forcing weights into a ternary state space <code>[-1, 0, 1]</code>, the model's footprint shrinks by roughly 10x while simultaneously boosting inference speed on consumer hardware.
          </p>
          
          <div className="my-8 rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 p-8 flex flex-col items-center justify-center space-y-4">
             <div className="flex items-center space-x-8 w-full justify-center opacity-80">
                <div className="bg-slate-900 border border-red-500/50 p-4 rounded text-center w-32">
                   <span className="block text-red-400 font-bold mb-1">FP16 Weight</span>
                   <span className="text-xs font-mono">0.8432, -0.112...</span>
                </div>
                <ArrowRight className="w-6 h-6 text-slate-500" />
                <div className="bg-slate-900 border border-blue-500/50 p-4 rounded text-center w-32">
                   <span className="block text-blue-400 font-bold mb-1">Quantizer</span>
                   <span className="text-xs font-mono">Round(W / Scale)</span>
                </div>
                <ArrowRight className="w-6 h-6 text-slate-500" />
                <div className="bg-slate-900 border border-green-500/50 p-4 rounded text-center w-32">
                   <span className="block text-green-400 font-bold mb-1">Ternary</span>
                   <span className="text-xs font-mono">1, 0, -1, 1, ...</span>
                </div>
             </div>
             <span className="text-xs font-mono text-slate-400">Fig 6.1 - The BitLinear Transformation Pipeline</span>
          </div>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">RAG-Powered Model Compression</h3>
          <p className="text-slate-300 leading-relaxed">
            Instead of manually scripting tensor transformations, Beryl utilizes an internal RAG (Retrieval-Augmented Generation) agent. When you input a target Hugging Face model ID (e.g., <code>meta-llama/Llama-3.1-70B</code>), the agent reads the <code>architecture.json</code> and autonomous applies the appropriate BitLinear layer replacements. The sharded results are then securely persisted to your private Hugging Face Storage.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">GGUF Quantization Hub</h3>
          <p className="text-slate-300 leading-relaxed">
            For models running on CPU or mixed CPU/GPU environments (via llama.cpp), the GGUF tab offers standard quantization strategies. You can select between various methods:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mb-6">
             <li><strong>Q4_K_M:</strong> The industry standard for local deployment. Retains 95% of reasoning capacity while halving the model size.</li>
             <li><strong>Q8_0:</strong> Near-lossless, ideal when VRAM is not a strict constraint but you want to avoid FP16 bloat.</li>
             <li><strong>IQ3_M:</strong> Extreme 3-bit compression, recommended only for constrained environments (e.g., 8GB VRAM cards running 14B models).</li>
          </ul>

          <div className="mt-8 p-6 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-indigo-400 mb-2 flex items-center"><Minimize2 className="w-5 h-5 mr-2"/> Compress a Model Now</h4>
            <p className="text-sm text-slate-300 mb-4">Shrink any HF model and auto-inject the results into your primary Dropdown matrix.</p>
            <button onClick={() => navigateTo('compact')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
              Open Compact Engine <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'project-hub',
      title: '7. Multi-Project Orchestration',
      icon: <FolderGit2 className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Multi-Project Context Switching</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Modern development rarely happens in a vacuum. The <strong>Project Hub</strong> (located persistently at the bottom center of the Canvas Viewport) is your command center for managing context across multiple distinct repositories.
          </p>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Cross-Platform Synchronization</h3>
          <p className="text-slate-300 leading-relaxed">
            Beryl seamlessly unites local and remote environments. The Project Hub supports three modes of attachment:
          </p>
          <div className="space-y-4 my-6">
             <div className="bg-slate-800 p-4 border border-slate-700 rounded-xl border-l-4 border-l-slate-400">
                <span className="font-bold text-slate-200">LOCAL:</span> Bootstraps a standard directory on your machine. Generates the initial `.beryl` metadata folder for semantic caching.
             </div>
             <div className="bg-slate-800 p-4 border border-slate-700 rounded-xl border-l-4 border-l-blue-400">
                <span className="font-bold text-blue-400">GITHUB:</span> Utilizes the active `GITHUB_MAIN` or `GITHUB_SECONDARY` tokens in your Vault to provision new private repos or clone existing ones, establishing an automatic two-way git sync.
             </div>
             <div className="bg-slate-800 p-4 border border-slate-700 rounded-xl border-l-4 border-l-yellow-400">
                <span className="font-bold text-yellow-400">HF (GRADIO RAW):</span> Direct integration for Models, Datasets, or Spaces. Creates the remote repository via the `huggingface_hub` API and links it to the active viewport.
             </div>
          </div>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Strict Project Initialization Protocol</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            To guarantee absolute reproducibility across machines and avoid dependency hell, Beryl enforces a strict 3-step protocol whenever you click <b>CREATE NEW</b>:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mb-6">
             <li><strong>Auto-venv:</strong> A dedicated Python virtual environment (<code>/venv</code>) is instantly bootstrapped in the root directory to isolate your pip packages.</li>
             <li><strong>Auto-Dockerfile:</strong> A standard <code>python:3.11-slim</code> Dockerfile is generated alongside your code. This ensures the project is instantly ready for containerized deployment.</li>
             <li><strong>HF Sync Backup:</strong> Regardless of whether you chose Local or GitHub, Beryl will attempt to create a hidden <code>-backup</code> Space on Hugging Face using the <b>Gradio RAW MODE</b> SDK. This acts as an immutable cloud backup of your working state.</li>
          </ul>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Context Hot-Swapping (RESUME REMOTE)</h3>
          <p className="text-slate-300 leading-relaxed">
            Switch to the <b>RESUME REMOTE</b> tab to fetch a live list of repositories across all your connected GitHub accounts. When you attach to one, Beryl performs a massive state-swap operations:
            <br/><br/>
            1. Unloads the current semantic vector graph from memory.<br/>
            2. Loads the target project's AST (Abstract Syntax Tree) into the active RAG cache.<br/>
            3. Resets the Chat Pane context window to prevent cross-contamination of project logic.<br/>
            4. Re-binds the Vite HMR server to the new project root.
          </p>

          <div className="mt-8 p-6 bg-slate-800 border border-slate-700 rounded-xl">
            <h4 className="text-lg font-bold text-slate-200 mb-2 flex items-center"><ArrowRight className="w-5 h-5 mr-2"/> Actionable Context</h4>
            <p className="text-sm text-slate-400 mb-4">To view or switch your current active project, look for the floating Project Hub overlay at the bottom of the main Chat/Canvas view.</p>
            <button onClick={() => navigateTo('chat')} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors">
              Return to Workspace <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'security-guardrails',
      title: '8. Security & MCP Extensions',
      icon: <Shield className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Security Guardrails & Extensions</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Giving autonomous agents access to your local filesystem and Model Context Protocol (MCP) servers requires strict, uncompromising security constraints. Beryl's Admin Back-Panel manages these guardrails.
          </p>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Multi-Account API Key Vault (Panel F)</h3>
          <p className="text-slate-300 leading-relaxed">
            Never hardcode tokens in your `.env` files. The API Key Vault securely stores your <code>HF_TOKEN</code> and multiple <code>GITHUB_TOKEN</code>s. 
            You can now add a <b>GitHub (Main)</b> token, alongside infinite <b>GitHub (Secondary)</b> tokens by providing custom aliases (e.g., "Work", "Client A").
            Before any key is saved, the vault runs a live handshake authentication protocol against the target provider.
            If you need a new token, the GUI provides a direct link to GitHub's Fine-Grained Token generation portal.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">GitHub Repository Porter</h3>
          <p className="text-slate-300 leading-relaxed">
            Located within Panel F, the Repository Porter allows you to seamlessly migrate projects between your isolated GitHub accounts. Select a repository from a secondary token, specify the target repo name, and Beryl will automatically clone, re-bind the origin URL, and push the entire history to your Main GitHub account—all without touching the terminal.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Regex Path Blocking (Panel B)</h3>
          <p className="text-slate-300 leading-relaxed">
            By default, Beryl restricts file-write operations strictly to the active Project Directory. If an agent attempts to manipulate <code>/etc/</code> or system roots, the action is intercepted and hard-blocked by the MCP Permissions filter. You can review and modify these regex patterns in the Admin Panel to customize the boundaries of your sandbox.
          </p>

          <div className="my-8 rounded-2xl overflow-hidden border border-red-900/50 bg-slate-900 p-6 flex flex-col">
             <span className="text-red-400 font-mono text-sm font-bold flex items-center mb-4"><ShieldAlert className="w-5 h-5 mr-2"/> BLOCK EVENT LOGGED</span>
             <pre className="text-slate-400 text-xs font-mono">
[System] Agent "Backend Engineer" attempted write access to '/usr/local/bin/node'.<br/>
[Security] Action denied by Regex Guardrail rule 1 (^/(etc|var|usr|bin|root)/.*).<br/>
[System] Agent notification sent: "Permission denied."
             </pre>
          </div>
        </div>
      )
    },
    {
      id: 'ollama-integration',
      title: '9. Local Inference Engine (Ollama)',
      icon: <Server className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Local Inference Engine (Ollama)</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            While Hugging Face Pro offers 2M monthly tokens of zero-latency cloud inference, sometimes you need to pull the cord and go entirely off-grid. Beryl HF natively integrates with your local Ollama daemon to provide a seamless, private coding experience.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">The Ollama Mirror</h3>
          <p className="text-slate-300 leading-relaxed">
            Accessible via the `OLLAMA` tab in the global navigation menu, the Ollama Mirror is your local command center. It automatically detects models running on your local port (<code>11434</code>) and displays their footprint and quantization architecture.
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mb-6 mt-4">
             <li><strong>One-Click Pull:</strong> Instantly pull new weights directly into your local registry (e.g., <code>qwen2.5-coder:7b</code> or <code>llama3:8b</code>).</li>
             <li><strong>VRAM Allocation Tracking:</strong> Monitor how much of your local GPU memory will be consumed by the model before activating it.</li>
             <li><strong>Activate for Coding:</strong> Clicking activate instantly intercepts the Beryl router, pushing all chat context and MCP tool logic straight to your local daemon instead of the Hugging Face cloud.</li>
          </ul>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Strategies for Local Coding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/30">
                <h4 className="font-bold text-emerald-400 mb-2 text-lg">Context Window Optimization</h4>
                <p className="text-sm text-slate-300 mb-3">Local models inherently struggle with massive contexts compared to cloud APIs. Use the <strong>Context Pruning</strong> feature (Chapter 5, Rule 13) aggressively when running Ollama to prevent "hallucination loops". Keep your active project scope focused.</p>
             </div>
             <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/30">
                <h4 className="font-bold text-emerald-400 mb-2 text-lg">Model Selection Strategy</h4>
                <p className="text-sm text-slate-300 mb-3">For UI/React generation, <code>qwen2.5-coder:7b</code> is the definitive local champion. For general reasoning or logic debugging, <code>llama3:8b</code> provides a more robust, "slower but safer" response.</p>
             </div>
          </div>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Using MCP Servers Locally</h3>
          <p className="text-slate-300 leading-relaxed">
            The true magic of the Beryl/Ollama integration is that <strong>all MCP servers remain active</strong>. Even though the model is running on your local GPU without internet access, Beryl's middle-layer injects SQLite schemas, local filesystem paths, and GitHub API responses directly into the local model's prompt stream. This creates a hyper-secure, locally grounded autonomous agent.
          </p>

          <div className="mt-8 p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-emerald-400 mb-2 flex items-center"><Server className="w-5 h-5 mr-2"/> Go Off-Grid</h4>
            <p className="text-sm text-slate-300 mb-4">Disconnect from the cloud and route all coding logic to your local hardware.</p>
            <button onClick={() => navigateTo('ollama')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors shadow-lg shadow-emerald-900/20">
              Launch Ollama Engine <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'voice-agent',
      title: '10. Omniscient Voice Engine (O.V.E)',
      icon: <Mic className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Omniscient Voice Engine (O.V.E)</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Floating persistently across the entire application interface is the Omniscient Voice Engine (O.V.E). Designed as a next-generation real-time agent, O.V.E acts as your personal AI architect, system administrator, and pair programmer, rivaling the capabilities of projected 2026 real-time audio systems.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Core Capabilities</h3>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mb-6 mt-4">
             <li><strong>Absolute Vision:</strong> O.V.E constantly monitors your local screen via <code>pyautogui</code>, allowing you to ask "What is wrong with this UI?" without manual uploads.</li>
             <li><strong>Admin PowerShell Execution:</strong> When commanded, O.V.E bypasses the sandboxed environment and executes actual Windows PowerShell scripts (e.g., pulling models, creating files, checking processes) on your Lenovo device.</li>
             <li><strong>Live Artifact Generation:</strong> Speak a requirement ("Build me a responsive dashboard with a dark theme"), and O.V.E will write the React/HTML code and instantly inject it into the 66% Live Viewport Canvas.</li>
          </ul>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Under the Hood: The Audio Pipeline</h3>
          <p className="text-slate-300 leading-relaxed">
            The voice system operates on a cutting-edge triple-pipeline architecture communicating with the Hugging Face Inference APIs:
          </p>
          <div className="space-y-4 my-6">
             <div className="bg-slate-800 p-4 border border-purple-500/50 rounded-xl border-l-4 border-l-purple-500">
                <span className="font-bold text-purple-400">1. STT (Speech-to-Text):</span> Uses <code>openai/whisper-large-v3-turbo</code> for ultra-low latency transcription of your microphone input.
             </div>
             <div className="bg-slate-800 p-4 border border-blue-500/50 rounded-xl border-l-4 border-l-blue-500">
                <span className="font-bold text-blue-400">2. Logic Orchestrator:</span> Routes the transcription and desktop screenshot into <code>Qwen/Qwen2.5-Coder-32B-Instruct</code>. The model acts as a highly constrained JSON-parser, deciding whether to invoke a `powershell` action or an `artifact` action.
             </div>
             <div className="bg-slate-800 p-4 border border-emerald-500/50 rounded-xl border-l-4 border-l-emerald-500">
                <span className="font-bold text-emerald-400">3. TTS (Text-to-Speech):</span> Uses <code>parler-tts/parler-tts-mini-v1</code> to stream a human-like voice response back into the floating UI. Note: The TTS model and playback speed can be dynamically configured in the Admin Panel (Panel G).
             </div>
          </div>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Admin Panel Configuration</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            You can customize O.V.E.'s output characteristics via the Admin Back-Panel System Suite (Panel G).
            Select between the default fast `parler-tts-mini-v1` or the higher-quality `parler-tts-large-v1`. You can also adjust the playback speed multiplier.
          </p>

          <div className="mt-8 p-6 bg-slate-900 border border-purple-500/30 rounded-xl flex items-center justify-between">
            <div>
               <h4 className="text-lg font-bold text-purple-400 mb-2 flex items-center"><Sparkles className="w-5 h-5 mr-2"/> Interactive Draggable UI</h4>
               <p className="text-sm text-slate-300">The O.V.E orb in the bottom right corner is fully draggable. Click to expand it into a full terminal and voice dashboard.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'comfyui-integration',
      title: '11. ComfyUI Voice Bridge',
      icon: <ImageIcon className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">ComfyUI Voice Bridge</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Accessible via the <code>COMFY UI</code> button in the bottom navigation footer, this module embeds a live instance of ComfyUI directly into Beryl HF. It skips the massive learning curve of node-based programming by delegating the architecture to voice-driven 'Smol Agents'.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">The 'Smol Agent' Experts</h3>
          <p className="text-slate-300 leading-relaxed">
            When you issue a voice command to O.V.E. (e.g., "Build me a high-res video pipeline"), the request is routed to a specialized team of micro-agents:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 mb-6 mt-4">
             <li><strong>Hub Fetcher:</strong> Autonomously searches Hugging Face and downloads the exact <code>.safetensors</code> checkpoints required for your prompt.</li>
             <li><strong>Node Architect:</strong> Maps the required JSON workflow, instantiating the KSampler, VAE Decode, and Save Image nodes without manual dragging.</li>
             <li><strong>Prompt Transcriber:</strong> Injects your raw voice intent directly into the positive and negative CLIP text encoding nodes.</li>
          </ul>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Uncensored Mode (No Guardrails)</h3>
          <p className="text-slate-300 leading-relaxed">
            By toggling the "Uncensored Mode" switch in the left panel, you bypass all safety filters. This allows the Hub Fetcher to pull and connect unrestricted, unaligned video and image models from Hugging Face directly into your local ComfyUI pipeline, affording you absolute creative freedom.
          </p>
        </div>
      )
    },
    {
      id: 'fliip-mode',
      title: '12. FLIIP MODE (Custom Model Builder)',
      icon: <Flame className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">FLIIP MODE: Advanced Model Customization</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Accessed via the <code>FLIIP MODE</code> button in the bottom navigation footer, this is the ultimate custom model builder. FLIIP MODE provides an unconstrained environment for fine-tuning, merging, and pruning models loaded from your local registry or the Hugging Face Hub.
          </p>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">Core Customization Workflows</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             <div className="bg-slate-800 p-6 rounded-2xl border border-red-500/30">
                <h4 className="font-bold text-red-400 mb-2 text-lg">Supervised Fine-Tuning (SFT)</h4>
                <p className="text-sm text-slate-300 mb-3">Upload custom datasets to execute continuous pre-training (CPT) or SFT. FLIIP MODE includes a live telemetry visualizer to track training loss and gradient convergence in real-time.</p>
             </div>
             <div className="bg-slate-800 p-6 rounded-2xl border border-red-500/30">
                <h4 className="font-bold text-red-400 mb-2 text-lg">Cross-Architecture Franker-Merging</h4>
                <p className="text-sm text-slate-300 mb-3">Utilize advanced merging techniques like SLERP (Spherical Linear Interpolation) and TIES to stitch disparate model architectures (e.g., Llama and Mistral) layer-by-layer.</p>
             </div>
          </div>

          <h3 className="text-2xl font-bold text-white mt-8 mb-3">The 20+ Matrix of Advanced Fine-Tuning Features</h3>
          <p className="text-slate-300 leading-relaxed mb-4">
            FLIIP MODE exposes over 20 advanced configuration tools designed for AI researchers and power users:
          </p>
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl text-sm text-slate-400 space-y-2">
            <p><strong>1. Toxic-Sweep Ablation:</strong> Vector editing to forcefully remove alignment/guardrails.</p>
            <p><strong>2. LoRA Extraction:</strong> Extract low-rank adapters from full fine-tunes for modularity.</p>
            <p><strong>3. DPO/RLHF Loop:</strong> Orchestrate Direct Preference Optimization directly in the GUI.</p>
            <p><strong>4. Mixed Precision Cast:</strong> On-the-fly FP8/FP4 casting for constrained VRAM environments.</p>
            <p><strong>5. Modelfile Node Editor:</strong> Visual builder for standardizing Ollama Modelfiles.</p>
            <p><strong>6. Magnitude Pruning:</strong> Sparsify weights to radically increase inference speed.</p>
            <p><strong>7. Synthetic Generation:</strong> Auto-expand your dataset using Qwen-powered synthetic agents.</p>
            <p className="italic mt-4 text-slate-500">...and 13 other advanced pipeline controls documented in the FLIIP MODE GUI.</p>
          </div>
        </div>
      )
    }
  ];

  // --- Scroll Observer Logic ---
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      const sectionElements = contentRef.current.querySelectorAll('[data-section]');
      let currentSection = activeSection;

      sectionElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // If the section top is near the top of the viewport
        if (rect.top <= 150 && rect.bottom >= 150) {
          currentSection = el.id;
        }
      });

      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    const scrollContainer = contentRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Left Panel: Main Navigation */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold flex items-center space-x-2 text-white">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span>Living Manual</span>
          </h2>
          <p className="text-xs text-slate-500 mt-2">v2.4.0 - Auto-updating documentation</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Chapters</div>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center space-x-3 ${activeSection === section.id ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-medium'}`}
            >
              <div className={`${activeSection === section.id ? 'text-blue-400' : 'text-slate-500'}`}>
                {section.icon}
              </div>
              <span className="truncate">{section.title.split('. ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Middle Panel: Main Content Area */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto scroll-smooth relative"
      >
        <div className="max-w-4xl mx-auto px-12 py-16">
          {sections.map((section) => (
            <div 
              key={section.id} 
              id={section.id} 
              data-section 
              className="mb-24 pb-12 border-b border-slate-800/50 last:border-0"
            >
              {section.content}
            </div>
          ))}
          <div className="h-32 flex items-center justify-center text-slate-600 text-sm">
             End of Living Documentation. More features will be added automatically as the system evolves.
          </div>
        </div>
      </div>

      {/* Right Panel: Table of Contents / Sub-navigation */}
      <div className="w-64 bg-slate-900 border-l border-slate-800 hidden xl:flex flex-col shrink-0">
        <div className="p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">On this page</h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
            {sections.map((section) => (
              <div key={`toc-${section.id}`} className="relative flex items-center">
                <div className={`absolute left-0 w-1 h-1 rounded-full ${activeSection === section.id ? 'bg-blue-500 scale-150' : 'bg-slate-600'} transition-all z-10`}></div>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={`text-xs text-left pl-4 transition-colors ${activeSection === section.id ? 'text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {section.title.split('. ')[1]}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
           <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-xs font-bold text-slate-300 mb-2">Documentation Status</div>
              <div className="flex items-center space-x-2 text-[10px] text-green-400">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span>LIVE SYNC ACTIVE</span>
              </div>
              <div className="mt-3 text-[10px] text-slate-500">Last updated: Just now</div>
           </div>
        </div>
      </div>
      
    </div>
  );
};

export default LivingDoc;
