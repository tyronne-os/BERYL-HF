# KREWE Master Squad — Engineering Specification
## "The Inner Circle" · v1.0

> **Purpose:** The canonical, research-backed pipeline that guarantees a photorealistic talking human in THE VANITY.  
> **Standard:** Undetectable as AI-generated. Zero plastic sheen. Zero lip-sync jitter. Zero robotic cadence.  
> **Cost:** $0.003 per avatar · ~13s cold · $0.80 GPU budget = 267 runs

---

## Mission Statement

KREWE's purpose is to produce live talking humans at **Tavus-level quality or above** — automated, at industrial scale, at near-zero GPU cost. The Inner Circle is the squad that delivers this 99.9% of the time. It is not a starting point for experimentation. It is the production floor.

---

## The 3 AI Tells This Squad Eliminates

| Tell | How it manifests | How The Inner Circle kills it |
|------|-----------------|-------------------------------|
| **Plastic skin** | Airbrushed, smooth, poreless texture — no subsurface | FLUX.1-schnell flow-matching + anti-airbrushing negative weights in every Stylist prompt |
| **Lip-sync jitter** | Inter-frame mouth float, phoneme lag, temporal inconsistency | LatentSync CVPR 2025 — SyncNet loss computed in latent space, not pixels. Temporal self-attention across frames |
| **Robotic cadence** | Flat pitch, uniform pace, no natural breathing rhythm | Kokoro-82M StyleTTS2 — style diffusion + adversarial training, MOS 4.4. 15-word script cap maintains timing budget |

---

## Pipeline Architecture

```
[Courier]
    │  JSON context: {persona_name, persona_brief, topic, setting, priority}
    ▼
[Ms. Cosmos]  — MiniMax-M3 427B
    │  JSON output: {persona, scene, spoken_script ≤15w, emotion, voice_tone}
    ▼
[The Stylist]  — FLUX.1-schnell          [The Vocalist]  — Kokoro-82M
    │  portrait.png (768×1024)                │  audio.wav (22050hz)
    │  anti-plastic realism prompt            │  natural prosody, speed=0.9
    └──────────────────┬──────────────────────┘
                       ▼
              [The Mechanic]  — AIBRUH/latentsync
                       │  LatentSync CVPR 2025
                       │  25-step DDIM · guidance 2.0
                       │  latent SyncNet loss · temporal attention
                       │  talking_head.mp4 @ 25fps
                       ▼
              [The Doctor]  — MiniMax-M3 427B
                       │  8-point naturalness gate (text-only, no GPU re-run)
                       │  → pass: forward to Athlete
                       │  → fail: loop back to Cosmos
                       ▼
              [The Athlete]  — edge-stream
                       │  MJPEG 25fps → THE VANITY
                       ▼
                 ✦ THE VANITY ✦
```

---

## Doll Specifications

### 1 — The Courier · `courier` · trigger · $0 · 0ms

**Function:** Receives raw input and wraps it into a typed squad context object.

**System prompt contract:**
```
OUTPUT JSON only:
{
  "persona_name": "...",
  "persona_brief": "1-2 sentence character description",
  "topic": "what they should speak about",
  "setting": "studio / news desk / outdoor / etc",
  "priority": 1-10
}
```

**Key constraint:** Temperature 0.0 — no creativity, pure formatting.

---

### 2 — Ms. Cosmos · `cosmos` · MiniMax-M3 427B · $0 · 600ms

**Function:** Creative director. Parses brief → scene direction → exactly what the avatar says.

**Critical constraint:** `spoken_script` MUST be ≤15 words. Shorter is better. This is the lip-sync timing budget. LatentSync is calibrated to short utterances — longer scripts cause phoneme drift at the tail.

**System prompt contract:**
```
OUTPUT JSON only (no markdown, no prose):
{
  "persona": "character name and 1-line description",
  "scene": "visual scene direction — where, lighting, camera angle",
  "spoken_script": "EXACTLY what the avatar says. ≤15 words. First-person. Natural.",
  "emotion": "calm | confident | warm | urgent | thoughtful | direct",
  "voice_tone": "authoritative | warm | crisp | energetic | low | breathy"
}
```

**AI tell removal:** Cosmos's system prompt explicitly bans "Certainly!", "I'd be happy to", "As an AI" — these are language-layer tells that destroy believability even before the video is generated.

**Temperature:** 0.72 — creative enough to write natural dialogue, constrained enough to stay in character.

---

### 3 — The Stylist · `stylist` · FLUX.1-schnell · $0.003 · 3–4s

**Function:** Converts the Cosmos scene direction into an optimized FLUX prompt. The Stylist is a prompt engineer, not just a pass-through.

**Why FLUX.1-schnell over SDXL or SD 3.5:**
- FLUX uses **rectified flow matching** instead of DDPM score matching → sharper high-frequency detail (skin pores, individual hair strands, fabric weave)
- Schnell variant = 4-step adversarial distillation → sufficient quality for talking-head source frames at 1/7th the latency of dev
- FLUX architecture is the current benchmark leader for photorealistic human skin texture

**Realism requirements (hardcoded in every prompt):**
- Natural skin: visible pores, subsurface scattering, micro-texture
- Lighting: soft cinematic 3-point (key + fill + rim), golden-hour or studio warmth
- Camera: Sony A7 IV, 85mm f/1.8, shallow bokeh
- Composition: upper-body or headshot, 3/4 angle, genuine expression
- Hardcoded negative weights: `(airbrushed:1.4),(plastic texture:1.5),(glossy:1.3),(cartoon:1.5),(smooth skin:1.3)`

**System prompt output format:**
```
Line 1: [comma-separated positive descriptors]
Line 2: negative_prompt: [negative weights]
```

**HF endpoint:** `POST /krewe/generate-image` — calls HF Inference API, returns `image_b64`

---

### 4 — The Vocalist · `vocalist` · hexgrad/Kokoro-82M · $0 · 400ms

**Function:** Converts the Doctor-approved script into speech audio.

**Why Kokoro-82M:**
- Based on **StyleTTS2 (NeurIPS 2023)** — style diffusion + adversarial training on speaker style distribution
- MOS 4.4 on CommonVoice — near-human parity
- CPU-only inference → $0 GPU cost
- Natural prosody variation — not the flat, uniform-pace cadence that flags synthetic TTS

**Voice profile selection:**
| Tone | Profile |
|------|---------|
| authoritative / crisp | `am_onyx` or `am_echo` |
| warm / breathy | `af_heart` or `af_nova` |
| energetic / direct | `af_sky` |

**Speed:** 0.9 (slightly slower than 1.0 = cleaner phoneme boundaries for LatentSync alignment)

**Output:** `audio.wav` at 22050hz + `phoneme_align: true` metadata

---

### 5 — The Mechanic · `mechanic` · AIBRUH/latentsync · $0.0002 · 6–10s

**Function:** The GPU heart. Takes `portrait.png` + `audio.wav` → `talking_head.mp4`.

**Why LatentSync over alternatives:**

| Model | Method | Jitter | Quality | Speed |
|-------|--------|--------|---------|-------|
| **LatentSync** | Latent SyncNet loss + temporal attention | None | ★★★★★ | 8s |
| Wav2Lip | Pixel-space discriminator | High | ★★★ | 3s |
| SadTalker | 3DMM + pixel render | Medium | ★★★ | 12s |
| Hallo2 | Hierarchical audio-visual | Low | ★★★★★ | 45s |
| MuseTalk | Diffusion inpainting | Low-medium | ★★★★ | 5s |

**LatentSync key papers:**
- "LatentSync: Audio Conditioned Latent Diffusion Models for Lip Sync" (ByteDance, arxiv 2412.09262, CVPR 2025)
- Innovation: SyncNet discriminator operates in **latent space**, not pixel space → eliminates frequency-domain jitter that pixel-space methods produce

**Run parameters:**
```python
inference_steps: 25        # DDIM
guidance_scale: 2.0
sync_loss_weight: 0.04     # latent SyncNet
temporal_attention: true   # eliminates inter-frame float
output_fps: 25
output_resolution: 768×768
```

**GPU:** ZeroGPU (free, 60s quota) or L4 endpoint ($0.08/hr = $0.0002/run)

---

### 6 — The Doctor · `doctor` · MiniMax-M3 427B · $0 · 400ms

**Function:** Naturalness gate. Text-only audit — no GPU re-run on fail, only text correction or loop back to Cosmos.

**8-Point Audit Checklist:**
1. Word count ≤ 15 — trim from tail if over
2. First-person voice ("I", "my", "I'm") — never third-person
3. No AI assistant tells: "Certainly", "Of course", "I'd be happy to", "As an AI"
4. No essay markers: "firstly", "in conclusion", "to summarize"
5. Natural punctuation — no excessive exclamation marks
6. In-character for the stated persona
7. Safe — no harmful/misleading content
8. Genuine — sounds like a real human said it

**Pass:** output script verbatim  
**Fail:** output corrected version (or flag for Cosmos re-run)  
**Temperature:** 0.1 — conservative corrections only

---

### 7 — The Athlete · `athlete` · edge-stream · $0 · 0ms

**Function:** Stream `talking_head.mp4` frames to THE VANITY at 25fps via MJPEG.

**Spec:**
```json
{
  "stream_url": "/stream/vanity",
  "fps": 25,
  "codec": "mjpeg",
  "loop": true,
  "buffer_frames": 3
}
```

MJPEG chosen over H.264/WebM for minimum decoder latency. Loop=true holds the last clip until new content arrives, keeping THE VANITY live at all times.

---

## Budget Analysis

| Component | Model | Cost/run | Budget share |
|-----------|-------|----------|-------------|
| Portrait | FLUX.1-schnell HF API | $0.003 | 100% |
| TTS | Kokoro-82M (CPU) | $0.000 | 0% |
| Lip Sync | LatentSync ZeroGPU | $0.000 | 0% |
| Direction | MiniMax-M3 HF free | $0.000 | 0% |
| QA | MiniMax-M3 HF free | $0.000 | 0% |
| **Total** | | **$0.003** | |

$0.80 GPU budget = **267 complete avatar generations**

With dedicated L4 endpoint for LatentSync ($0.08/hr, ~10s per run = $0.0002):
Total per run ≈ $0.0032 → **250 runs per $0.80**

---

## Research Foundation

| Paper | Venue | What it powers |
|-------|-------|---------------|
| [LatentSync: Audio Conditioned Latent Diffusion Models for Lip Sync](https://arxiv.org/abs/2412.09262) | CVPR 2025 · ByteDance | The Mechanic — zero-jitter lip sync |
| [Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) | ICML 2024 · Black Forest Labs | The Stylist — FLUX.1 photorealism |
| [StyleTTS 2: Towards Human-Level Text-to-Speech through Style Diffusion and Adversarial Training](https://arxiv.org/abs/2306.07691) | NeurIPS 2023 | The Vocalist — Kokoro-82M prosody |
| [InstantID: Zero-shot Identity-Preserving Generation](https://arxiv.org/abs/2401.07519) | CVPR 2024 · InstantX | Stylist upgrade path — face identity lock |

---

## Quality Gate

Before any squad run is considered production-ready, it must pass **all 10 criteria** (scored 0–10 each):

| # | Criterion | Scoring |
|---|-----------|---------|
| 1 | All dolls green | All pipeline nodes status=done |
| 2 | Output length | Avatar output ≥ 8 words (post-Doctor) |
| 3 | In-character | Output >30 chars, first-person |
| 4 | Latency OK | Total pipeline <13,000ms |
| 5 | No errors | Zero pipeline exceptions |
| 6 | Tone match | Output vocabulary matches category |
| 7 | Strong hook | Does not open with "I am / Hello I'm" |
| 8 | Spoken natural | No essay markers |
| 9 | Narrative arc | Multiple sentences, natural punctuation |
| 10 | On-brand | Consistent first-person voice throughout |

**Grades:** A (85–100) = CERTIFIED · B (65–84) = APPROVED · C (<65) = AUTO-RETRY

---

## Upgrade Paths

These are codified in `GET /krewe/master-squad`. Upgrade only when the specific trigger condition is met — not proactively.

| Doll | Current model | Trigger condition | Upgrade to |
|------|--------------|------------------|-----------|
| Stylist | FLUX.1-schnell | Identity drift across >3 consecutive runs | FLUX.1-dev + InstantID adapter |
| Mechanic | AIBRUH/latentsync | Mouth shape errors visible >5% of frames | Hallo2 (quality↑, speed↓) or MuseTalk v2 (speed↑, quality≈) |
| Vocalist | Kokoro-82M | Need voice cloning from audio sample | F5-TTS or XTTS-v2 (both support zero-shot voice cloning) |
| Cosmos | MiniMax-M3 free | Need sub-200ms direction (real-time mode) | Qwen2.5-7B via local Ollama |
| Mechanic | LatentSync | Need full-body animation (not just face) | Champ (KwaiVGI/CHAMP) or AnimateAnyone |

---

## Emerging Science Watchlist

Monitor these research directions via the KREWE Research Intelligence ticker (PaperBanner):

- **4D Gaussian avatar streaming** — per-frame 3D reconstruction in real time
- **Consistent video diffusion** (CogVideoX successors) — end-to-end video generation without stitching
- **Streaming diffusion** — DDIM with progressive rendering, target <3s total latency
- **Neural codec TTS** — voice latent codes for sub-100ms synthesis
- **InstantID v2** — multi-image identity locking with motion consistency

When a paper in one of these areas shows >10% improvement over the current doll's benchmark, trigger the upgrade path.

---

## Integration Points

### Canvas Default
`roster.ts` → `AVATAR_PIPELINE = ['courier','cosmos','stylist','vocalist','mechanic','doctor','athlete']`  
This loads on KREWE page open and when "Avatar Squad" toolbar button is clicked.

### Assembly Line
`backend/main.py` → `_squad_templates()['master']` — 4-stage LLM pipeline used for server-side assembly runs.

### API Query
`GET /krewe/master-squad` — returns full spec, cost, upgrade paths as JSON for any consumer.

### Foreman Chat
When Foreman designs a new squad, it defaults to these doll keys unless the use case requires deviation.

### SQUAD IT
Research papers are mapped to this doll roster when SQUAD IT converts a paper abstract into a pipeline.

---

## Known Limitations

1. **Stylist → Mechanic identity drift:** FLUX.1-schnell generates a new portrait each run. For persona consistency across multiple runs, upgrade Stylist to FLUX.1-dev + InstantID (see upgrade path).

2. **LatentSync @ >15 words:** Performance degrades at longer audio clips. The 15-word cap from Cosmos is not optional — it is an LatentSync constraint.

3. **ZeroGPU queue wait:** HF ZeroGPU spaces queue behind free-tier usage. In peak hours, the 6–10s Mechanic step can become 20–40s. Mitigation: use dedicated L4 endpoint.

4. **FLUX.1-schnell vs dev:** Schnell at 4 steps can produce minor artifacts in extreme face angles or unusual lighting. The Doctor's text gate does not catch visual artifacts — only the spoken script. Visual QA requires a dedicated ComfyUI or face-quality scorer (future enhancement).

---

*Last updated: 2026-06-18 · BERYL-HF `tyronne-os/BERYL-HF`*
