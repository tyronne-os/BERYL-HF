// ── Shared types for KREWE Assembly Line system ──────────────────────────────

export type PersonaCategory =
  | 'news' | 'finance' | 'health' | 'education'
  | 'entertainment' | 'tech' | 'retail' | 'government'
  | 'sports' | 'lifestyle';

export type QualityGrade = 'A' | 'B' | 'C';

export type VoiceProfile =
  | 'authoritative' | 'warm' | 'crisp' | 'energetic' | 'calm' | 'deep';

export type SquadTemplate =
  | 'avatar' | 'news_anchor' | 'financial' | 'health_coach' | 'educator';

// A persona brief is the "spec sheet" for one human to produce
export interface PersonaBrief {
  id: string;               // uuid assigned at enqueue
  name: string;             // "Sarah Chen — Breaking News Anchor"
  use_case: string;         // "Delivering live breaking news with authority"
  category: PersonaCategory;
  persona_tags: string[];   // semantic tags for gallery search
  appearance: string;       // uniform key (gala, executive, scrubs, …)
  voice_profile: VoiceProfile;
  squad_template: SquadTemplate;
  goal_prompt: string;      // the SQUAD UP goal fed to the pipeline
  priority: number;         // 0-10 (10 = first to run)
  family?: string;          // optional campaign/family group
}

// Quality scoring result
export interface QualityResult {
  score: number;            // 0-100
  grade: QualityGrade;
  certified: boolean;       // grade A = true
  issues: string[];
  standards: Record<string, boolean>; // each standard → pass/fail
}

// Full assembly entry stored in gallery
export interface AssemblyEntry {
  id: string;
  created_at: string;

  // From persona brief
  name: string;
  use_case: string;
  category: PersonaCategory;
  persona_tags: string[];
  voice_profile: VoiceProfile;
  squad_template: SquadTemplate;
  prompt: string;           // = goal_prompt
  face_uniform: string;
  priority: number;
  family?: string;

  // Pipeline results
  squad: Array<{
    name: string; role: string; uniform: string;
    model: string; status: string; latencyMs?: number; output?: string;
  }>;
  avatar_output: string;
  health: { total: number; done: number; failed: number };
  total_latency_ms: number;
  avg_latency_ms: number;

  // Quality
  quality_score: number;
  quality_grade: QualityGrade;
  certified: boolean;
  quality_issues: string[];
  quality_standards: Record<string, boolean>;

  // Identity & versioning
  persona_dna: string;      // hash of goal+template+appearance
  version: number;          // 1, 2, 3 … per persona_dna

  // Agent-generated
  report: string;
  auto_tags: string[];      // Gemma-generated semantic tags (merged into persona_tags)

  // Assembly metadata
  assembly_run_id?: string;
}

// Live assembly stats
export interface AssemblyStats {
  queued: number;
  running: number;
  done: number;
  failed: number;
  success_rate: number;     // percentage
  avg_latency_ms: number;
  throughput_per_hour: number;
  certified_count: number;
}

// SSE event types from backend
export type AssemblyEvent =
  | { status: 'starting'; name: string; index: number; total: number }
  | { status: 'done'; entry: AssemblyEntry; index: number; total: number }
  | { status: 'failed'; name: string; error: string; index: number; total: number }
  | { status: 'complete'; summary: { total: number; done: number; failed: number; certified: number; avg_quality: number } };
