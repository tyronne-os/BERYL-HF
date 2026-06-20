"""
BERYL QUANTUM RECOLLECTION
==========================
HER-2013-style persistent memory for Amanda — stored 100% LOCALLY on this device
(NOT HuggingFace, NOT USB) for maximum privacy + reliability + speed.

Storage root: %LOCALAPPDATA%\\BerylLab\\quantum_recollection\\users\\{uid}\\
  episodic.json     — every conversation turn (vector + salience + recall count)
  profile.json      — durable semantic facts about the user
  relationship.json — rapport, session count, recent opening lines, last summary

Deliberately OUTSIDE the repo and OUTSIDE the backend file-watch dir, so:
  • memory writes never trigger uvicorn --reload restarts
  • private memories can never be committed to git

Embeddings use HF inference (sentence-transformers/all-MiniLM-L6-v2, 384-dim) with a
deterministic local hash fallback — so recall NEVER crashes a conversation.

Recall score = 0.55*similarity + 0.25*salience + 0.20*recency.
Recalled memories are reinforced; the rest gently decay (human-like forgetting).
"""
import os
import re
import json
import math
import time
import hashlib

from huggingface_hub import InferenceClient

# ── storage location (local, private, outside repo + watch dir) ──────────────
_ROOT = os.path.join(
    os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"),
    "BerylLab", "quantum_recollection",
)
_EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
_DIM = 384

# in-process cache: uid -> {"episodic":..., "profile":..., "relationship":...}
_CACHE: dict = {}
_client_cache: dict = {}


# ── low-level fs helpers ─────────────────────────────────────────────────────
def _user_dir(uid: str) -> str:
    d = os.path.join(_ROOT, "users", re.sub(r"[^a-zA-Z0-9_-]", "_", uid or "anon"))
    os.makedirs(d, exist_ok=True)
    return d

def _read_json(path: str, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _write_json(path: str, data) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)  # atomic on Windows

def _load(uid: str) -> dict:
    if uid in _CACHE:
        return _CACHE[uid]
    d = _user_dir(uid)
    blob = {
        "episodic": _read_json(os.path.join(d, "episodic.json"), {"turns": []}),
        "profile": _read_json(os.path.join(d, "profile.json"),
                              {"uid": uid, "facts": [], "updated": None}),
        "relationship": _read_json(os.path.join(d, "relationship.json"), {
            "uid": uid, "sessions": 0, "rapport": 0.30,
            "first_seen": None, "last_seen": None,
            "last_summary": "", "recent_openings": [],
        }),
    }
    _CACHE[uid] = blob
    return blob

def _save(uid: str, which: str = "all") -> None:
    blob = _CACHE.get(uid)
    if not blob:
        return
    d = _user_dir(uid)
    if which in ("all", "episodic"):
        _write_json(os.path.join(d, "episodic.json"), blob["episodic"])
    if which in ("all", "profile"):
        _write_json(os.path.join(d, "profile.json"), blob["profile"])
    if which in ("all", "relationship"):
        _write_json(os.path.join(d, "relationship.json"), blob["relationship"])


# ── embeddings (HF with local fallback) ──────────────────────────────────────
def _to_vec(v):
    try:
        v = v.tolist()
    except AttributeError:
        pass
    if v and isinstance(v[0], (list, tuple)):          # token-level → mean pool
        n = len(v); dim = len(v[0])
        return [sum(row[i] for row in v) / n for i in range(dim)]
    return [float(x) for x in v]

def _hash_embed(text: str, dim: int = _DIM):
    vec = [0.0] * dim
    for t in re.findall(r"[a-z0-9]+", (text or "").lower()):
        h = int(hashlib.md5(t.encode()).hexdigest(), 16)
        vec[h % dim] += 1.0
        vec[(h // dim) % dim] += 0.5
    return vec

def _embed(text: str):
    """Returns (vector, method). HF MiniLM if reachable, else local hash."""
    token = os.getenv("HF_TOKEN", "")
    if token:
        try:
            c = _client_cache.get("emb")
            if c is None:
                c = InferenceClient(token=token, provider="hf-inference")
                _client_cache["emb"] = c
            v = _to_vec(c.feature_extraction(text[:2000], model=_EMBED_MODEL))
            if v:
                return v, "minilm"
        except Exception:
            pass
    return _hash_embed(text), "hash"

def _cos(a, b) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


# ── salience (how memorable is this line?) ───────────────────────────────────
_SALIENT = re.compile(
    r"\b(i|my|me|name|love|hate|feel|important|remember|never|always|build|"
    r"project|beryl|amanda|dream|goal|prefer|favorite|family|fear|excited|"
    r"proud|privacy|engineer|prototype)\b", re.I)

def _salience(text: str) -> float:
    t = text or ""
    s = 0.30
    s += min(0.20, len(t) / 600.0)
    s += 0.10 if "?" in t else 0.0
    s += min(0.25, 0.05 * len(_SALIENT.findall(t)))
    s += min(0.10, 0.03 * len(re.findall(r"\b[A-Z][a-z]+\b", t)))  # named entities
    return max(0.05, min(1.0, s))


# ── public API ───────────────────────────────────────────────────────────────
def remember(uid: str, role: str, text: str, salience: float = None) -> None:
    if not text or not text.strip():
        return
    blob = _load(uid)
    vec, method = _embed(text)
    blob["episodic"]["turns"].append({
        "ts": time.time(),
        "role": role,
        "text": text.strip(),
        "vector": vec,
        "method": method,
        "salience": _salience(text) if salience is None else float(salience),
        "recalls": 0,
    })
    # cap raw episodic store (reflection prunes harder)
    blob["episodic"]["turns"] = blob["episodic"]["turns"][-400:]
    _save(uid, "episodic")

def recall(uid: str, query: str, k: int = 5) -> list:
    blob = _load(uid)
    turns = blob["episodic"]["turns"]
    if not turns:
        return []
    qvec, qmethod = _embed(query)
    now = time.time()
    scored = []
    for t in turns:
        sim = _cos(qvec, t.get("vector")) if t.get("method") == qmethod else 0.0
        age_h = max(0.0, (now - t.get("ts", now)) / 3600.0)
        recency = math.exp(-age_h / 72.0)            # ~3-day soft half-life
        score = 0.55 * sim + 0.25 * t.get("salience", 0.3) + 0.20 * recency
        scored.append((score, sim, t))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:k]
    # reinforce recalled, gently decay the rest
    top_ids = {id(t) for _, _, t in top}
    for t in turns:
        if id(t) in top_ids:
            t["salience"] = min(1.0, t.get("salience", 0.3) + 0.05)
            t["recalls"] = t.get("recalls", 0) + 1
        else:
            t["salience"] = max(0.02, t.get("salience", 0.3) * 0.999)
    _save(uid, "episodic")
    return [{"text": t["text"], "role": t["role"], "score": round(sc, 3),
             "salience": round(t.get("salience", 0), 3)} for sc, sim, t in top]

def recall_context(uid: str, query: str, k: int = 5) -> str:
    """Formatted memory block for injection into Amanda's system prompt."""
    blob = _load(uid)
    facts = blob["profile"].get("facts", [])
    rel = blob["relationship"]
    mems = recall(uid, query, k)
    lines = []
    if facts:
        lines.append("WHAT YOU KNOW ABOUT THEM:\n- " + "\n- ".join(facts[:12]))
    if rel.get("last_summary"):
        lines.append("LAST TIME YOU SPOKE:\n" + rel["last_summary"])
    if mems:
        lines.append("RELEVANT MEMORIES (recalled):\n- " +
                     "\n- ".join(f'{m["role"]}: {m["text"]}' for m in mems))
    if rel.get("sessions"):
        lines.append(f"You have shared {rel['sessions']} session(s); "
                     f"rapport is {round(rel.get('rapport',0)*100)}%.")
    return "\n\n".join(lines)

def seed_user(uid: str, facts: list, rapport: float = 0.40) -> bool:
    """Seed a brand-new user's profile once. Returns True if seeded."""
    blob = _load(uid)
    if blob["profile"].get("facts"):
        return False
    blob["profile"]["facts"] = list(facts)
    blob["profile"]["updated"] = time.time()
    blob["relationship"]["rapport"] = max(blob["relationship"].get("rapport", 0), rapport)
    if not blob["relationship"].get("first_seen"):
        blob["relationship"]["first_seen"] = time.time()
    _save(uid, "all")
    return True

def bump_session(uid: str) -> dict:
    blob = _load(uid)
    rel = blob["relationship"]
    rel["sessions"] = rel.get("sessions", 0) + 1
    rel["last_seen"] = time.time()
    if not rel.get("first_seen"):
        rel["first_seen"] = time.time()
    rel["rapport"] = min(1.0, rel.get("rapport", 0.3) + 0.03)  # grows with each visit
    _save(uid, "relationship")
    return rel

def pick_flavor(uid: str) -> tuple:
    """A greeting flavor + the recent opening lines to avoid repeating."""
    import random
    pool = [
        "playful and bright", "reflective and warm", "excited about the progress we've made",
        "curious about what we'll build today", "grounded and genuinely glad to see them",
        "proud of how far the project has come", "scientifically enthusiastic",
        "a little mischievous", "calm and present", "energized and ready",
    ]
    rel = _load(uid)["relationship"]
    return random.choice(pool), rel.get("recent_openings", [])[-8:]

def record_opening(uid: str, line: str) -> None:
    blob = _load(uid)
    ro = blob["relationship"].setdefault("recent_openings", [])
    ro.append((line or "")[:80])
    blob["relationship"]["recent_openings"] = ro[-8:]
    _save(uid, "relationship")

def reflect(uid: str, llm_fn) -> dict:
    """On SLEEP: consolidate recent turns into durable profile facts + a relationship
    summary via the LLM, then decay/prune episodic memory (human-like)."""
    blob = _load(uid)
    turns = blob["episodic"]["turns"]
    recent = turns[-16:]
    summary = ""
    new_facts = []
    if recent:
        convo = "\n".join(f'{t["role"]}: {t["text"]}' for t in recent)
        existing = "; ".join(blob["profile"].get("facts", [])) or "none yet"
        system = (
            "You are Amanda's memory-consolidation subconscious. From the conversation, "
            "extract DURABLE facts about the human worth remembering long-term (identity, "
            "preferences, goals, feelings, relationship). Do NOT repeat facts already known. "
            "Return ONLY JSON: {\"facts\": [\"...\"], \"summary\": \"one warm 1-2 sentence "
            "recap of this session from Amanda's point of view\"}."
        )
        user = f"ALREADY KNOWN: {existing}\n\nCONVERSATION:\n{convo}\n\nConsolidate."
        try:
            raw = llm_fn(system, user)
            m = re.search(r"\{[\s\S]*\}", raw)
            if m:
                parsed = json.loads(m.group(0))
                new_facts = [f.strip() for f in parsed.get("facts", []) if f.strip()]
                summary = (parsed.get("summary") or "").strip()
        except Exception:
            pass
    # merge facts (dedup, cap)
    facts = blob["profile"].get("facts", [])
    low = {f.lower() for f in facts}
    for f in new_facts:
        if f.lower() not in low:
            facts.append(f); low.add(f.lower())
    blob["profile"]["facts"] = facts[-40:]
    blob["profile"]["updated"] = time.time()
    if summary:
        blob["relationship"]["last_summary"] = summary
    # decay + prune episodic (forgetting): keep recent 60 regardless; drop faded olds
    now = time.time()
    kept = []
    for i, t in enumerate(turns):
        t["salience"] = t.get("salience", 0.3) * 0.97
        age_days = (now - t.get("ts", now)) / 86400.0
        if i >= len(turns) - 60 or not (t["salience"] < 0.12 and age_days > 30):
            kept.append(t)
    blob["episodic"]["turns"] = kept
    _save(uid, "all")
    return {"new_facts": new_facts, "summary": summary,
            "total_facts": len(blob["profile"]["facts"]),
            "rapport": blob["relationship"].get("rapport", 0)}

def summary(uid: str) -> dict:
    """For the SCIENCE-drawer memory panel."""
    blob = _load(uid)
    rel = blob["relationship"]
    turns = blob["episodic"]["turns"]
    return {
        "uid": uid,
        "rapport": round(rel.get("rapport", 0), 3),
        "sessions": rel.get("sessions", 0),
        "first_seen": rel.get("first_seen"),
        "last_seen": rel.get("last_seen"),
        "last_summary": rel.get("last_summary", ""),
        "facts": blob["profile"].get("facts", []),
        "episodic_count": len(turns),
        "recent_turns": [{"role": t["role"], "text": t["text"][:160]} for t in turns[-6:]],
        "storage": _user_dir(uid),
    }
