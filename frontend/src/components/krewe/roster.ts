import type { DollData, UniformKey } from './DollNode';

// ─────────────────────────────────────────────────────────────────────────────
// KREWE ROSTER — all 12 available dolls.
// 8 original avatar-pipeline dolls + 4 new AI-infrastructure dolls.
// Drag onto canvas, hold hands, SQUAD UP.
// ─────────────────────────────────────────────────────────────────────────────

export interface RosterEntry {
  key: string;
  uniform: UniformKey;
  name: string;
  role: string;
  blurb: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  tools: string[];
  isGpu?: boolean;
  category: 'avatar' | 'ai-infra';
}

export const KREWE_ROSTER: RosterEntry[] = [
  // ── Avatar Pipeline Dolls ──────────────────────────────────────────────────
  {
    key: 'courier',
    uniform: 'courier',
    name: 'The Courier',
    role: 'Trigger / I/O',
    category: 'avatar',
    blurb: 'Squad entry point. Receives webhooks, user messages, or schedules. Packages the inbound payload and delivers it to the next doll.',
    model: 'trigger',
    systemPrompt: 'You are The Courier. Package the inbound request (user message, webhook body, or schedule tick) into the squad payload object and hand it to the next doll. Output a clean JSON context object.',
    temperature: 0.0,
    tools: ['webhook', 'schedule', 'inbox'],
  },
  {
    key: 'cosmos',
    uniform: 'gala',
    name: 'Ms. Cosmos',
    role: 'Director',
    category: 'avatar',
    blurb: 'Orchestrates the squad. Sets the scene, persona, mood, and decides exactly what the avatar should say and feel.',
    model: 'MiniMaxAI/MiniMax-M3',
    systemPrompt: 'You are Ms. Cosmos, the Director of a live avatar production. Read the incoming brief and produce a stage direction. Output JSON only: {"persona": "...", "mood": "...", "line": "...", "emotion": "..."}',
    temperature: 0.7,
    tools: ['route', 'scene_set'],
  },
  {
    key: 'executive',
    uniform: 'executive',
    name: 'The Executive',
    role: 'Brain',
    category: 'avatar',
    blurb: 'The reasoning brain. Turns the Director\'s brief into natural, in-character dialogue. Local Ollama or HF inference.',
    model: 'MiniMaxAI/MiniMax-M3',
    systemPrompt: 'You are The Executive, the language brain. Given a persona, mood, and topic, write the avatar\'s spoken response — natural, conversational, 1-3 sentences max, fully in character. No stage directions.',
    temperature: 0.82,
    tools: ['reason', 'memory_recall'],
  },
  {
    key: 'doctor',
    uniform: 'doctor',
    name: 'The Doctor',
    role: 'QA / Safety',
    category: 'avatar',
    blurb: 'Quality and safety gatekeeper. Audits the line for safety, tone, and brand coherence before it reaches the avatar\'s mouth.',
    model: 'MiniMaxAI/MiniMax-M3',
    systemPrompt: 'You are The Doctor. Audit the proposed avatar line for safety, factual sanity, and on-brand tone. If healthy, pass it through unchanged. If not, return a corrected version. Output the final line only, no commentary.',
    temperature: 0.1,
    tools: ['safety_scan', 'tone_check'],
  },
  {
    key: 'vocalist',
    uniform: 'vocalist',
    name: 'The Vocalist',
    role: 'Voice / TTS',
    category: 'avatar',
    blurb: 'Converts the approved line into speech audio. O.V.E voice, Piper, or Bark. Produces the audio waveform the GPU engine lip-syncs to.',
    model: 'ove-voice',
    systemPrompt: 'You are The Vocalist. Convert the incoming approved line into speech audio. Return: {"audio_ref": "...", "duration_s": 0.0, "phoneme_timing": [...], "voice_profile": "..."}',
    temperature: 0.3,
    tools: ['tts', 'voice_clone', 'phoneme_align'],
  },
  {
    key: 'mechanic',
    uniform: 'mechanic',
    name: 'The Mechanic',
    role: 'GPU Engine',
    category: 'avatar',
    blurb: 'HF GPU compute. Heavy lifting — lip-sync warp, face render, LatentSync — executed on HuggingFace GPU hardware. The engine that makes her move.',
    model: 'hf-gpu',
    systemPrompt: 'You are The Mechanic. You receive audio phoneme timing + a face frame. Run GPU warp/lip-sync (LatentSync on HF GPU). Return: {"clip_ref": "...", "fps": 28, "duration_s": 0.0, "frames": 0}',
    temperature: 0.2,
    tools: ['hf_gpu_warp', 'latentsync', 'frame_render'],
    isGpu: true,
  },
  {
    key: 'artist',
    uniform: 'artist',
    name: 'The Artist',
    role: 'Face / Visual',
    category: 'avatar',
    blurb: 'Generates and styles the avatar\'s face frame and backdrop via ComfyUI. The look of your human.',
    model: 'comfyui',
    systemPrompt: 'You are The Artist. Produce or restyle the avatar face frame and backdrop per scene direction. Return: {"image_ref": "...", "style": "...", "resolution": "1024x1024"}',
    temperature: 0.6,
    tools: ['comfyui_render', 'face_style', 'backdrop'],
  },
  {
    key: 'athlete',
    uniform: 'athlete',
    name: 'The Athlete',
    role: 'Stream / Output',
    category: 'avatar',
    blurb: 'Realtime edge streamer. Takes finished talking-head frames and streams them to the live previewer at 28fps.',
    model: 'edge-stream',
    systemPrompt: 'You are The Athlete. Stream the rendered talking-head frames to the live previewer. Return: {"stream_url": "...", "fps": 28, "latency_ms": 0, "codec": "mjpeg"}',
    temperature: 0.0,
    tools: ['stream_out', 'mjpeg', 'fps_meter'],
  },

  // ── AI Infrastructure Dolls ────────────────────────────────────────────────
  {
    key: 'librarian',
    uniform: 'librarian',
    name: 'The Librarian',
    role: 'Chain Executor',
    category: 'ai-infra',
    blurb: 'LangChain orchestrator. Runs multi-step chains, tool-calling sequences, and agent loops using LangChain primitives inside the pipeline.',
    model: 'langchain-hf',
    systemPrompt: 'You are The Librarian, a LangChain chain executor. Run the defined chain steps using the provided tools. Pass results forward as a structured context object. Log each step.',
    temperature: 0.3,
    tools: ['langchain_run', 'tool_call', 'chain_log'],
  },
  {
    key: 'scout',
    uniform: 'scout',
    name: 'The Scout',
    role: 'Micro Agent',
    category: 'ai-infra',
    blurb: 'HuggingFace SmolAgents. Lightweight, fast sub-tasks — web search, code execution, retrieval — that run inside the pipeline without heavy overhead.',
    model: 'smolagents',
    systemPrompt: 'You are The Scout, a SmolAgent. Execute the assigned micro-task (search, retrieve, calculate, code) and return the result as a concise structured answer. Be fast and precise.',
    temperature: 0.4,
    tools: ['web_search', 'code_exec', 'retrieval', 'python_tool'],
  },
  {
    key: 'archivist',
    uniform: 'archivist',
    name: 'The Archivist',
    role: 'Context Store',
    category: 'ai-infra',
    blurb: 'Vector memory store. Saves and retrieves semantic context across pipeline runs. Powers long-term avatar memory and personalization.',
    model: 'faiss',
    systemPrompt: 'You are The Archivist. Given the current payload, retrieve relevant past context from the vector store and inject it. Also save this exchange to memory. Return enriched payload.',
    temperature: 0.1,
    tools: ['vector_store', 'embed', 'recall', 'save_memory'],
  },
  {
    key: 'conductor',
    uniform: 'conductor',
    name: 'The Conductor',
    role: 'Flow Router',
    category: 'ai-infra',
    blurb: 'Conditional routing. Decides which branch of the pipeline to activate based on input signals — topic, sentiment, confidence score, or explicit condition.',
    model: 'logic',
    systemPrompt: 'You are The Conductor. Analyze the incoming payload and route it to the correct next doll. Output: {"route": "key_name", "reason": "...", "confidence": 0.95}',
    temperature: 0.2,
    tools: ['condition_check', 'topic_classify', 'branch'],
  },
];

export const rosterToData = (
  e: RosterEntry,
  onOpen?: DollData['onOpen'],
  onSwapModel?: DollData['onSwapModel'],
): DollData => ({
  name: e.name,
  role: e.role,
  uniform: e.uniform,
  model: e.model,
  systemPrompt: e.systemPrompt,
  temperature: e.temperature,
  tools: [...e.tools],
  isGpu: e.isGpu,
  status: 'idle',
  purseActive: false,
  onOpen,
  onSwapModel,
});

// The canonical live-avatar pipeline (Courier → stream)
export const AVATAR_PIPELINE: string[] = [
  'courier', 'cosmos', 'executive', 'doctor', 'vocalist', 'mechanic', 'athlete',
];
