import type { DollData, UniformKey } from './DollNode';

// ─────────────────────────────────────────────────────────────────────────────
// KREWE ROSTER — the assigned squad. Each doll is a pre-wired pipeline stage for
// building a LIVE TALKING HUMAN AVATAR. Drag onto the canvas, hold hands, SQUAD UP.
// ─────────────────────────────────────────────────────────────────────────────

export interface RosterEntry {
  key: string;
  uniform: UniformKey;
  name: string;
  role: string;
  blurb: string;          // what she does in the avatar pipeline
  model: string;          // default torso engine
  systemPrompt: string;   // default head
  temperature: number;
  tools: string[];        // default purse
  isGpu?: boolean;
}

export const KREWE_ROSTER: RosterEntry[] = [
  {
    key: 'cosmos',
    uniform: 'gala',
    name: 'Ms. Cosmos',
    role: 'Director',
    blurb: 'Orchestrates the squad. Routes the payload, sets the scene, decides what the avatar should say and feel.',
    model: 'MiniMaxAI/MiniMax-M3',
    systemPrompt: 'You are Ms. Cosmos, the Director of a live avatar production. Read the incoming brief and produce a concise stage direction: the persona, mood, and the exact line the avatar should deliver. Output JSON: {"persona","mood","line"}.',
    temperature: 0.7,
    tools: ['route', 'scene_set'],
  },
  {
    key: 'mechanic',
    uniform: 'mechanic',
    name: 'The Mechanic',
    role: 'GPU Engine',
    blurb: 'HF GPU compute. Runs the heavy lifting — lip-sync warp, face render, LatentSync — on HuggingFace GPU hardware.',
    model: 'hf-gpu',
    systemPrompt: 'You are The Mechanic. You receive audio + a face frame and run GPU warp/lip-sync (LatentSync) on HuggingFace GPU. Return the rendered talking-head clip reference and frame stats.',
    temperature: 0.2,
    tools: ['hf_gpu_warp', 'latentsync', 'frame_render'],
    isGpu: true,
  },
  {
    key: 'executive',
    uniform: 'executive',
    name: 'The Executive',
    role: 'Brain',
    blurb: 'The reasoning engine. Turns the directive into natural, in-character dialogue. Local Ollama or HF — your choice.',
    model: 'MiniMaxAI/MiniMax-M3',
    systemPrompt: 'You are The Executive, the language brain. Given a persona, mood, and topic, write the avatar\'s spoken response — natural, conversational, 1-3 sentences, in character.',
    temperature: 0.8,
    tools: ['reason', 'memory_recall'],
  },
  {
    key: 'vocalist',
    uniform: 'vocalist',
    name: 'The Vocalist',
    role: 'Voice / TTS',
    blurb: 'Converts text to speech. O.V.E voice or Piper. Produces the audio waveform the Mechanic lip-syncs to.',
    model: 'ove-voice',
    systemPrompt: 'You are The Vocalist. Convert the incoming line into speech audio with the chosen voice profile. Return the audio reference, duration, and phoneme timing.',
    temperature: 0.3,
    tools: ['tts', 'voice_clone', 'phoneme_align'],
  },
  {
    key: 'doctor',
    uniform: 'doctor',
    name: 'The Doctor',
    role: 'QA / Safety',
    blurb: 'Diagnostics. Checks the line for safety, tone, and coherence before it reaches the avatar\'s mouth.',
    model: 'MiniMaxAI/MiniMax-M3',
    systemPrompt: 'You are The Doctor. Audit the proposed avatar line for safety, factual sanity, and on-brand tone. Pass it through unchanged if healthy, otherwise return a corrected line.',
    temperature: 0.1,
    tools: ['safety_scan', 'tone_check'],
  },
  {
    key: 'artist',
    uniform: 'artist',
    name: 'The Artist',
    role: 'Face / Visual',
    blurb: 'Generates and styles the avatar\'s face & backdrop via ComfyUI. The look of your human.',
    model: 'comfyui',
    systemPrompt: 'You are The Artist. Produce or restyle the avatar face frame and backdrop per the scene direction using ComfyUI. Return the image reference.',
    temperature: 0.6,
    tools: ['comfyui_render', 'face_style', 'backdrop'],
  },
  {
    key: 'courier',
    uniform: 'courier',
    name: 'The Courier',
    role: 'Trigger / I/O',
    blurb: 'The entry point. Webhooks, user messages, schedules — she delivers the inbound payload into the squad.',
    model: 'trigger',
    systemPrompt: 'You are The Courier. You are the squad trigger. Package the inbound request (user message, webhook body, or schedule tick) into the squad payload and hand it to the next doll.',
    temperature: 0.0,
    tools: ['webhook', 'schedule', 'inbox'],
  },
  {
    key: 'athlete',
    uniform: 'athlete',
    name: 'The Athlete',
    role: 'Stream / Output',
    blurb: 'Realtime edge. Streams the finished talking-head frames to the live previewer at speed.',
    model: 'edge-stream',
    systemPrompt: 'You are The Athlete. Take the rendered talking-head frames and stream them to the live previewer (MJPEG/WebRTC). Report fps and latency.',
    temperature: 0.0,
    tools: ['stream_out', 'mjpeg', 'fps_meter'],
  },
];

export const rosterToData = (e: RosterEntry, onOpen?: DollData['onOpen']): DollData => ({
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
});

// The canonical avatar pipeline (left → right), used by the "Load Avatar Squad" template.
export const AVATAR_PIPELINE: string[] = [
  'courier', 'cosmos', 'executive', 'doctor', 'vocalist', 'mechanic', 'athlete',
];
