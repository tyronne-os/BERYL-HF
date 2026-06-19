# BERYL-HF — Claude Code Project Instructions

> Read this file at every session start. These rules are always active.

---

## Project Identity

**Repo:** `tyronne-os/BERYL-HF`  
**Stack:** Electron + Vite/React/TypeScript/Tailwind (port 5173) · FastAPI uvicorn (port 8001)  
**Mission:** Produce photorealistic talking humans — undetectable as AI, at industrial scale, at $0.003/avatar.

---

## Verification Pipeline (run after every code change)

All three must exit 0 before committing:

```bash
# 1. TypeScript
cd frontend && npx tsc --noEmit

# 2. Python syntax
python -m py_compile backend/main.py

# 3. Vite production build
cd frontend && npx vite build
```

Run 1 and 2 in parallel. Run 3 after both pass. Never commit if any check fails.

---

## Hard Rules

### Security (never violate)
- `.env` is gitignored — contains `HF_TOKEN`, `GITHUB_TOKEN`, `OPENAI_API_KEY`, `XAI_API_KEY`. **Never stage or commit `.env`.**
- All HF dataset repos created by BERYL use `private=True`.
- Token vault is in-memory only — no write-back to disk.
- Runtime data files (`banned_ips.json`, `firewall_log.jsonl`) are gitignored.

### React Flow (`@xyflow/react` v12)
- `Node` and `NodeProps` are **type-only exports** — `import type { Node, NodeProps }` always.
- Using them as runtime values compiles with `tsc --noEmit` but **breaks `vite build`** with `[MISSING_EXPORT]`.
- Same rule: `DollNodeType`, `UniformKey`, `EdgeStatus`, `DollData`.

### DollNode callbacks
- `onOpen` and `onSwapModel` must be re-spread on every `updateNodeData` call:
  ```ts
  updateNodeData(id, { ...patch, onOpen: openConfig, onSwapModel: swapModel })
  ```
- Omitting this causes stale closures and silent callback failures.

### Backend port
FastAPI is on **port 8001**, not 8000. The constant is in `frontend/src/api.ts`.

### SSE streaming
Assembly line uses `StreamingResponse` (FastAPI) + `fetch` + `ReadableStream.getReader()` on the frontend. **Not** `EventSource` API — that only supports GET.

### PowerShell git commits
Use single-quoted here-strings: `git commit -m @'...'@` — or write message to a temp file and `git commit -F`.

---

## The Master Squad — Default Pipeline

**AVATAR_PIPELINE in `roster.ts`:**
```
courier → cosmos → stylist → vocalist → mechanic → doctor → athlete
```

This is the production default. Load it when the user opens KREWE or asks for the default squad.

### The 7 dolls and their locked roles

| # | Key | Name | Model | Non-negotiable constraint |
|---|-----|------|-------|--------------------------|
| 1 | courier | The Courier | trigger | Output clean JSON context only. Temperature 0.0 |
| 2 | cosmos | Ms. Cosmos | MiniMaxAI/MiniMax-M3 | `spoken_script` ≤ 15 words. No AI tells |
| 3 | stylist | The Stylist | black-forest-labs/FLUX.1-schnell | Anti-plastic negatives in every prompt |
| 4 | vocalist | The Vocalist | hexgrad/Kokoro-82M | Speed 0.9. `phoneme_align: true` |
| 5 | mechanic | The Mechanic | AIBRUH/latentsync | 25 DDIM steps. Temporal attention = true |
| 6 | doctor | The Doctor | MiniMaxAI/MiniMax-M3 | Text-only gate. 8-point naturalness audit |
| 7 | athlete | The Athlete | edge-stream | MJPEG 25fps. Loop = true |

### The 3 AI tells this squad eliminates
1. **Plastic skin** → FLUX flow-matching + Stylist anti-airbrushing negatives
2. **Lip-sync jitter** → LatentSync CVPR 2025 latent SyncNet loss
3. **Robotic cadence** → Kokoro-82M StyleTTS2 MOS 4.4 + 15-word cap

### Upgrade triggers (do not upgrade proactively)
| Doll | Trigger | Upgrade to |
|------|---------|-----------|
| Stylist | Identity drift across >3 runs | FLUX.1-dev + InstantID |
| Mechanic | Mouth errors >5% frames | Hallo2 or MuseTalk v2 |
| Vocalist | Need voice cloning | F5-TTS or XTTS-v2 |
| Cosmos | Need <200ms direction | Qwen2.5-7B local ollama |

---

## File Map (key files only)

```
BERYL-HF/
├── CLAUDE.md                      ← you are here
├── MASTER_SQUAD.md                ← full engineering spec
├── LIVING_DOC.md                  ← full project reference
├── ASSEMBLY_PLAN.md               ← 25-feature assembly line plan
├── backend/main.py                ← FastAPI (all endpoints)
└── frontend/src/components/krewe/
    ├── KrewePage.tsx              ← main orchestrator (canvas + rails)
    ├── DollNode.tsx               ← SVG doll node + UNIFORMS + ROLE_MODELS
    ├── roster.ts                  ← KREWE_ROSTER + AVATAR_PIPELINE
    ├── TheVanity.tsx              ← baroque frame avatar previewer
    ├── VanityGallery.tsx          ← portfolio strip + ReportOverlay
    ├── AssemblyLine.tsx           ← assembly line ASSEMBLY tab
    ├── GalleryView.tsx            ← full-screen gallery overlay
    ├── PaperBanner.tsx            ← ArXiv research paper scroller
    ├── PaperOverlay.tsx           ← paper detail + SQUAD IT
    ├── types.ts                   ← PersonaBrief, AssemblyEntry, etc.
    └── persona_library.ts         ← 30 starter persona briefs
```

---

## Adding a New Doll (checklist)

1. Add key to `UniformKey` type in `DollNode.tsx`
2. Add entry to `UNIFORMS` record in `DollNode.tsx` (dress/accent/skin/hair/label/icon/crown)
3. Add role to `ROLE_MODELS` record in `DollNode.tsx` with model list
4. Add role to `_KREWE_ROLE_MODELS` dict in `backend/main.py`
5. Add roster entry to `KREWE_ROSTER` in `roster.ts` (key/uniform/name/role/blurb/model/systemPrompt/temperature/tools)
6. Run verification pipeline

---

## Backend Endpoint Conventions

- All KREWE routes: `@app.{method}("/krewe/{resource}")`
- LLM calls go through `_krewe_llm(model_id, system, user, temperature, max_tokens)`
- HF Dataset operations: `_read_table(repo_id, table)` / `_write_table(repo_id, table, rows)`
- All HF repos: `_ensure_portfolio_repo()` → `AIBRUH/beryl-krewe-portfolio`
- SSE streams: `StreamingResponse(generator(), media_type="text/event-stream")`
- Default model constant: `DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3"`

---

## Default Face in THE VANITY

`executive` uniform (Eve) is the production default. Do not change this to `gala` without a specific reason.

---

## HuggingFace Account

All HF repos: `AIBRUH/*` namespace.
All repos created as `private=True`.

---

*Maintained by Claude Sonnet 4.6 · tyronne-os/BERYL-HF*
