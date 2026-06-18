# BERYL Human Assembly Line — 25-Feature Automation Plan

> **Goal:** Industrial-scale production of live talking avatar personas at Tavus-level quality.  
> Mass-produce hundreds of unique human personas, auto-populate the gallery, auto-generate reports,  
> and enforce quality standards via automated certification.

---

## Quality Standards (Tavus-Level + Above)

Tavus benchmarks we are matching and exceeding:

| Standard | Tavus Target | BERYL Target |
|----------|-------------|-------------|
| Lip-sync accuracy | >95% phoneme match | Native SVG viseme + TTS pipeline |
| Persona consistency | Same identity across turns | DNA hash + versioning system |
| Response latency | <2s per turn | <10s full 4-doll pipeline |
| Output quality | Human-like, in-character | 10-point quality gate + A/B/C grade |
| Scale | On-demand per request | Batch assembly line (hundreds/session) |
| Reporting | Basic session logs | Gemma-generated structured report per persona |
| Indexing | None | Tag index + DNA + category + family grouping |

---

## 10-Point Quality Gate

Each persona is scored 10 points per standard (max 100):

| # | Standard Key | Description |
|---|-------------|-------------|
| 1 | `all_green` | All pipeline dolls pass (100% health) |
| 2 | `output_length` | Avatar output ≥ 15 words |
| 3 | `in_character` | Output is non-empty and substantive (>30 chars) |
| 4 | `latency_ok` | Total pipeline latency < 10,000ms |
| 5 | `no_errors` | Zero pipeline exceptions or doll failures |
| 6 | `tone_match` | Output vocabulary matches stated category |
| 7 | `strong_hook` | Opening does not start with weak "I am / Hello I'm" |
| 8 | `spoken_natural` | No essay markers (firstly, in conclusion, etc.) |
| 9 | `narrative_arc` | Multiple sentences with natural punctuation |
| 10 | `on_brand` | First-person voice consistent throughout |

**Grades:**
- 🏆 **A (85-100)** = CERTIFIED — enters the gallery as production-ready
- ✓ **B (65-84)** = APPROVED — gallery entry, flagged for optional improvement
- △ **C (<65)** = REVIEW — auto-retry attempted once; if still C, logged for manual review

---

## 25 Automation Features

### Tier 1 — Core Pipeline (Implemented ✅)

**Feature 1 — PersonaBrief Schema**
Structured persona definition: name, use_case, category, tags, appearance, voice_profile, squad_template, goal_prompt, priority, family. The "spec sheet" for one human.

**Feature 2 — Priority Queue**
Personas sorted by priority (0-10) before assembly runs. High-priority personas execute first. Implemented in frontend queue sort + backend order preservation.

**Feature 3 — Backend Pipeline Runner**
Server-side SQUAD UP: backend executes the 4-doll pipeline (Director → Scriptwriter → QA → Talent) without any frontend coordination. Fire and forget from the browser.

**Feature 4 — Quality Gate (A/B/C)**
Automated 10-criteria scoring (0-100pts). Grade assigned post-run. Drives certified badge and retry logic.

**Feature 5 — Green Light Certification**
Grade A = 🏆 CERTIFIED badge. Certified personas are highlighted in the gallery as production-ready. Only certified personas are considered for client delivery.

**Feature 6 — Auto-Tag Generator**
Gemma LLM generates 6 semantic tags per persona from: name, use_case, category, output text, existing tags. Merged with manual tags for full search coverage.

**Feature 7 — Persona DNA Hash**
SHA-256 of (goal_prompt + squad_template + appearance). Uniquely identifies a persona's "genetic makeup" for dedup and versioning.

**Feature 8 — Persona Versioning**
Same DNA re-run = version increments (v1 → v2 → v3). Track quality improvement across iterations of the same persona brief.

**Feature 9 — Auto-Retry Engine**
Grade C triggers one automatic re-run of the avatar/talent doll at lower temperature (0.5 vs 0.72). If retry produces ≥15 words, quality is re-scored. Upgrades some C → B.

**Feature 10 — Configurable Parallel Execution**
`parallel` field on `POST /krewe/assembly/run`. Default=1 (sequential for stability). Future: set to 3-5 for concurrent asyncio pipeline execution.

---

### Tier 2 — Content & Identity (Implemented ✅)

**Feature 11 — 5 Squad Templates**
Tuned 4-doll pipelines per content type: `avatar` (general), `news_anchor`, `financial`, `health_coach`, `educator`. Each has category-specific system prompts at every stage.

**Feature 12 — 30-Persona Starter Library**
Pre-built persona briefs across 8 categories (news, finance, health, education, entertainment, tech, retail, lifestyle). Load all 30 with one click to seed the gallery instantly.

**Feature 13 — Voice Profile System**
6 voice profiles: authoritative, warm, crisp, energetic, calm, deep. Mapped to persona brief and surfaced in gallery cards for filtering and indexing.

**Feature 14 — Category Index**
10 categories: news, finance, health, education, entertainment, tech, retail, government, sports, lifestyle. Used for filtering, tone-match quality scoring, and gallery organization.

**Feature 15 — SSE Assembly Stream**
Real-time `text/event-stream` from backend: `starting → done|failed → complete`. Frontend reads via `fetch` streaming, updates gallery card by card as each persona completes.

---

### Tier 3 — Gallery & Discovery (Implemented ✅)

**Feature 16 — Assembly Dashboard Stats**
Live stats panel: Queue depth | Running | Done | Failed | Success Rate % | Avg Latency | Throughput/hr | Certified Count. Updates in real time from SSE stream.

**Feature 17 — Gallery Search**
Full-text search across name, use_case, prompt, and tags. Filters: category, quality grade, specific tag. All client-side for instant response.

**Feature 18 — Gallery Sort**
4 sort modes: Newest (default), Best Grade (A→B→C), Fastest (lowest latency), Category (alphabetical).

**Feature 19 — Rich Persona Cards**
Each gallery card: name, use case, grade badge, quality score bar, avatar output quote (3 lines), pipeline health indicator, category/voice chips, tag list (expandable), DNA hash, date.

**Feature 20 — Report with Standards Checklist**
Gemma report includes: Overview, Pipeline Health, Output Assessment, Recommendations. Full squad breakdown with per-doll model + latency + status in the ReportOverlay.

---

### Tier 4 — Production Operations (Implemented ✅)

**Feature 21 — Export Pack**
"Export" button in gallery downloads all visible persona entries as a JSON file (`beryl-gallery-{timestamp}.json`). Use to archive, migrate, or share persona rosters.

**Feature 22 — Bulk Import**
Paste a JSON array of PersonaBrief objects into the import panel. Validates and adds all to the assembly queue in one operation.

**Feature 23 — Model Performance Leaderboard**
`GET /krewe/gallery/leaderboard` tracks every model×role combination across all saved runs. Returns A-grade rate %, run count, and avg latency. Identifies your best-performing engines.

**Feature 24 — Production Session Summary**
On assembly complete, SSE sends a `complete` event with: total personas produced, done/failed counts, certified count, and average quality score. Shown in run log.

**Feature 25 — Persona Family Groups**
Optional `family` field on PersonaBrief groups related personas: "Morning News Team", "Medical Advisory Board", "VC Portfolio Companies". The starter library uses families (e.g., "Finance Desk", "Wellness Channel"). Future: filter gallery by family.

---

## Architecture Diagram

```
USER
 │
 ├─ Define PersonaBriefs (form / bulk import / starter library)
 │
 ▼
KREWE ASSEMBLY TAB (frontend)
 │  priority-sorted queue
 │  [START ASSEMBLY] → POST /krewe/assembly/run (briefs[])
 │                          │
 │           ┌──────────────▼──────────────┐
 │           │   BACKEND PIPELINE RUNNER   │
 │           │   for each brief:           │
 │           │   Director → Scriptwriter   │
 │           │   → QA → Talent (avatar)    │
 │           │   + Quality Gate            │
 │           │   + Auto-Retry (if C)       │
 │           │   + Auto-Tag (Gemma)        │
 │           │   + Report (Gemma)          │
 │           │   + DNA hash + Versioning   │
 │           │   + Save to HF Dataset      │
 │           └──────────────┬──────────────┘
 │                          │  SSE stream
 │     starting → done → complete events
 │
 ▼
GALLERY (frontend)
 ├─ Cards appear in real time as personas complete
 ├─ 🏆 Certified (A) / ✓ Approved (B) / △ Review (C)
 ├─ Search + Filter (name, category, grade, tags)
 ├─ Sort (newest / best grade / fastest / category)
 ├─ View Report (Gemma structured report + squad breakdown)
 └─ Export JSON pack

HF DATASET: AIBRUH/beryl-krewe-portfolio → squads.json
```

---

## Squad Template Detail

Each template runs 4 dolls in sequence. Context accumulates between stages.

```
Stage 1: Director/Orchestrator
  → Creative brief (tone, angle, key message)

Stage 2: Scriptwriter
  → 2-3 sentence spoken script (in-character, natural)

Stage 3: QA Director
  → Approve or improve script → OUTPUT ONLY the final script

Stage 4: Talent (Avatar)
  → First-person live delivery → OUTPUT ONLY the final spoken performance
```

The final Stage 4 output becomes `avatar_output` — the line the avatar speaks in THE VANITY.

---

## Persona Brief JSON Schema

```json
{
  "name": "Sarah Chen — Breaking News Anchor",
  "use_case": "Live breaking news delivery with urgency and authority",
  "category": "news",
  "persona_tags": ["news", "anchor", "authoritative", "female", "breaking", "live-tv"],
  "appearance": "executive",
  "voice_profile": "authoritative",
  "squad_template": "news_anchor",
  "goal_prompt": "You are Sarah Chen...",
  "priority": 9,
  "family": "Morning News Team"
}
```

---

## Roadmap (Next Phase)

- **Parallel execution** (parallel=3): Run 3 personas concurrently via `asyncio.gather`
- **Persona Families gallery filter**: Group and filter the gallery by family
- **Scheduled production runs**: Cron-style "run 50 personas at 2am"
- **Output similarity check**: Flag personas with >80% similar output (Gemma cosine proxy)
- **Voice synthesis integration**: Feed avatar_output to actual TTS engine (Kokoro, Piper)
- **Video generation**: Route certified personas to GPU doll for LatentSync clip
- **Thumbnail generation**: ComfyUI still from face SVG per persona card
- **Client delivery export**: Select certified personas → package HTML+JSON+report as ZIP
