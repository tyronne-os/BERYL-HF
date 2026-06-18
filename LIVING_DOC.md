# BERYL HF — Living Documentation

> **Repo:** `tyronne-os/BERYL-HF` · **Stack:** Electron + Vite/React (frontend) · FastAPI (backend, port 8001) · HuggingFace Inference + Datasets  
> **Last updated:** 2026-06-18

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Running the App](#3-running-the-app)
4. [Navigation](#4-navigation)
5. [BERYL Builder (BERYL tab)](#5-beryl-builder-beryl-tab)
6. [HF Backend — Dataset-as-Database](#6-hf-backend--dataset-as-database)
7. [KREWE — Avatar Pipeline Builder](#7-krewe--avatar-pipeline-builder)
   - [7a. The Canvas & Doll System](#7a-the-canvas--doll-system)
   - [7b. SQUAD UP — Step-by-Step Pipeline Execution](#7b-squad-up--step-by-step-pipeline-execution)
   - [7c. Connectivity Pulse Test](#7c-connectivity-pulse-test)
   - [7d. Auto-Heal](#7d-auto-heal)
   - [7e. Foreman Chat](#7e-foreman-chat)
   - [7f. THE VANITY — Live Avatar Previewer](#7f-the-vanity--live-avatar-previewer)
   - [7g. Portfolio Gallery](#7g-portfolio-gallery)
   - [7h. Reporting Agent (Gemma)](#7h-reporting-agent-gemma)
   - [7i. Human Assembly Line](#7i-human-assembly-line)
   - [7j. Research Intelligence — Paper Scroller](#7j-research-intelligence--paper-scroller)
   - [7k. SQUAD IT — Paper-to-Pipeline](#7k-squad-it--paperto-pipeline)
8. [Doll Roster](#8-doll-roster)
   - [Master Squad — The Inner Circle](#master-squad--the-inner-circle)
9. [Backend API Reference](#9-backend-api-reference)
10. [Key Technical Decisions & Gotchas](#10-key-technical-decisions--gotchas)
11. [Security Rules](#11-security-rules)
12. [Changelog](#12-changelog)

---

## 1. Project Overview

BERYL HF is a **dual-panel Electron desktop app** for building, testing, and deploying AI-powered talking avatar pipelines on HuggingFace infrastructure. It has two main creative surfaces:

| Surface | What it does |
|---------|-------------|
| **BERYL Builder** | Autonomous AI builder — describe a project, BERYL generates all the files and deploys to a HF Static Space |
| **KREWE** | n8n-style canvas where fashion **dolls** represent AI pipeline nodes. Connect them hand-to-hand, hit SQUAD UP, watch a live talking avatar appear in **THE VANITY** |

Both surfaces share a common **HF Backend** that uses private HuggingFace Dataset repos as a Supabase-style JSON database.

**Mission:** Produce photorealistic talking humans that are **undetectable as AI-generated** — at industrial scale, at $0.003 per avatar, powered by $0.80 of GPU budget.

---

## 2. Architecture

```
BERYL-HF/
├── frontend/                   Vite + React + TypeScript + Tailwind
│   └── src/
│       ├── App.tsx             Top-level router (page state)
│       ├── api.ts              API base URL constant (port 8001)
│       └── components/
│           ├── BottomNav.tsx
│           ├── BerylBuilder.tsx
│           ├── CanvasPane.tsx
│           └── krewe/
│               ├── KrewePage.tsx       Main canvas orchestrator
│               ├── DollNode.tsx        Custom React Flow node (fashion doll SVG)
│               ├── FlowEdge.tsx        Custom animated edge with traveling particle
│               ├── TheVanity.tsx       Ornate picture-frame avatar previewer
│               ├── VanityGallery.tsx   Portfolio gallery strip + report overlay
│               ├── AssemblyLine.tsx    Human Assembly Line control panel (ASSEMBLY tab)
│               ├── GalleryView.tsx     Full-screen gallery overlay
│               ├── PaperBanner.tsx     Scrolling ArXiv research paper ticker
│               ├── PaperOverlay.tsx    Paper detail overlay + iframe + SQUAD IT
│               ├── roster.ts           Doll definitions + AVATAR_PIPELINE default
│               ├── types.ts            Shared types (PersonaBrief, AssemblyEntry, etc.)
│               └── persona_library.ts  30 pre-built persona briefs across 8 categories
└── backend/
    └── main.py                 FastAPI (uvicorn, port 8001)
```

**Frontend ↔ Backend:** All API calls hit `http://localhost:8001` (defined in `src/api.ts`). CORS is open for local dev.

**HuggingFace:** `InferenceClient` for LLM calls; `hf_hub_download` / `upload_file` for Dataset-as-DB. Token from `.env` → `HF_TOKEN`.

**Default LLM:** `MiniMaxAI/MiniMax-M3` (427B MoE, 1M context) via HF Inference Providers (`provider="auto"`).

---

## 3. Running the App

```bash
# Terminal 1 — Backend
cd BERYL-HF/backend
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload

# Terminal 2 — Frontend (dev)
cd BERYL-HF/frontend
npm run dev          # Vite dev server on port 5173

# Or production build
npm run build
npm run preview
```

**`.env` file** (backend root, never commit):
```
HF_TOKEN=hf_...
GITHUB_TOKEN=ghp_...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
```

---

## 4. Navigation

Bottom navigation bar (`BottomNav.tsx`) with gold active state:

| Button | Route | Description |
|--------|-------|-------------|
| BERYL | `chat` | Autonomous builder |
| HF | `hf` | HuggingFace dashboard |
| GPU | `gpu` | GPU A/B tester (Genie) |
| STUDIO | `studio` | Avatar studio |
| CLI | `cli` | CLI tools |
| DOCS | `docs` | Documentation |
| OLLAMA | `ollama` | Local model manager |
| COMFY | `comfy` | ComfyUI integration |
| KREWE | `krewe` | **Avatar pipeline builder** ← |

---

## 5. BERYL Builder (BERYL tab)

**File:** `frontend/src/components/BerylBuilder.tsx`

### CHAT mode
- Streaming conversation with MiniMax-M3
- Built-in HF Backend panel (init DB, create tables, CRUD)

### BUILD mode
- Single prompt → full multi-file project generation
- 8 built-in templates: Portfolio, SaaS Landing, Dashboard, E-Commerce, Blog, API Docs, Mobile App, Game
- Generated HTML auto-loads into `CanvasPane` iframe
- "Deploy to HF Space" → `POST /deploy-space`

---

## 6. HF Backend — Dataset-as-Database

Private HuggingFace Dataset repos used as JSON database. Each project → `AIBRUH/beryl-db-{project}`. Tables stored as `data/{table}.json`. Records get `id` (UUID) and `created_at` (ISO) auto-injected.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/hf-backend/init` | Create private dataset repo |
| `POST` | `/hf-backend/create-table` | Create empty JSON table |
| `GET` | `/hf-backend/tables?project=` | List tables + row counts |
| `GET` | `/hf-backend/rows?project=&table=` | Read all rows |
| `POST` | `/hf-backend/insert` | Insert record (auto UUID + timestamp) |
| `PUT` | `/hf-backend/update` | Update by id |
| `DELETE` | `/hf-backend/delete` | Delete by id |
| `POST` | `/deploy-space` | Push HTML to HF Static Space |

---

## 7. KREWE — Avatar Pipeline Builder

**Files:** `frontend/src/components/krewe/`

KREWE is an **n8n-style visual pipeline builder** where each node is a fashion doll. Connect dolls hand-to-hand. Hit **SQUAD UP** to execute the pipeline step-by-step, watching a photorealistic talking avatar appear in **THE VANITY**.

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ✦ RESEARCH INTEL ✦  [paper] [paper] [paper] ← scrolling ArXiv banner →    │
├─────────────────────┬──────────────────────────────────────────┬─────────────┤
│  LEFT RAIL (300px)  │  CENTER CANVAS (flex-1)                  │ RIGHT RAIL  │
│  ┌───────────────┐  │  ReactFlow canvas — DollNode + FlowEdge  │  (320px)    │
│  │FOREMAN|ROSTER │  │                                          │             │
│  │ASSEMBLY       │  │  TOP TOOLBAR:                            │  ┌────────┐ │
│  └───────────────┘  │  SQUAD UP · TEST · Avatar Squad          │  │  THE   │ │
│                     │  + Doll · Clear · GALLERY                │  │ VANITY │ │
│  Chat with Foreman  │  SAVE SQUAD UP (post-live)               │  │ frame  │ │
│  to design squad.   │                                          │  └────────┘ │
│  ROSTER: drag dolls │  Pipeline health orb                     │  ┌────────┐ │
│  ASSEMBLY: bulk run │                                          │  │GALLERY │ │
│                     │                                          │  │ STRIP  │ │
└─────────────────────┴──────────────────────────────────────────┴─────────────┘
```

---

### 7a. The Canvas & Doll System

**`DollNode.tsx`** — Custom React Flow node type `"doll"`:

- SVG fashion doll with body parts mapped to pipeline config:
  - **Head** → Persona & System Instructions
  - **Torso** → Model / Engine selection
  - **Purse** → Tools & Function Calling
- Click any body part → **Config Drawer** (slides in from right)
- **Neon glow status:**

| Status | Glow |
|--------|------|
| idle | none |
| running | gold pulse `#d4af37` |
| done | neon green `#00ff88` |
| error | neon red `#ff2244` |

- Model swap dropdown inside doll body — 5–8 options per role, no re-render
- Latency chip, error badge, output snippet on doll face after run

**`FlowEdge.tsx`** — Custom animated edge:
- Four statuses: `idle | flowing | done | error`
- **Traveling particle**: `<animateMotion>` + `<mpath href="#edgeId">` — gold dot rides the exact Bezier path natively in SVG

**`roster.ts`** — Doll definitions:
- `KREWE_ROSTER`: 13 dolls (see [§8 Doll Roster](#8-doll-roster))
- `AVATAR_PIPELINE`: default **Master Squad** 7-doll chain: `courier → cosmos → stylist → vocalist → mechanic → doctor → athlete`
- `rosterToData(entry, onOpen, onSwapModel)`: roster entry → `DollData`

---

### 7b. SQUAD UP — Step-by-Step Pipeline Execution

1. Topological sort of canvas DAG
2. For each doll in order:
   - Mark `running` (gold glow) + animate edges `flowing` (particle on)
   - `POST /krewe/step` with node config + accumulated context
   - `done`: mark green, edges green, append output to context
   - `error`: mark red, collect error
3. All green → avatar speaks in **THE VANITY** with the face matching the last visual doll's uniform
4. **SAVE SQUAD UP** button appears in toolbar after a successful live run

**`POST /krewe/step`** request:
```json
{
  "node": { "id", "name", "role", "uniform", "model", "system", "temperature", "tools", "isGpu" },
  "context": "accumulated pipeline context string",
  "goal": "the user's squad goal"
}
```
Response: `{ "status": "done"|"error", "output": "...", "latency_ms": 123, "error": null|"...", "model_used": "..." }`

---

### 7c. Connectivity Pulse Test

**TEST** button — pings every doll independently:
1. Sends each doll a `"respond with PONG"` task via `/krewe/step`
2. Green ✓ = reachable; Red ✗ = engine down
3. Reports in Foreman chat before a full run

---

### 7d. Auto-Heal

Purple **✨ Auto-Heal (N errors)** button after any failed run:
- `POST /krewe/adjust` with failed nodes + error messages
- LLM returns `{ swaps: [{nodeId, model}], note }` — better model suggestions
- Applies all swaps silently, prompts user to re-run

---

### 7e. Foreman Chat

Left rail, **FOREMAN** tab:
- **New design:** goal text → `POST /krewe/plan` → dolls placed on canvas with edges
- **Adjustment:** `"swap the Mechanic"` → `POST /krewe/adjust` → model swaps applied
- **SQUAD IT result**: when a research paper is squad-itified, Foreman receives a chat message explaining the squad that was placed

---

### 7f. THE VANITY — Live Avatar Previewer

**File:** `frontend/src/components/krewe/TheVanity.tsx`

Right rail top section. Ornate baroque picture frame containing the live talking avatar.

**Default face:** `executive` (Eve) — the production-ready anchor look.

#### Visual Design
- **Frame**: multi-layer gold gradient padding (`linear-gradient(135deg, #f5d76e → #9a6a08 → ...)`), multiple box-shadow layers
- **Title plaque**: `✦ THE VANITY ✦` in Georgia serif, overlapping top frame edge at `-14px`
- **Corner ornaments**: four baroque SVG fleur-de-lis at inner-canvas corners
- **Avatar face**: parametric SVG — skin/hair/dress/accent colors per uniform
- **Speaking aura**: concentric ellipses pulsing via SVG `<animateTransform>`

#### Avatar Animation
- `requestAnimationFrame` driving `mouthOpen` with layered sines for natural viseme motion
- `mouthOpen * 14` px mouth height; upper teeth appear when `mouthOpen > 0.4`

#### Two-Way Chat
- 💬 toggle → chat panel below the frame
- User types → `POST /krewe/vanity-chat` with message + avatar context + uniform
- Backend replies in-character (persona matched to uniform)
- Avatar animates speaking the reply

---

### 7g. Portfolio Gallery

**File:** `frontend/src/components/krewe/VanityGallery.tsx`

Right rail bottom section. Horizontal scroll strip of saved Squad Up runs.

#### Saving
- **SAVE** toolbar button → `POST /krewe/portfolio/save` → Gemma generates report → saves to `AIBRUH/beryl-krewe-portfolio`
- Optimistic localStorage cache for instant display

#### Portfolio Cards (150×108px)
- Face icon, auto-title, date, prompt excerpt, pipeline health bar, doll emoji lineup, **VIEW REPORT**

#### Report Overlay
Full panel overlay showing: avatar output, goal, Gemma markdown report, squad breakdown (name/role/model/status/latency).

#### Persistence
- Primary: `AIBRUH/beryl-krewe-portfolio` → `squads.json`
- Local cache: `localStorage['krewe-portfolio']`

---

### 7h. Reporting Agent (Gemma)

Auto-fires on every `POST /krewe/portfolio/save`.

**Sections:** Overview · Pipeline Health · Output Assessment · Recommendations  
**Model:** MiniMax-M3 at `temperature=0.3`. Fallback to static summary card if offline.

---

### 7i. Human Assembly Line

**Files:** `AssemblyLine.tsx`, `GalleryView.tsx`, `types.ts`, `persona_library.ts`

Industrial-scale persona mass-production system. Left rail **ASSEMBLY** tab.

#### 25-Feature System
- **Priority queue**: briefs sorted 0–10 before run
- **Backend pipeline runner**: server-side 4-doll SQUAD UP (Director → Scriptwriter → QA → Talent)
- **Quality gate A/B/C**: 10-point rubric (0–100 score); A=Certified, B=Approved, C=auto-retry
- **Auto-tag**: Gemma generates 6 semantic tags per persona
- **Persona DNA**: SHA-256 of (goal + template + appearance) — dedup + versioning
- **Auto-retry**: Grade C → re-run avatar doll at temperature 0.5
- **SSE stream**: `starting → done|failed → complete` events via `fetch` + `ReadableStream`
- **30 starter personas** across 8 categories loaded from `persona_library.ts`
- **5 squad templates**: avatar, news_anchor, financial, health_coach, educator, **master**

#### Assembly Line API
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/krewe/assembly/run` | SSE stream — run briefs in sequence |
| `GET` | `/krewe/assembly/status` | `{total, certified, grades}` |
| `POST` | `/krewe/gallery/search` | Full-text + filter + sort |
| `GET` | `/krewe/gallery/leaderboard` | Model × role A-rate ranking |

#### Gallery (Full-screen overlay)
Search/filter/sort · PersonaCards with grade badges, quality bar, DNA hash · Export JSON

---

### 7j. Research Intelligence — Paper Scroller

**File:** `frontend/src/components/krewe/PaperBanner.tsx`

A 42px scrolling ticker at the very top of the KREWE page — always visible.

#### Data Source
- `GET /krewe/papers` fetches from **ArXiv API** using 6 targeted search queries:
  - `ti:talking+head`, `ti:avatar+synthesis`, `ti:portrait+video`, `ti:lip+sync`, `ti:digital+human+generation`, `ti:face+animation+diffusion`
- Date filter: 2025-11-01 → today
- Results sorted newest-first, cached in memory for 6 hours
- Deduplication by `arxiv_id`

#### Banner Design
- Fixed left label: `✦ RESEARCH INTEL ✦` + refresh button
- Scrolling track: CSS `@keyframes krewe-banner-scroll` — pauses on hover
- Each card: color-coded tag pill (Talking Head/Diffusion/Lip Sync/Streaming/3D Avatar/Portrait/Avatar), truncated title, first author, date
- Error state with retry link; paper count in right corner

---

### 7k. SQUAD IT — Paper-to-Pipeline

**File:** `frontend/src/components/krewe/PaperOverlay.tsx`

Clicking any paper in the banner opens a full overlay:

#### Overlay Panels
- **Left (40%)**: title, authors, date, abstract, external links (HF Papers / ArXiv PDF / ArXiv Abstract)
- **Right (60%)**: `<iframe src="https://huggingface.co/papers/{arxiv_id}">` — live paper page with PDF link, GitHub, Spaces

#### SQUAD IT Button
1. User clicks **✦ SQUAD IT** (gold button, bottom of overlay)
2. Frontend calls `POST /krewe/papers/squad-it` with `{title, summary, arxiv_id}`
3. Backend LLM analyzes paper → designs 4–6 doll squad mapped to paper's pipeline stages
4. Returns `{dolls, edges, goal, note}`
5. Frontend calls `applyPlan(dolls, edges)` → canvas populated
6. Cosmos tab activated, Foreman receives a chat message: "📄 SQUAD IT applied! … Hit SQUAD UP to test the science."
7. Overlay closes

#### Backend SQUAD IT
`POST /krewe/papers/squad-it`:
- System prompt forces doll key names from the official roster (validated before return)
- Edge references validated against returned doll list
- Fallback squad if LLM output is unparseable

---

## 8. Doll Roster

13 dolls in two categories. Default canvas loads the **Master Squad** (7 dolls).

### 🎭 Avatar Dolls (9)

| Key | Name | Role | Uniform | Default Model |
|-----|------|------|---------|---------------|
| `courier` | The Courier | Trigger / I/O | courier | trigger |
| `cosmos` | Ms. Cosmos | Director | gala | MiniMaxAI/MiniMax-M3 |
| `executive` | The Executive | Brain | executive | MiniMaxAI/MiniMax-M3 |
| `doctor` | The Doctor | QA / Safety | doctor | MiniMaxAI/MiniMax-M3 |
| `vocalist` | The Vocalist | Voice / TTS | vocalist | hexgrad/Kokoro-82M |
| `mechanic` | The Mechanic | GPU Engine | mechanic | AIBRUH/latentsync |
| `artist` | The Artist | Face / Visual | artist | comfyui |
| `athlete` | The Athlete | Stream / Output | athlete | edge-stream |
| `stylist` | The Stylist | Text-to-Image | stylist | black-forest-labs/FLUX.1-schnell |

### 🤖 AI Infra Dolls (4)

| Key | Name | Role | Uniform | Default Model |
|-----|------|------|---------|---------------|
| `librarian` | The Librarian | Chain Executor | librarian | langchain-hf |
| `scout` | The Scout | Micro Agent | scout | smolagents |
| `archivist` | The Archivist | Context Store | archivist | faiss |
| `conductor` | The Conductor | Flow Router | conductor | logic |

---

### Master Squad — The Inner Circle

**The production-ready default.** Loads on canvas at startup. $0.003/run. ~13s cold.

Research basis: LatentSync CVPR 2025 · FLUX.1 ICML 2024 · StyleTTS2 NeurIPS 2023 · InstantID CVPR 2024

| # | Doll | Model | Latency | Cost | Why |
|---|------|-------|---------|------|-----|
| 1 | The Courier | trigger | 0ms | $0 | JSON context wrapper |
| 2 | Ms. Cosmos | MiniMax-M3 427B | 600ms | $0 | ≤15-word spoken_script lock; MoE free on HF |
| 3 | The Stylist | FLUX.1-schnell | 3–4s | $0.003 | 4-step flow-matching — best skin texture. Anti-plastic negatives baked in |
| 4 | The Vocalist | Kokoro-82M | 400ms | $0 | StyleTTS2 MOS 4.4 — natural prosody, CPU-only |
| 5 | The Mechanic | AIBRUH/latentsync | 6–10s | $0.0002 | Latent SyncNet loss — eliminates inter-frame jitter (top AI tell) |
| 6 | The Doctor | MiniMax-M3 427B | 400ms | $0 | 8-point naturalness gate — text-only, no GPU re-run |
| 7 | The Athlete | edge-stream | 0ms | $0 | MJPEG 25fps → THE VANITY |

**3 AI tells eliminated:**
1. Plastic skin → FLUX flow-matching + anti-airbrushing negatives
2. Lip-sync jitter → LatentSync latent-domain SyncNet loss
3. Robotic cadence → Kokoro-82M style diffusion prosody + 15-word cap

**Upgrade paths (codified in `/krewe/master-squad`):**

| Doll | Trigger | Upgrade to |
|------|---------|-----------|
| Stylist | Identity drift across runs | FLUX.1-dev + InstantID |
| Mechanic | Mouth shape errors >5% | Hallo2 / MuseTalk v2 |
| Vocalist | Need voice cloning from sample | F5-TTS / XTTS-v2 |
| Cosmos | Need sub-200ms direction | Qwen2.5-7B local ollama |

---

## 9. Backend API Reference

All routes served from `http://localhost:8001`.

### Chat / Core
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Streaming SSE chat |
| `POST` | `/test_key` | Validate HF or GitHub token |
| `POST` | `/create_project` | Create local/GitHub/HF project |

### HF Backend
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/hf-backend/init` | Create private dataset repo |
| `POST` | `/hf-backend/create-table` | Create empty JSON table |
| `GET` | `/hf-backend/tables?project=` | List tables + row counts |
| `GET` | `/hf-backend/rows?project=&table=` | Read all rows |
| `POST` | `/hf-backend/insert` | Insert record |
| `PUT` | `/hf-backend/update` | Update by id |
| `DELETE` | `/hf-backend/delete` | Delete by id |
| `POST` | `/deploy-space` | Push HTML to HF Static Space |

### KREWE Pipeline
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/krewe/step` | Execute one doll — `{node, context, goal}` |
| `POST` | `/krewe/plan` | Design squad from goal — `{dolls, edges, note}` |
| `POST` | `/krewe/adjust` | Model swaps from errors — `{swaps, note}` |
| `GET` | `/krewe/models?role=` | Model options by role |
| `GET` | `/krewe/master-squad` | Full Inner Circle spec + upgrade paths |

### KREWE Vanity & Portfolio
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/krewe/vanity-chat` | In-character avatar reply — `{reply}` |
| `POST` | `/krewe/portfolio/save` | Save run + generate Gemma report |
| `GET` | `/krewe/portfolio/list` | List saved runs |
| `DELETE` | `/krewe/portfolio/{id}` | Delete entry |

### KREWE Assembly Line
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/krewe/assembly/run` | SSE stream — run persona briefs |
| `GET` | `/krewe/assembly/status` | `{total, certified, grades}` |
| `POST` | `/krewe/gallery/search` | Full-text + filter + sort gallery |
| `GET` | `/krewe/gallery/leaderboard` | Model × role A-rate ranking |

### Research Intelligence
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/krewe/papers?limit=60` | ArXiv papers — avatar/talking-head topics, Nov 2025→today, cached 6hrs |
| `POST` | `/krewe/papers/squad-it` | Paper title + abstract → KREWE squad plan `{dolls, edges, goal, note}` |

### The Stylist — Text-to-Image
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/krewe/generate-image` | Persona → FLUX prompt → HF inference → `{positive_prompt, negative_prompt, image_b64}` |

---

## 10. Key Technical Decisions & Gotchas

### React Flow (`@xyflow/react` v12) — Type-Only Exports
`Node` and `NodeProps` are **not runtime exports**. `tsc --noEmit` passes but `vite build` fails.  
**Fix:** Always `import type { Node, NodeProps }`. Same for `DollNodeType`, `UniformKey`, `EdgeStatus`.

### Stale Callback Refs in DollNode
`onSwapModel` / `onOpen` go stale if `updateNodeData` overwrites them.  
**Fix:** Always re-spread `{ ...n.data, ...patch, onOpen: openConfig, onSwapModel: swapModel }`.

### FlowEdge Particle
`<animateMotion>` + `<mpath href="#edgeId">` — particle rides the exact Bezier natively. No JS loop.

### SSE with POST Body (Assembly Line)
FastAPI `StreamingResponse(media_type="text/event-stream")` + frontend `fetch` + `ReadableStream.getReader()`. **Not** `EventSource` API (GET-only).

### Backend Port
FastAPI on **port 8001** (8000 was in use). Defined in `frontend/src/api.ts`.

### FLUX.1-schnell vs dev
- Schnell: 4-step adversarial distillation — sufficient for talking-head source frames
- Dev: 28-step flow-matching — needed only for gallery-quality export or identity locking with InstantID
- Default: schnell in Master Squad (speed/cost); dev as upgrade path

### LatentSync Parameters
25 DDIM steps, guidance 2.0, sync_loss_weight 0.04 in latent domain. Do not swap to Wav2Lip (pixel-space, jitter) or SadTalker (3DMM artifacts at off-angles).

### Kokoro-82M Voice Profiles
Available: `af_heart`, `af_nova`, `af_sky`, `am_echo`, `am_onyx`. Speed 0.9 ideal for lip-sync (slower = cleaner phoneme mapping). CPU-only — no GPU cost.

### ArXiv Paper Cache
`_PAPER_CACHE` dict in main.py — TTL 6 hours. 6 sequential queries × 12 results each = up to 72 papers deduped and sorted newest-first. Fetching via `urllib.request` (no extra deps).

### Paper Overlay iframe
`<iframe src="https://huggingface.co/papers/{arxiv_id}">` — works in Electron (no same-origin restriction). May be blocked in browser dev by HF's `X-Frame-Options`. Fallback: left panel shows full abstract + external links.

### Persona DNA Hash
`SHA-256(goal_prompt + squad_template + appearance)` — enables dedup and version tracking across assembly runs.

### Preview MCP Sandbox
Preview MCP is sandboxed to `C:\Users\tjlsu\berylllm`. Cannot launch BERYL-HF dev server.  
**Verification pipeline:** `tsc --noEmit` + `python -m py_compile main.py` + `npx vite build` (all must exit 0).

---

## 11. Security Rules

- `.env` is **gitignored** — `HF_TOKEN`, `GITHUB_TOKEN`, `OPENAI_API_KEY`, `XAI_API_KEY`. Never commit.
- Runtime data files (`banned_ips.json`, `firewall_log.jsonl`, `sherman_log.jsonl`) gitignored.
- Token vault in-memory only — no write-back to disk.
- All HF dataset repos created by BERYL are `private=True`.

---

## 12. Changelog

| Date | What shipped |
|------|-------------|
| 2026-06-18 | **Master Squad "The Inner Circle"**: Research-backed 7-doll default pipeline (LatentSync CVPR2025 + FLUX.1-schnell + Kokoro-82M + MiniMax-M3). All system prompts rebuilt with precision specs. Default face → executive (Eve). `GET /krewe/master-squad` spec endpoint. Master template added to assembly line. |
| 2026-06-18 | **The Stylist** — 13th doll, role `Text-to-Image`. FLUX.1-schnell default. Anti-plastic realism prompt engineering. `POST /krewe/generate-image` backend endpoint with HF Inference API + negative prompt pipeline. 6 model options in role registry. |
| 2026-06-18 | **Research Intelligence**: `PaperBanner.tsx` — 42px scrolling ArXiv ticker across KREWE page top (6 avatar/talking-head queries, Nov 2025→today, 6hr cache). `PaperOverlay.tsx` — paper detail + iframe + SQUAD IT. `POST /krewe/papers/squad-it` — LLM converts paper abstract → validated KREWE squad plan. `GET /krewe/papers` — ArXiv API with dedup + sort. |
| 2026-06-18 | **Human Assembly Line**: `AssemblyLine.tsx`, `GalleryView.tsx`, `types.ts`, `persona_library.ts`. 25-feature system: priority queue, server-side pipeline runner, quality gate A/B/C, auto-retry, auto-tag (Gemma), persona DNA hash, versioning, SSE stream, 30 starter personas, 5 squad templates, gallery search + leaderboard. |
| 2026-06-18 | **THE VANITY** ornate picture frame, two-way avatar chat, **Portfolio Gallery** strip, **Reporting Agent** (Gemma), HF Dataset portfolio storage, SAVE SQUAD UP button, `ReportOverlay` panel, avatar persona system for vanity-chat. |
| 2026-06-17 | **KREWE v2**: real-time neon glow on dolls + edges, traveling data-packet particle, model swap dropdown, Connectivity Pulse Test, Auto-Heal AI, Foreman chat routing, pipeline health orb, 4 AI infra dolls (Librarian/Scout/Archivist/Conductor). |
| 2026-06-17 | **KREWE v1**: n8n-style doll canvas, 8 avatar dolls, hand-to-hand connections, SQUAD UP step-by-step execution, Foreman chat (`/krewe/plan`), Bottom Nav KREWE button. |
| 2026-06-17 | **BERYL Builder** Phase 4: CHAT + BUILD dual-mode, 8 project templates, HF Backend panel, Dataset-as-Supabase, `/deploy-space`. |
