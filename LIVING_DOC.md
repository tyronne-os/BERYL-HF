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
8. [Doll Roster](#8-doll-roster)
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

---

## 2. Architecture

```
BERYL-HF/
├── frontend/                   Vite + React + TypeScript + Tailwind
│   └── src/
│       ├── App.tsx             Top-level router (page state)
│       ├── api.ts              API base URL constant (port 8001)
│       ├── components/
│       │   ├── BottomNav.tsx   Bottom navigation bar
│       │   ├── BerylBuilder.tsx  BERYL autonomous builder (CHAT + BUILD)
│       │   ├── CanvasPane.tsx  HTML preview iframe
│       │   └── krewe/
│       │       ├── KrewePage.tsx     Main canvas orchestrator
│       │       ├── DollNode.tsx      Custom React Flow node (fashion doll SVG)
│       │       ├── FlowEdge.tsx      Custom animated edge with traveling particle
│       │       ├── TheVanity.tsx     Ornate picture-frame avatar previewer
│       │       ├── VanityGallery.tsx Portfolio gallery strip + report overlay
│       │       └── roster.ts         Doll definitions + pipeline templates
└── backend/
    └── main.py                 FastAPI (uvicorn, port 8001)
```

**Frontend ↔ Backend:** All API calls hit `http://localhost:8001` (defined in `src/api.ts`). CORS is open for local dev.

**HuggingFace:** Uses `InferenceClient` for LLM calls and `hf_hub_download` / `upload_file` for Dataset-as-DB. Token loaded from `.env` → `HF_TOKEN`.

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

# Or build for production
npm run build        # outputs to dist/
npm run preview      # serve dist/
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

| Button | Icon | Route | Description |
|--------|------|-------|-------------|
| BERYL | Zap | `chat` | Autonomous builder |
| HF | Cloud | `hf` | HuggingFace dashboard |
| GPU | `Cpu` | `gpu` | GPU A/B tester (Genie) |
| STUDIO | `Film` | `studio` | Avatar studio |
| CLI | `Terminal` | `cli` | CLI tools |
| DOCS | `BookOpen` | `docs` | Documentation |
| OLLAMA | `Server` | `ollama` | Local model manager |
| COMFY | `Layers` | `comfy` | ComfyUI integration |
| KREWE | `Users` | `krewe` | **Avatar pipeline builder** ← |

KREWE button shows a gold ping dot when inactive, gold gradient when active.

---

## 5. BERYL Builder (BERYL tab)

**File:** `frontend/src/components/BerylBuilder.tsx`

Dual-mode interface:

### CHAT mode
- Streaming conversation with `MiniMaxAI/MiniMax-M3`
- Built-in HF Backend panel (initialize DB, create tables, CRUD)
- Each response streams token-by-token via SSE

### BUILD mode
- Single prompt → full multi-file project generation
- 8 built-in templates: Portfolio, SaaS Landing, Dashboard, E-Commerce, Blog, API Docs, Mobile App, Game
- Planning phases displayed in real time
- Generated HTML auto-loads into `CanvasPane` iframe
- "Deploy to HF Space" button → `POST /deploy-space`

### HF Backend Panel (within BERYL)
- Initialize project: creates `AIBRUH/beryl-db-{project}` private dataset
- Create table, view rows, insert/update/delete records
- All data lives in HF Dataset JSON files (`data/{table}.json`)

---

## 6. HF Backend — Dataset-as-Database

Private HuggingFace Dataset repos used as a JSON database. Each "project" gets its own repo: `AIBRUH/beryl-db-{project}`.

Tables are stored as `data/{table}.json` (array of records). Every record gets `id` (UUID) and `created_at` (ISO timestamp) auto-injected on insert.

### Endpoints

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
**Route:** `krewe` page in App.tsx  

KREWE is an **n8n-style visual pipeline builder** where each node is a fashion doll. Connect dolls hand-to-hand to define data flow. Hit **SQUAD UP** to execute the pipeline step-by-step, watching the talking avatar come to life in **THE VANITY** on the right.

### Layout

```
┌─────────────────────────────────────────────────────────┬────────────────┐
│  LEFT RAIL (300px)          CENTER CANVAS (flex-1)       │  RIGHT RAIL    │
│  ┌──────────────────┐       ReactFlow canvas with         │  (320px)       │
│  │ FOREMAN | ROSTER │       DollNode + FlowEdge           │                │
│  └──────────────────┘                                     │  ┌──────────┐  │
│  Chat with the AI            TOP TOOLBAR:                 │  │    THE   │  │
│  Foreman to design           SQUAD UP · TEST · Avatar     │  │  VANITY  │  │
│  the pipeline.               Squad · + Doll · Clear       │  │  (frame) │  │
│                              SAVE (when live)             │  └──────────┘  │
│  OR drag dolls from                                       │  ┌──────────┐  │
│  Roster tab onto             Pipeline health orb          │  │PORTFOLIO │  │
│  the canvas.                 shows X/total done           │  │  STRIP   │  │
└─────────────────────────────────────────────────────────┴────────────────┘
```

---

### 7a. The Canvas & Doll System

**`DollNode.tsx`** — Custom React Flow node type `"doll"`:

- SVG fashion doll with body parts mapped to pipeline config:
  - **Head** → Persona & System Instructions
  - **Torso** → Model / Engine selection
  - **Purse** → Tools & Function Calling
- Click any body part to open the **Config Drawer** (slides in from the right of the canvas)
- **Neon glow status indicators:**
  | Status | Glow |
  |--------|------|
  | idle | none |
  | running | gold pulse `#d4af37` |
  | done | neon green `#00ff88` |
  | error | neon red `#ff2244` |
- **Model swap dropdown** inside the doll body — 5–8 model options per role category, no re-render
- Latency chip, error badge, and output snippet preview on doll face after run

**`FlowEdge.tsx`** — Custom animated edge type `"flow"`:

- Four statuses: `idle | flowing | done | error` — each with matching stroke color + glow filter
- **Traveling particle** when `flowing`: `<animateMotion>` + `<mpath href="#edgeId">` so the gold dot rides the exact Bezier path natively in SVG
- Multiple drop-shadow layers create the neon glow effect

**`roster.ts`** — Doll definitions and pipeline templates:

- `KREWE_ROSTER`: 12 dolls total (see [Doll Roster](#8-doll-roster))
- `AVATAR_PIPELINE`: default 7-doll chain for talking avatar
- `rosterToData(entry, onOpen, onSwapModel)`: converts roster entry to `DollData`

---

### 7b. SQUAD UP — Step-by-Step Pipeline Execution

When the user hits **SQUAD UP**:

1. Topological sort of the canvas DAG
2. For each doll in order:
   - Mark node `running` (gold glow) + animate incoming edges `flowing` (particle on)
   - `POST /krewe/step` with node config + accumulated context
   - On `done`: mark green, outgoing edges green, append output to context
   - On `error`: mark red, outgoing edges red, collect error
3. After all dolls: if all green → avatar speaks in **THE VANITY**; if errors → Auto-Heal button appears
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

**TEST** button in toolbar — pings every doll independently before a full run:

1. Sends each doll a `"respond with PONG"` task via `/krewe/step`
2. Green ✓ = model is reachable and responding; Red ✗ = engine down
3. Reports results in Foreman chat
4. Use to identify broken dolls **before** SQUAD UP

---

### 7d. Auto-Heal

Appears as a purple **✨ Auto-Heal (N errors)** button in Foreman chat after any failed run:

- `POST /krewe/adjust` with failed nodes + error messages
- LLM returns `{ swaps: [{ nodeId, model }], note }` — better model suggestions
- Automatically applies all swaps silently, prompts user to re-run

---

### 7e. Foreman Chat

Left rail, **FOREMAN** tab. AI assistant that designs and adjusts the pipeline:

- **New design:** type a goal (e.g., `"A confident news anchor reading sports updates"`) → AI calls `POST /krewe/plan` → dolls placed on canvas with edges
- **Adjustment:** type `"swap the Mechanic"` or `"fix the error"` → AI calls `POST /krewe/adjust` → model swaps applied
- Auto-detect: checks message for `swap|fix|change|replace|retry|error|fail` etc. to route to adjust vs. plan

---

### 7f. THE VANITY — Live Avatar Previewer

**File:** `frontend/src/components/krewe/TheVanity.tsx`

The right rail's top section. An **ornate baroque picture frame** containing the live talking avatar.

#### Visual Design
- **Frame**: multi-layer gold gradient padding (10px, `linear-gradient(135deg, #f5d76e → #9a6a08 → #e8c040 → ...)`), multiple box-shadow layers for depth and glow
- **Title plaque**: `✦ THE VANITY ✦` in Georgia serif, gold gradient background, overlapping the top frame edge at `-14px`
- **Corner ornaments**: four baroque fleur-de-lis SVG ornaments positioned absolutely at each inner-canvas corner
- **Inner canvas**: deep dark gradient with subtle inner box-shadow and a delicate inner border line
- **Avatar face**: parametric SVG with skin/hair/dress/accent colors per uniform
- **Speaking aura**: two concentric ellipses that pulse via SVG `<animateTransform>` when the avatar speaks

#### Avatar Animation
- `requestAnimationFrame` loop driving `mouthOpen` state with layered sines (`sin(t)*0.6 + sin(t*2.3)*0.4`) for natural viseme motion
- Mouth height: `3 + mouthOpen * 14` px
- Upper teeth ellipse appears when `mouthOpen > 0.4`
- Speaking filter: `drop-shadow` glow on the whole SVG keyed to `u.accent`

#### Two-Way Chat
- **💬 toggle** button in status bar opens the chat panel below the frame
- User types → `POST /krewe/vanity-chat` with the message + current avatar context + uniform
- Backend replies in-character (persona matched to uniform, see §9)
- Avatar animates speaking the reply (calls parent `onSpeakLine`)
- Chat history shows last 6 exchanges, avatar replies prefixed with `✦`

---

### 7g. Portfolio Gallery

**File:** `frontend/src/components/krewe/VanityGallery.tsx`

Right rail bottom section. A **horizontal scroll strip** of saved Squad Up runs.

#### Saving a Run
- **SAVE** button appears in the toolbar after a successful live run (`avatar.status === 'live'`)
- Clicks `POST /krewe/portfolio/save` → Gemma generates a report → saves to `AIBRUH/beryl-krewe-portfolio` HF Dataset
- Optimistic local cache in `localStorage` (`krewe-portfolio`) for instant display

#### Portfolio Cards (150×108px each)
Each card shows:
- Face uniform icon + auto-title (first 40 chars of goal)
- Date (Month Day)
- Prompt excerpt (2 lines)
- Pipeline health bar (colored green/red)
- Done/Total count
- Doll emoji lineup (up to 7)
- **VIEW REPORT** button

#### Report Overlay
Clicking VIEW REPORT opens a full `ReportOverlay` panel (`absolute inset-0 z-40`) over the right rail:
- Final spoken avatar output (italic, gold box)
- Goal prompt
- Gemma-generated markdown report (monospace `<pre>`)
- Full squad breakdown: doll name, role, model, status, latency
- Close with `X`

#### Persistence
- Primary: HF Dataset `AIBRUH/beryl-krewe-portfolio` → table `squads.json`
- Local cache: `localStorage['krewe-portfolio']` loaded synchronously on mount
- Delete: removes from both localStorage and HF Dataset via `DELETE /krewe/portfolio/{id}`

---

### 7h. Reporting Agent (Gemma)

Fires automatically when a squad is saved.

**Trigger:** `POST /krewe/portfolio/save` calls `_generate_krewe_report(entry)` before writing to HF.

**Prompt structure:**
```
System: "You are a technical reporting agent for the KREWE avatar pipeline builder. 
Write a concise, structured markdown report. Use clear section headers. 
Be specific and actionable. Under 250 words."

User: Goal: {prompt}
      Health: {done}/{total} dolls passed ({failed} failed)
      Final avatar output: "{output}"
      Squad: [list of name, role, model, status, latency]

      Generate the report with sections:
      ## Overview, ## Pipeline Health, ## Output Assessment, ## Recommendations
```

**Model:** Uses `DEFAULT_MODEL` (MiniMax-M3) at `temperature=0.3`. Falls back to a static summary card if the model is offline.

---

## 8. Doll Roster

12 dolls in two categories:

### 🎭 Avatar Dolls

| Key | Name | Role | Uniform | Default Model |
|-----|------|------|---------|---------------|
| `courier` | The Courier | Trigger / Intake | captain | trigger |
| `cosmos` | Ms. Cosmos | Brain / Orchestrator | gala | MiniMaxAI/MiniMax-M3 |
| `executive` | The Executive | Scripting | executive | MiniMaxAI/MiniMax-M3 |
| `doctor` | Dr. Clarity | QA / Fact-Check | scrubs | MiniMaxAI/MiniMax-M3 |
| `vocalist` | The Vocalist | TTS / Voice | artist | ove-voice |
| `mechanic` | The Mechanic | HF GPU Render | mechanic | hf-gpu |
| `athlete` | The Athlete | Lip Sync | captain | latentsync |
| `streamer` | The Streamer | Stream Output | captain | edge-stream |

### 🤖 AI Infra Dolls

| Key | Name | Role | Uniform | Default Model |
|-----|------|------|---------|---------------|
| `librarian` | The Librarian | LangChain Orchestration | librarian | langchain/local |
| `scout` | The Scout | SmolAgents Execution | scout | smol-agents/local |
| `archivist` | The Archivist | Memory / FAISS | archivist | faiss/local |
| `conductor` | The Conductor | Router / Planner | conductor | MiniMaxAI/MiniMax-M3 |

**Uniform colors** (`DollNode.tsx` `UNIFORMS` dict): each uniform has `hair`, `skin`, `dress`, `accent`, `icon`, and optional `crown` field. Supports: `gala, executive, scrubs, academic, justice, artist, captain, mechanic, librarian, scout, archivist, conductor`.

---

## 9. Backend API Reference

All routes served from `http://localhost:8001`.

### Chat / Core
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Streaming SSE chat (default MiniMax-M3) |
| `POST` | `/test_key` | Validate HF or GitHub token |
| `POST` | `/create_project` | Create local/GitHub/HF project |

### HF Backend (Dataset DB)
| Method | Path | Body / Query | Returns |
|--------|------|-------------|---------|
| `POST` | `/hf-backend/init` | `{project}` | `{repo_id, status}` |
| `POST` | `/hf-backend/create-table` | `{project, table, columns?}` | `{status}` |
| `GET` | `/hf-backend/tables` | `?project=` | `{tables: [{name, rows, columns}]}` |
| `GET` | `/hf-backend/rows` | `?project=&table=` | `{rows: [...]}` |
| `POST` | `/hf-backend/insert` | `{project, table, record}` | `{status, record}` |
| `PUT` | `/hf-backend/update` | `{project, table, id, updates}` | `{status, record}` |
| `DELETE` | `/hf-backend/delete` | `{project, table, id}` | `{status, remaining}` |
| `POST` | `/deploy-space` | `{name, html}` | `{status, url}` |

### KREWE Pipeline
| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/krewe/run` | `{nodes, edges, goal}` | `{results: [...]}` |
| `POST` | `/krewe/step` | `{node, context, goal}` | `{status, output, latency_ms, error, model_used}` |
| `POST` | `/krewe/plan` | `{goal, roster}` | `{dolls, edges, note}` |
| `POST` | `/krewe/adjust` | `{message, nodes, errors}` | `{swaps: [{nodeId, model}], note}` |
| `GET` | `/krewe/models` | `?role=` | `{role, models: [...]}` |

### KREWE Vanity & Portfolio
| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/krewe/vanity-chat` | `{message, context, uniform}` | `{reply}` |
| `POST` | `/krewe/portfolio/save` | `{entry}` | `{entry}` (with id, created_at, report) |
| `GET` | `/krewe/portfolio/list` | — | `{entries: [...]}` |
| `DELETE` | `/krewe/portfolio/{id}` | — | `{status, remaining}` |

### Avatar Personas for Vanity Chat
Each `uniform` maps to a character persona used as the system prompt for `/krewe/vanity-chat`:

| Uniform | Character |
|---------|-----------|
| gala | Glamorous award-show host, charming and warm |
| executive | Sharp, decisive business leader |
| scrubs | Compassionate, calm medical professional |
| academic | Brilliant professor with dry wit |
| justice | Composed legal advocate |
| artist | Passionate creative with vivid imagery |
| captain | Confident, mission-focused leader |
| mechanic | Plain-speaking, no-nonsense engineer |
| librarian | Knowledgeable, precise archivist |
| scout | Energetic, curious field scout |
| archivist | Methodical memory keeper |
| conductor | Grand orchestrator with vision |

---

## 10. Key Technical Decisions & Gotchas

### React Flow (`@xyflow/react` v12) — Type-Only Exports
`Node` and `NodeProps` are **not runtime exports**. `tsc --noEmit` passes but `vite build` fails with `[MISSING_EXPORT]`.  
**Fix:** Always use `import type { Node, NodeProps }` for type-only imports.  
Same rule applies to `DollNodeType`, `RosterEntry`, `EdgeStatus`, `DollData`, `UniformKey`.

### Stale Callback Refs in DollNode
`onSwapModel` and `onOpen` can go stale if `updateNodeData` overwrites them.  
**Fix:** `updateNodeData` always re-spreads `{ ...n.data, ...patch, onOpen: openConfig, onSwapModel: swapModel }` to keep stable callback refs.

### FlowEdge Particle Animation
Traveling particle uses SVG `<animateMotion>` + `<mpath href="#edgeId">` referencing the edge's own `<path id={id}>`. This gives native SVG particle travel along the Bezier without any JS animation loop.

### Backend Port
FastAPI runs on **port 8001**, not 8000 (8000 was in use). Defined in `frontend/src/api.ts`.

### PowerShell Git Commits
PowerShell here-strings (`@'...'@`) fail when the commit message contains parentheses or certain special chars. Use `git commit -m @'...'@` with single-quoted PS here-strings, or write message to a temp file and use `git commit -F`.

### HF Dataset Latency
`hf_hub_download` + `upload_file` takes 1–4 seconds per operation. This is by design — HF Dataset storage is the persistence layer, not a real-time cache. The frontend uses `localStorage` as an optimistic cache for the portfolio.

### Preview MCP Sandbox
The Preview MCP is sandboxed to `C:\Users\tjlsu\berylllm` (the Edge Engine project root). It **cannot** launch the BERYL-HF dev server. Verification pipeline: `tsc --noEmit` + `python -m py_compile main.py` + `npx vite build` (all must exit 0).

### Config Drawer z-index
The Config Drawer is `absolute top-0 right-0 z-20` inside the canvas container. It slides over the React Flow canvas but sits below the KREWE toolbar panel.

### Doll Dropdown z-index Inside React Flow
Model swap dropdown uses `nodrag nopan nowheel` CSS classes on the wrapper, `position: absolute` with `z-50` for the list, and `document.addEventListener('mousedown')` for outside-click closing.

---

## 11. Security Rules

- `.env` is **gitignored** — contains `HF_TOKEN`, `GITHUB_TOKEN`, `OPENAI_API_KEY`, `XAI_API_KEY`. Never commit.
- Runtime data files (`banned_ips.json`, `firewall_log.jsonl`, `sherman_log.jsonl`) are gitignored.
- Token vault is **in-memory only** — no write-back to disk.
- All HF dataset repos created by BERYL are `private=True`.

---

## 12. Changelog

| Date | Commit | What shipped |
|------|--------|-------------|
| 2026-06-18 | `7d445f4` | **THE VANITY** ornate picture frame, two-way avatar chat, **Portfolio Gallery** with horizontal scroll strip, **Reporting Agent** (Gemma/MiniMax), HF Dataset portfolio storage (`AIBRUH/beryl-krewe-portfolio`), SAVE SQUAD UP toolbar button, `ReportOverlay` panel, avatar persona system for vanity-chat |
| 2026-06-18 | `284dfd5` | **KREWE v2**: real-time neon connectivity glow (green/red) on dolls + edges simultaneously, traveling data-packet particle on edges (`<animateMotion>`), model swap dropdown inside every doll body, Connectivity Pulse Test (`TEST` button), Auto-Heal AI (`POST /krewe/adjust`), Foreman chat routing (adjust vs. plan), pipeline health orb in toolbar, 4 new AI infra dolls (Librarian/Scout/Archivist/Conductor) |
| 2026-06-17 | earlier | **KREWE v1**: n8n-style doll canvas, 8 avatar dolls, hand-to-hand connections, SQUAD UP step-by-step execution, AvatarStage live talking head, Foreman chat (`POST /krewe/plan`), Bottom Nav KREWE button |
| 2026-06-17 | earlier | **BERYL Builder** (Phase 4): CHAT + BUILD dual-mode, 8 project templates, HF Backend panel, HF Dataset-as-Supabase (`/hf-backend/*`), `POST /deploy-space` |
