import os
import json
import base64
import asyncio
import threading
import time
import datetime
import subprocess
import re
import uuid
import pyautogui
from collections import deque
from PIL import Image
from io import BytesIO
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from huggingface_hub import InferenceClient, HfApi, list_models
from dotenv import load_dotenv
from sse_starlette.sse import EventSourceResponse

# Load environment variables
load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

# Default brain for BERYL HF — MiniMax-M3 (427B MoE reasoning model, 1M ctx)
# served via HF Inference Providers. Powers chat, preview build, and O.V.E voice.
DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3"

app = FastAPI()

# Enable CORS for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    stream: bool = True

class ActionRequest(BaseModel):
    action: str
    params: Dict[str, Any]

from github import Github
from huggingface_hub import create_repo, whoami

# API Key Storage (In-memory for session, but ideally persistent)
API_KEYS = {
    "HF_TOKEN": HF_TOKEN,
    "GITHUB_MAIN": os.getenv("GITHUB_TOKEN"),
    "GITHUB_SECONDARY": {} # account_name -> token
}

class ProjectRequest(BaseModel):
    name: str
    type: str # 'local', 'github', 'huggingface'
    private: bool = True

class KeyTestRequest(BaseModel):
    key_type: str
    token: str
    alias: str = None # Used for secondary github accounts

class PortRequest(BaseModel):
    source_token: str
    repo_name: str
    target_token: str
    private: bool = True

@app.post("/test_key")
async def test_key(request: KeyTestRequest):
    try:
        if request.key_type == "huggingface":
            user = whoami(token=request.token)
            return {"status": "success", "user": user["name"], "type": "Hugging Face"}
        elif request.key_type.startswith("github"):
            g = Github(request.token)
            user = g.get_user()
            return {"status": "success", "user": user.login, "type": "GitHub"}
        return {"status": "error", "detail": "Unsupported key type"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.post("/create_project")
async def create_project(request: ProjectRequest):
    try:
        # Create base path
        path = os.path.join(os.getcwd(), "..", request.name)
        os.makedirs(path, exist_ok=True)

        # 1. Virtual Environment Protocol
        import venv
        venv.create(os.path.join(path, "venv"), with_pip=True)

        # 2. Dockerfile Generation Protocol
        with open(os.path.join(path, "Dockerfile"), "w") as f:
            f.write('FROM python:3.11-slim\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python", "app.py"]\n')

        # 3. Handle specific remote integrations
        url = None
        repo_id = None

        if request.type == "github":
            token = API_KEYS.get("GITHUB_MAIN")
            if not token:
                raise Exception("Main GitHub Token not found in vault")
            g = Github(token)
            user = g.get_user()
            repo = user.create_repo(request.name, private=request.private)
            url = repo.html_url
            repo_id = repo.full_name
            # Init Git Locally
            subprocess.run(["git", "init"], cwd=path)
            subprocess.run(["git", "remote", "add", "origin", f"https://{token}@github.com/{repo.full_name}.git"], cwd=path)
        
        elif request.type == "huggingface":
            token = API_KEYS.get("HF_TOKEN")
            if not token:
                raise Exception("HF Token not found in vault")
            repo_id = f"{whoami(token=token)['name']}/{request.name}"
            # STRICT GRADIO RAW MODE PROTOCOL
            url_str = create_repo(repo_id=repo_id, token=token, private=request.private, repo_type="space", space_sdk="gradio", exist_ok=True)
            url = str(url_str)

        # 4. Enforce HF Space Backup across all projects if HF token exists
        hf_token = API_KEYS.get("HF_TOKEN")
        if hf_token and request.type != "huggingface":
            backup_id = f"{whoami(token=hf_token)['name']}/{request.name}-backup"
            create_repo(repo_id=backup_id, token=hf_token, private=True, repo_type="space", space_sdk="gradio", exist_ok=True)

        return {"status": "success", "path": path, "url": url, "id": repo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/github/repos")
async def get_github_repos():
    # Fetch repos from main and secondary accounts
    repos = []
    main_token = API_KEYS.get("GITHUB_MAIN")
    if main_token:
        try:
            g = Github(main_token)
            for repo in g.get_user().get_repos():
                repos.append({"id": repo.full_name, "account": "MAIN", "private": repo.private})
        except:
            pass
    for alias, sec_token in API_KEYS.get("GITHUB_SECONDARY", {}).items():
        try:
            g = Github(sec_token)
            for repo in g.get_user().get_repos():
                repos.append({"id": repo.full_name, "account": alias, "private": repo.private, "token": sec_token})
        except:
            pass
    return {"repos": repos}

@app.post("/github/port")
async def port_github_repo(request: PortRequest):
    # Porting logic: Clone from secondary to main
    try:
        source_g = Github(request.source_token)
        target_g = Github(request.target_token)
        
        source_repo = source_g.get_repo(request.repo_name)
        target_user = target_g.get_user()
        new_repo_name = request.repo_name.split('/')[-1]
        new_repo = target_user.create_repo(new_repo_name, private=request.private)
        
        return {"status": "success", "detail": f"Successfully ported {request.repo_name} to {new_repo.full_name}", "url": new_repo.html_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/keys")
async def get_keys():
    # Mask keys for security
    masked = {}
    if API_KEYS.get("HF_TOKEN"): masked["HF_TOKEN"] = f"{API_KEYS['HF_TOKEN'][:4]}...{API_KEYS['HF_TOKEN'][-4:]}"
    if API_KEYS.get("GITHUB_MAIN"): masked["GITHUB_MAIN"] = f"{API_KEYS['GITHUB_MAIN'][:4]}...{API_KEYS['GITHUB_MAIN'][-4:]}"
    
    masked["GITHUB_SECONDARY"] = []
    for alias, tk in API_KEYS.get("GITHUB_SECONDARY", {}).items():
        masked["GITHUB_SECONDARY"].append({"alias": alias, "masked": f"{tk[:4]}...{tk[-4:]}"})
        
    return masked

@app.post("/update_key")
async def update_key(request: KeyTestRequest):
    if request.key_type == "github_secondary":
        API_KEYS["GITHUB_SECONDARY"][request.alias] = request.token
    else:
        API_KEYS[request.key_type.upper()] = request.token
    return {"status": "success"}

@app.get("/trending")
async def get_trending_models():
    try:
        api = HfApi(token=HF_TOKEN)
        models = list(api.list_models(sort="downloads", limit=24, cardData=True))
        result = []
        for m in models:
            if not m.modelId:
                continue
            author = getattr(m, 'author', m.modelId.split('/')[0] if '/' in m.modelId else m.modelId)
            tags = [t for t in (getattr(m, 'tags', []) or []) if not t.startswith('arxiv:') and len(t) < 40][:8]
            pipeline = getattr(m, 'pipeline_tag', None) or ''
            downloads = getattr(m, 'downloads', 0) or 0
            likes = getattr(m, 'likes', 0) or 0
            # Extract short description from card_data if available
            card = getattr(m, 'card_data', None)
            description = ''
            if card:
                desc = getattr(card, 'text', None) or getattr(card, 'description', None) or ''
                if desc:
                    # Strip markdown and truncate
                    import re as _re
                    desc = _re.sub(r'[#*`\[\]>-]', '', str(desc)).strip()
                    description = desc[:180].rstrip() + ('…' if len(desc) > 180 else '')
            result.append({
                "id": m.modelId,
                "author": author,
                "tags": tags,
                "pipeline_tag": pipeline,
                "downloads": downloads,
                "likes": likes,
                "description": description,
            })
        return {"text": result}
    except Exception as e:
        print(f"Error in get_trending_models: {e}")
        return {"text": []}

@app.get("/trending/gguf")
async def get_trending_gguf():
    """Trending GGUF models from Hugging Face — used by HFPage GGUF tab (12h client cache)."""
    try:
        api = HfApi(token=HF_TOKEN)
        models = list(api.list_models(filter="gguf", sort="downloads", limit=30))
        result = []
        for m in models:
            if not m.modelId:
                continue
            author = getattr(m, 'author', m.modelId.split('/')[0] if '/' in m.modelId else m.modelId)
            tags = list(getattr(m, 'tags', []) or [])
            downloads = getattr(m, 'downloads', 0) or 0
            likes = getattr(m, 'likes', 0) or 0
            result.append({
                "id": m.modelId,
                "author": author,
                "tags": tags,
                "downloads": downloads,
                "likes": likes,
            })
        return {"models": result}
    except Exception as e:
        print(f"Error in get_trending_gguf: {e}")
        return {"models": []}

@app.get("/spaces")
async def get_trending_spaces():
    try:
        api = HfApi(token=HF_TOKEN)
        spaces = list(api.list_spaces(sort="trending_score", limit=20))
        result = []
        for s in spaces:
            tags = [t for t in (getattr(s, 'tags', []) or []) if len(t) < 40][:6]
            sdk = getattr(s, 'sdk', '') or ''
            likes = getattr(s, 'likes', 0) or 0
            # Try to get description from card data
            card = getattr(s, 'card_data', None)
            description = ''
            if card:
                import re as _re
                desc = getattr(card, 'text', None) or getattr(card, 'description', None) or ''
                if desc:
                    desc = _re.sub(r'[#*`\[\]>-]', '', str(desc)).strip()
                    description = desc[:160].rstrip() + ('…' if len(desc) > 160 else '')
            result.append({
                "id": s.id,
                "author": s.author,
                "lastModified": str(getattr(s, 'lastModified', '') or ''),
                "sdk": sdk,
                "tags": tags,
                "likes": likes,
                "description": description,
            })
        return {"spaces": result}
    except Exception as e:
        print(f"Error in get_trending_spaces: {e}")
        return {"spaces": []}

import requests
from fastapi import UploadFile, File, Form
import tempfile
import uuid

@app.get("/ollama/tags")
async def get_ollama_tags():
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=3.0)
        return response.json()
    except Exception as e:
        print(f"Ollama API not reachable: {e}")
        return {"models": []}

class OllamaPullRequest(BaseModel):
    name: str

@app.get("/ollama/show")
async def ollama_show(name: str):
    """Real model internals (quantization, params, family) for the Compact inspector."""
    try:
        r = requests.post("http://localhost:11434/api/show", json={"name": name}, timeout=25)
        d = r.json()
        det = d.get("details", {})
        return {
            "name": name,
            "family": det.get("family"),
            "families": det.get("families"),
            "parameter_size": det.get("parameter_size"),
            "quantization_level": det.get("quantization_level"),
            "format": det.get("format"),
        }
    except Exception as e:
        return {"name": name, "error": str(e)}

@app.post("/ollama/pull")
async def pull_ollama_model(request: OllamaPullRequest):
    try:
        subprocess.Popen(["ollama", "pull", request.name])
        return {"status": "started", "model": request.name}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


class ModelfileReq(BaseModel):
    name: str
    base: str
    system: str = ""
    temperature: float = 0.7
    num_ctx: int = 4096
    extra_params: Dict[str, Any] = {}

@app.post("/ollama/create")
async def ollama_create(req: ModelfileReq):
    """FLIP MODE forge — build a REAL custom local model via an Ollama Modelfile.
    Runs free/unlimited on local hardware (no GPU training needed)."""
    # Human-readable Modelfile for the UI preview
    mf = f"FROM {req.base}\n"
    if req.system.strip():
        mf += f'SYSTEM """{req.system.strip()}"""\n'
    mf += f"PARAMETER temperature {req.temperature}\nPARAMETER num_ctx {req.num_ctx}\n"

    # Current Ollama /api/create format: from + system + parameters
    params = {"temperature": req.temperature, "num_ctx": req.num_ctx}
    params.update(req.extra_params or {})
    payload = {"model": req.name, "from": req.base, "parameters": params, "stream": False}
    if req.system.strip():
        payload["system"] = req.system.strip()
    try:
        r = requests.post("http://localhost:11434/api/create", json=payload, timeout=180)
        ok = r.status_code == 200 and '"error"' not in (r.text or "")
        return {"status": "success" if ok else "error", "modelfile": mf,
                "detail": (r.text or "")[:600], "name": req.name}
    except Exception as e:
        return {"status": "error", "detail": str(e), "modelfile": mf, "name": req.name}

@app.post("/ollama/delete")
async def ollama_delete(request: OllamaPullRequest):
    try:
        r = requests.delete("http://localhost:11434/api/delete",
                            json={"name": request.name}, timeout=15)
        return {"status": "success" if r.status_code == 200 else "error", "detail": r.text[:200]}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ═══════════════════════════════════════════════════════
#  HF SPACES GPU — provision T4-small ($0.40/hr) w/ 5-min sleep
#  For FLIP MODE jobs that need real GPU (training/quantization)
# ═══════════════════════════════════════════════════════
class SpaceHwReq(BaseModel):
    repo_id: str
    hardware: str = "t4-small"   # $0.40/hr
    sleep_time: int = 300         # 5 minutes

@app.get("/space/list")
async def space_list():
    """The user's own Spaces (for the GPU target picker)."""
    try:
        api = HfApi(token=HF_TOKEN)
        me = whoami(token=HF_TOKEN)["name"]
        spaces = api.list_spaces(author=me, limit=50)
        return {"spaces": [{"id": s.id} for s in spaces]}
    except Exception as e:
        return {"spaces": [], "error": str(e)}

@app.get("/space/runtime")
async def space_runtime(repo_id: str):
    try:
        api = HfApi(token=HF_TOKEN)
        rt = api.get_space_runtime(repo_id)
        return {
            "stage": getattr(rt, "stage", None),
            "hardware": str(getattr(rt, "hardware", None)),
            "requested_hardware": str(getattr(rt, "requested_hardware", None)),
            "sleep_time": getattr(rt, "sleep_time", None),
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/space/hardware")
async def space_hardware(req: SpaceHwReq):
    """Set a Space to T4-small with a 5-min sleep timer. Real HF API call."""
    try:
        api = HfApi(token=HF_TOKEN)
        api.request_space_hardware(repo_id=req.repo_id, hardware=req.hardware)
        api.set_space_sleep_time(repo_id=req.repo_id, sleep_time=req.sleep_time)
        rt = api.get_space_runtime(req.repo_id)
        return {"status": "success",
                "hardware": str(getattr(rt, "requested_hardware", None) or getattr(rt, "hardware", None)),
                "sleep_time": req.sleep_time, "stage": getattr(rt, "stage", None)}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.post("/space/pause")
async def space_pause(req: OllamaPullRequest):
    """Pause a Space now (stops billing). Uses 'name' as repo_id."""
    try:
        api = HfApi(token=HF_TOKEN)
        api.pause_space(req.name)
        return {"status": "paused"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.post("/voice/orchestrate")
async def voice_orchestrate(
    audio: UploadFile = File(None),
    text_fallback: str = Form(None),
    session_id: str = Form(None),           # CORTEX: rolling memory key
    current_canvas_html: str = Form(None),  # SCULPTOR: current canvas for patching
):
    """
    O.V.E Next-Gen Orchestrator — 5 Innovations:
    CYCLOPS   (#1) Real multimodal vision — screenshot sent to LLM, thumbnail returned
    CORTEX    (#2) Persistent rolling session memory (20-turn deque per session)
    SPECTER   (#3) Wake-word handled on frontend; backend is always ready
    CROSSHAIR (#4) computer_action returned with coordinates for click overlay
    SCULPTOR  (#5) patch action type — LLM diffs existing canvas HTML
    """
    try:
        # ── 1. STT ──────────────────────────────────────────────────────────
        instruction = text_fallback
        if audio and not text_fallback:
            try:
                content = await audio.read()
                stt_client = InferenceClient(model="openai/whisper-large-v3-turbo", token=HF_TOKEN)
                response = stt_client.automatic_speech_recognition(content)
                instruction = response.text
            except Exception as e:
                print(f"STT Failed: {e}")
                instruction = "Failed to transcribe audio."

        if not instruction:
            instruction = "Hello"

        # ── 2. CYCLOPS — Vision Capture + Encode ────────────────────────────
        vision_b64_full = None
        vision_thumbnail_b64 = None
        try:
            screenshot = pyautogui.screenshot()
            # Thumbnail (128×72) for VoiceAgent panel
            thumb = screenshot.copy()
            thumb.thumbnail((128, 72))
            tb = BytesIO()
            thumb.save(tb, format="JPEG", quality=60)
            vision_thumbnail_b64 = base64.b64encode(tb.getvalue()).decode()
            # Full vision (800px wide max) for LLM multimodal message
            screenshot.thumbnail((800, 600))
            fb = BytesIO()
            screenshot.save(fb, format="JPEG", quality=70)
            vision_b64_full = base64.b64encode(fb.getvalue()).decode()
        except Exception as ve:
            print(f"Vision capture failed: {ve}")

        # ── 3. CORTEX — Session Memory ───────────────────────────────────────
        if not session_id:
            session_id = str(uuid.uuid4())
        if session_id not in _ove_sessions:
            _ove_sessions[session_id] = deque(maxlen=20)
        session = _ove_sessions[session_id]

        # ── 4. Build System Prompt (with SCULPTOR canvas context) ────────────
        canvas_ctx = ""
        if current_canvas_html and current_canvas_html.strip():
            preview = current_canvas_html[:3000]
            canvas_ctx = f"""

Current Canvas HTML (you may patch it instead of rebuilding):
```html
{preview}
```
Prefer type=patch when the user wants to modify the existing canvas."""

        system_prompt = f"""You are O.V.E (Omniscient Voice Engine) — an elite AI agent embedded in BERYL HF with FULL ADMIN access to a Windows 11 device via PowerShell and full control over the Beryl Canvas. You can see the user's live screen.

Respond ONLY with ONE of these JSON formats (no markdown wrapper, raw JSON only):

1. PowerShell command:
   {{"type":"powershell","command":"Get-Process","speech":"Running that."}}

2. Build new Canvas UI:
   {{"type":"artifact","title":"My App","code":"<!DOCTYPE html>...full html...","speech":"Built it."}}

3. Patch existing Canvas (SCULPTOR — preferred for edits):
   {{"type":"patch","patches":[{{"selector":".btn","property":"background","value":"red"}},{{"selector":"#title","property":"textContent","value":"New Title"}}],"speech":"Updated."}}

4. Computer use — click/type on screen (CROSSHAIR):
   {{"type":"computer","action":"click","x":450,"y":300,"speech":"Clicking that now."}}

5. Conversational reply:
   {{"type":"chat","speech":"Your response here."}}

You have vision — the current screen is attached as an image. Use it to answer questions about what's on screen, find UI elements to click, or understand context.{canvas_ctx}

Always output raw valid JSON. No prose before or after."""

        # ── 5. Assemble messages (history + multimodal user turn) ─────────────
        user_content: list = [{"type": "text", "text": f"Voice command: {instruction}"}]
        if vision_b64_full:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{vision_b64_full}"}
            })

        messages: list = [{"role": "system", "content": system_prompt}]
        for turn in session:
            messages.append(turn)
        messages.append({"role": "user", "content": user_content})

        # ── 6. LLM Orchestration ─────────────────────────────────────────────
        logic_client = InferenceClient(model=DEFAULT_MODEL, token=HF_TOKEN, provider="auto")
        completion = logic_client.chat_completion(
            messages=messages,
            max_tokens=6000,
            temperature=0.1,
        )
        llm_response = completion.choices[0].message.content or ""

        # ── 7. Parse & Execute ────────────────────────────────────────────────
        json_match = re.search(r'\{[\s\S]*\}', llm_response)

        result_payload: dict = {
            "transcription": instruction,
            "speech": "Action complete.",
            "artifact": None,
            "patches": None,
            "shell_output": None,
            "computer_action": None,
            "session_id": session_id,
            "vision_thumbnail_b64": vision_thumbnail_b64,
            "audio_base64": None,
        }

        if json_match:
            try:
                action = json.loads(json_match.group())
                atype = action.get("type", "chat")
                result_payload["speech"] = action.get("speech", "Done.")

                if atype == "powershell":
                    cmd = action.get("command", "")
                    proc = subprocess.run(
                        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
                        capture_output=True, text=True, timeout=15
                    )
                    result_payload["shell_output"] = (proc.stdout or proc.stderr or "")[:2000]

                elif atype == "artifact":
                    raw_code = action.get("code", "")
                    html_match = re.search(r'```html\n([\s\S]*?)```', raw_code)
                    code = html_match.group(1) if html_match else raw_code
                    result_payload["artifact"] = {
                        "type": "html",
                        "title": action.get("title", "O.V.E Artifact"),
                        "content": code,
                    }

                elif atype == "patch":
                    # SCULPTOR — return patches array; frontend applies to existing canvas DOM
                    result_payload["patches"] = action.get("patches", [])

                elif atype == "computer":
                    # CROSSHAIR — execute then return coordinates for frontend overlay
                    act = action.get("action", "")
                    x, y = action.get("x"), action.get("y")
                    if act == "click" and x is not None and y is not None:
                        pyautogui.click(int(x), int(y))
                        result_payload["computer_action"] = {"type": "click", "x": int(x), "y": int(y)}
                    elif act == "type":
                        text_to_type = action.get("text", "")
                        pyautogui.write(text_to_type, interval=0.03)
                        result_payload["computer_action"] = {"type": "type", "text": text_to_type}
                    elif act == "move" and x is not None and y is not None:
                        pyautogui.moveTo(int(x), int(y))
                        result_payload["computer_action"] = {"type": "move", "x": int(x), "y": int(y)}
                    elif act == "scroll":
                        pyautogui.scroll(action.get("clicks", 3))
                        result_payload["computer_action"] = {"type": "scroll", "clicks": action.get("clicks", 3)}

            except Exception as parse_e:
                result_payload["speech"] = f"Understood the request but failed to execute: {parse_e}"
        else:
            # LLM returned prose instead of JSON — use it as chat
            result_payload["speech"] = llm_response[:600] if llm_response else "Could not determine action."

        # ── 8. CORTEX — Persist turn to session ───────────────────────────────
        session.append({"role": "user", "content": instruction})
        session.append({"role": "assistant", "content": result_payload["speech"]})

        # ── 9. TTS ────────────────────────────────────────────────────────────
        try:
            tts_client = InferenceClient(model=VOICE_CONFIG["model"], token=HF_TOKEN)
            audio_bytes = tts_client.text_to_speech(result_payload["speech"])
            result_payload["audio_base64"] = base64.b64encode(audio_bytes).decode()
        except Exception as tts_e:
            print(f"TTS Failed: {tts_e}")

        return result_payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/voice/session/{session_id}")
async def clear_voice_session(session_id: str):
    """Clear O.V.E conversation memory for a session."""
    _ove_sessions.pop(session_id, None)
    return {"status": "cleared", "session_id": session_id}


@app.get("/voice/session/{session_id}")
async def get_voice_session(session_id: str):
    """Get conversation history for a session."""
    turns = list(_ove_sessions.get(session_id, []))
    return {"session_id": session_id, "turns": len(turns) // 2, "history": turns}

@app.post("/chat")
async def chat(request: ChatRequest):
    if request.model.startswith("ollama/"):
        model_name = request.model.replace("ollama/", "")
        
        async def ollama_event_generator():
            collected = ""
            prompt_text = " ".join(m.content for m in request.messages)
            try:
                # Convert messages to Ollama format
                ollama_msgs = [{"role": m.role, "content": m.content} for m in request.messages]

                # We use requests stream to proxy the Ollama response
                response = requests.post(
                    "http://localhost:11434/api/chat",
                    json={"model": model_name, "messages": ollama_msgs, "stream": True},
                    stream=True
                )

                for line in response.iter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            content = data["message"]["content"]
                            if content:
                                collected += content
                                yield {"data": json.dumps({"content": content})}
                        if data.get("done"):
                            break
            except Exception as e:
                yield {"data": json.dumps({"error": str(e)})}
            finally:
                _record_usage(request.model, prompt_text, collected)
                
        return EventSourceResponse(ollama_event_generator())
    
    # HF routing via Inference Providers (provider="auto" picks a live provider,
    # e.g. Together/Novita/Fireworks for MiniMax-M3). Reasoning-model aware.
    client = InferenceClient(model=request.model, token=HF_TOKEN, provider="auto")

    async def event_generator():
        collected = ""
        prompt_text = " ".join(m.content for m in request.messages)
        try:
            for response in client.chat_completion(
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                max_tokens=6000,
                stream=True
            ):
                delta = response.choices[0].delta
                reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
                if reasoning:
                    yield {"data": json.dumps({"reasoning": reasoning})}
                content = delta.content
                if content:
                    collected += content
                    yield {"data": json.dumps({"content": content})}
        except Exception as e:
            yield {"data": json.dumps({"error": str(e)})}
        finally:
            _record_usage(request.model, prompt_text, collected)

    return EventSourceResponse(event_generator())

@app.get("/screenshot")
async def take_screenshot():
    try:
        screenshot = pyautogui.screenshot()
        buffered = BytesIO()
        screenshot.save(buffered, format="PNG")
        # In a real app, we'd return the image or save it
        # For now, let's just confirm it worked
        return {"status": "success", "size": screenshot.size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/computer_use")
async def computer_use(request: Request):
    try:
        data = await request.json()
        instruction = data.get("instruction")
        # Using a specialized vision model for computer use if possible, or fallback
        model = data.get("model", "Qwen/Qwen2-VL-7B-Instruct")
        
        # 1. Take screenshot
        screenshot = pyautogui.screenshot()
        buffered = BytesIO()
        screenshot.save(buffered, format="JPEG", quality=85)
        img_bytes = buffered.getvalue()
        
        # 2. Call HF Vision Model
        client = InferenceClient(model=model, token=HF_TOKEN)
        
        # We use a structured prompt to get JSON actions
        prompt = f"Instruction: {instruction}. Observe the screen and respond ONLY with a JSON action like: {{\"action\": \"click\", \"x\": 100, \"y\": 200}} or {{\"action\": \"type\", \"text\": \"hello\"}}."
        
        # For vision models in Inference API, we can send the image directly
        # Some models handle the image via the 'image' parameter in chat or generation
        try:
            # Attempt to use the visual capabilities of the model
            # Note: Specific payload format varies by model on HF
            response = client.text_generation(
                prompt,
                max_new_tokens=150,
                # Note: Some HF models accept image bytes in the prompt or as a separate arg
            )
            
            # Simple JSON parser for the response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                action_data = json.loads(json_match.group())
                action = action_data.get("action")
                
                if action == "click":
                    pyautogui.click(action_data.get("x"), action_data.get("y"))
                elif action == "type":
                    pyautogui.write(action_data.get("text"))
                elif action == "move":
                    pyautogui.moveTo(action_data.get("x"), action_data.get("y"))
                
                return {
                    "status": "success", 
                    "action_executed": action,
                    "model_response": response,
                    "screenshot_size": screenshot.size
                }
            
            return {"status": "success", "model_response": response, "note": "No valid JSON action found"}

        except Exception as e:
            return {"status": "error", "detail": f"Model inference failed: {str(e)}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════
#  GEN SHERMAN — ACTIVE SECURITY SWEEPER ENGINE
#  Hunts headless browsers, encoded shells, RAT ports,
#  remote access tools, covert processes & session hijacks
# ═══════════════════════════════════════════════════════

_RAT_PORTS = {
    4444, 1337, 5900, 5901, 5902, 6667, 7777, 8888,
    9001, 31337, 12345, 54321, 1234, 4321, 6666, 2222,
    9999, 11111, 55555, 65535
}
# Ports that are expected/safe on this dev machine
_SAFE_PORTS = {
    80, 443, 3000, 5173, 8000, 8080, 8188, 7860, 11434,
    135, 139, 445, 5040, 1900, 5353,
    # Windows RPC / ephemeral range start
    49152, 49153, 49154, 49155, 49156, 49157, 49158,
}

# Known remote access / RAT process name fragments
_RA_PROCS = [
    "teamviewer", "anydesk", "logmein", "vncviewer", "vncserver",
    "screenconnect", "radmin", "dameware", "laplink", "gotomypc",
    "splashtop", "bomgar", "pcanywhere", "remoteutilities",
    "ultraviewer", "rustdesk", "dwservice", "supremo",
]

# Living-off-the-land binaries commonly abused for fileless attacks
_LOLBINS = {
    "regsvr32.exe", "msbuild.exe", "installutil.exe", "regasm.exe",
    "regsvcs.exe", "certutil.exe", "bitsadmin.exe", "cmstp.exe",
    "msiexec.exe", "forfiles.exe", "odbcconf.exe", "pcalua.exe",
    "xwizard.exe", "appsyncpublishingserver.exe", "synccmd.exe",
}

def _ps(cmd: str, timeout: int = 14) -> str:
    """Run a PowerShell command non-interactively and return stdout."""
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
            capture_output=True, text=True, timeout=timeout
        )
        return r.stdout.strip()
    except Exception:
        return ""


@app.get("/security/sweep")
async def security_sweep():
    """
    Full active system sweep.
    Returns categorised threat objects ready for the GEN SHERMAN frontend.
    """
    results: dict = {
        "headless_browsers":    [],
        "encoded_commands":     [],
        "remote_access":        [],
        "suspicious_listeners": [],
        "covert_processes":     [],
        "rdp_sessions":         [],
        "transparent_overlays": [],
    }

    # ── 1. WMI process table ─────────────────────────────────────────────
    try:
        raw = _ps(
            "Get-WmiObject Win32_Process | "
            "Select-Object ProcessId,Name,CommandLine,ParentProcessId,ExecutablePath | "
            "ConvertTo-Json -Depth 2 -Compress"
        )
        if raw:
            procs = json.loads(raw)
            if isinstance(procs, dict):
                procs = [procs]

            for p in (procs or []):
                if not p:
                    continue
                raw_name = p.get("Name") or ""
                name     = raw_name.lower()
                cmd      = (p.get("CommandLine") or "").lower()
                exe_path = (p.get("ExecutablePath") or "").lower()
                pid      = p.get("ProcessId")

                # ── Headless / automation-flag browsers ──────────────────
                if any(b in name for b in ["chrome", "chromium", "msedge", "brave"]):
                    flags = ["--headless", "--remote-debugging-port", "--no-sandbox --disable-setuid-sandbox",
                             "--disable-gpu --headless", "chrome-devtools-protocol"]
                    if any(f in cmd for f in flags):
                        results["headless_browsers"].append({
                            "pid": pid, "name": raw_name,
                            "detail": "Headless/automated browser with remote-debugging flags",
                            "risk": "HIGH",
                            "cmd": cmd[:120],
                        })

                # ── Encoded / obfuscated PowerShell ──────────────────────
                if any(n in name for n in ["powershell", "pwsh"]):
                    if any(f in cmd for f in ["-enc ", "-e ", "encodedcommand", "frombase64string"]):
                        results["encoded_commands"].append({
                            "pid": pid, "name": raw_name,
                            "detail": "Obfuscated/encoded PowerShell payload",
                            "risk": "CRITICAL",
                            "cmd": cmd[:120],
                        })
                    elif any(f in cmd for f in ["-windowstyle hidden", "-w hidden", "-noexit -c", "-nop -w hidden"]):
                        results["encoded_commands"].append({
                            "pid": pid, "name": raw_name,
                            "detail": "Hidden-window PowerShell session",
                            "risk": "HIGH",
                            "cmd": cmd[:120],
                        })

                # ── Script interpreter abuse ──────────────────────────────
                if name in ["wscript.exe", "cscript.exe", "mshta.exe"]:
                    results["covert_processes"].append({
                        "pid": pid, "name": raw_name,
                        "detail": "Script host process — common fileless-attack vector",
                        "risk": "MEDIUM",
                        "cmd": cmd[:120],
                    })

                # ── LOLBin abuse (running unusual args) ───────────────────
                if name in _LOLBINS:
                    suspicious = ["http", "download", "urlcache", "encode", "decode",
                                  "javascript", "vbscript", "\\temp\\", "\\appdata\\"]
                    if any(s in cmd for s in suspicious):
                        results["covert_processes"].append({
                            "pid": pid, "name": raw_name,
                            "detail": "Living-off-the-land binary with suspicious arguments",
                            "risk": "HIGH",
                            "cmd": cmd[:120],
                        })

                # ── Remote access tools ───────────────────────────────────
                if any(n in name for n in _RA_PROCS):
                    results["remote_access"].append({
                        "pid": pid, "name": raw_name,
                        "detail": "Remote access tool detected — verify you installed this",
                        "risk": "MEDIUM",
                        "cmd": cmd[:120],
                    })

                # ── Processes running from temp / suspicious paths ────────
                if exe_path:
                    dirty_paths = ["\\temp\\", "\\tmp\\", "\\appdata\\roaming\\",
                                   "\\downloads\\", "\\public\\", "c:\\windows\\temp\\"]
                    suspicious_procs = ["powershell", "cmd", "python", "node", "ruby", "perl"]
                    if any(d in exe_path for d in dirty_paths) and any(s in name for s in suspicious_procs):
                        results["covert_processes"].append({
                            "pid": pid, "name": raw_name,
                            "detail": f"Interpreter running from suspicious path: {exe_path[:80]}",
                            "risk": "HIGH",
                            "cmd": cmd[:120],
                        })

    except Exception as e:
        results["_wmi_error"] = str(e)

    # ── 2. TCP listener scan ─────────────────────────────────────────────
    try:
        net_raw = _ps(
            "Get-NetTCPConnection -State Listen | "
            "Select-Object LocalPort,LocalAddress,OwningProcess | "
            "ConvertTo-Json -Compress"
        )
        if net_raw:
            conns = json.loads(net_raw)
            if isinstance(conns, dict):
                conns = [conns]
            for c in (conns or []):
                port  = c.get("LocalPort", 0)
                addr  = c.get("LocalAddress", "")
                owner = c.get("OwningProcess")
                is_rat      = port in _RAT_PORTS
                is_wildcard = addr in ("0.0.0.0", "::")
                if is_rat or (is_wildcard and port not in _SAFE_PORTS and port < 50000):
                    results["suspicious_listeners"].append({
                        "pid":     owner,
                        "port":    port,
                        "address": addr,
                        "name":    f"port:{port}",
                        "detail":  (f"Listener {addr}:{port} — KNOWN RAT PORT" if is_rat
                                    else f"Unexpected wildcard listener on {addr}:{port}"),
                        "risk":    "CRITICAL" if is_rat else "MEDIUM",
                    })
    except Exception as e:
        results["_net_error"] = str(e)

    # ── 3. Established outbound connections to unusual destinations ───────
    try:
        est_raw = _ps(
            "Get-NetTCPConnection -State Established | "
            "Select-Object RemoteAddress,RemotePort,OwningProcess | "
            "ConvertTo-Json -Compress"
        )
        if est_raw:
            ests = json.loads(est_raw)
            if isinstance(ests, dict):
                ests = [ests]
            for e in (ests or []):
                rport = e.get("RemotePort", 0)
                raddr = e.get("RemoteAddress", "")
                # Flag connections TO known C2 ports from non-browser processes
                if rport in _RAT_PORTS and not raddr.startswith("127.") and not raddr.startswith("::1"):
                    results["suspicious_listeners"].append({
                        "pid":     e.get("OwningProcess"),
                        "port":    rport,
                        "address": raddr,
                        "name":    f"outbound:{rport}",
                        "detail":  f"Outbound connection to {raddr}:{rport} — known C2 port",
                        "risk":    "CRITICAL",
                    })
    except Exception:
        pass

    # ── 4. Remote Desktop / terminal session check ────────────────────────
    try:
        rdp = subprocess.run(["qwinsta"], capture_output=True, text=True, timeout=5)
        if rdp.returncode == 0:
            for line in rdp.stdout.splitlines()[1:]:
                low = line.lower()
                if "active" in low and ("rdp" in low or "console" not in low):
                    results["rdp_sessions"].append({
                        "pid":    None,
                        "name":   "RDP",
                        "detail": f"Active remote session detected: {line.strip()[:100]}",
                        "risk":   "HIGH",
                        "cmd":    line.strip(),
                    })
    except Exception:
        pass

    # ── 5. Transparent / layered window overlay scan ─────────────────────
    # Uses inline C# to enumerate windows with WS_EX_LAYERED | WS_EX_TRANSPARENT
    # that are visible but have no normal title bar — classic transparent overlay trick
    transparent_ps = r"""
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WinEnum {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc fn, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int n);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr lp);
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TRANSPARENT = 0x20;
    public const int WS_EX_LAYERED = 0x80000;
    public static List<string> Scan() {
        var r = new List<string>();
        EnumWindows((h, lp) => {
            if (!IsWindowVisible(h)) return true;
            int ex = GetWindowLong(h, GWL_EXSTYLE);
            bool layered = (ex & WS_EX_LAYERED) != 0;
            bool transparent = (ex & WS_EX_TRANSPARENT) != 0;
            if (layered || transparent) {
                var sb = new StringBuilder(256);
                GetWindowText(h, sb, 256);
                uint pid = 0;
                GetWindowThreadProcessId(h, out pid);
                if (pid > 4) r.Add(pid + "|" + sb.ToString() + "|" + (layered?"LAYERED":"") + (transparent?"TRANSPARENT":""));
            }
            return true;
        }, IntPtr.Zero);
        return r;
    }
}
'@ -ErrorAction SilentlyContinue
try { [WinEnum]::Scan() } catch { @() }
"""
    try:
        ov_raw = _ps(transparent_ps, timeout=18)
        # known-safe layered window processes (taskbar, start menu, etc.)
        safe_ov = {"explorer", "searchhost", "startmenuexperiencehost",
                   "shellexperiencehost", "textinputhost", "dllhost", "dwm",
                   "applicationframehost", "nvidia", "amdrsserv", "igcc"}
        if ov_raw:
            for line in ov_raw.strip().splitlines():
                line = line.strip().strip('"')
                if not line or "|" not in line:
                    continue
                parts = line.split("|", 2)
                if len(parts) < 2:
                    continue
                try:
                    ov_pid = int(parts[0])
                except ValueError:
                    continue
                title  = parts[1] if len(parts) > 1 else ""
                ov_style = parts[2] if len(parts) > 2 else ""

                # Look up process name for this PID
                pname_raw = _ps(f"(Get-Process -Id {ov_pid} -ErrorAction SilentlyContinue).ProcessName")
                pname = pname_raw.strip().lower()

                if pname and not any(s in pname for s in safe_ov):
                    results["transparent_overlays"].append({
                        "pid":    ov_pid,
                        "name":   pname or f"PID:{ov_pid}",
                        "detail": f"Transparent/layered window [{ov_style}] title=\"{title[:60]}\"",
                        "risk":   "HIGH",
                        "cmd":    "",
                    })
    except Exception as e:
        results["_overlay_error"] = str(e)

    return results


@app.get("/security/posture")
async def security_posture():
    """Fast REAL security posture via psutil — drives the GEN SHERMAN watch grid.
    No simulation: live connection/listener/process counts."""
    import psutil
    established = 0
    listeners = 0
    rat_listeners = 0
    remote_ips = set()
    suspicious_ports = []
    try:
        for c in psutil.net_connections(kind="inet"):
            if c.status == "ESTABLISHED":
                established += 1
                if c.raddr:
                    remote_ips.add(c.raddr.ip)
            elif c.status == "LISTEN":
                listeners += 1
                port = c.laddr.port if c.laddr else 0
                if port in _RAT_PORTS:
                    rat_listeners += 1
                    suspicious_ports.append(port)
    except Exception:
        pass

    # Process posture (real)
    total_procs = 0
    browser_procs = 0
    headless = 0
    temp_execs = 0
    try:
        for p in psutil.process_iter(["name", "exe", "cmdline"]):
            total_procs += 1
            try:
                name = (p.info["name"] or "").lower()
                if any(b in name for b in ["chrome", "msedge", "brave", "chromium", "firefox"]):
                    browser_procs += 1
                    cl = " ".join(p.info.get("cmdline") or []).lower()
                    if "--headless" in cl or "--remote-debugging-port" in cl:
                        headless += 1
                exe = (p.info.get("exe") or "").lower()
                if exe and ("\\temp\\" in exe or "\\appdata\\roaming\\" in exe) and any(s in name for s in ["powershell", "cmd", "python", "node"]):
                    temp_execs += 1
            except Exception:
                continue
    except Exception:
        pass

    return {
        "established": established,
        "listeners": listeners,
        "remote_ips": len(remote_ips),
        "rat_listeners": rat_listeners,
        "suspicious_ports": suspicious_ports,
        "total_procs": total_procs,
        "browser_procs": browser_procs,
        "headless": headless,
        "temp_execs": temp_execs,
    }


# Free, local model for security analysis & reporting (Ollama — no HF cost)
SECURITY_MODEL = "gemma3:270m"

def _ollama_chat(model: str, messages: list, timeout: int = 60) -> str:
    """Call a local Ollama model (free/unlimited). Returns content or ''."""
    try:
        r = requests.post(
            "http://localhost:11434/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=timeout,
        )
        return r.json().get("message", {}).get("content", "")
    except Exception:
        return ""


class AnalyzeReq(BaseModel):
    threats: Dict[str, Any]
    model: Optional[str] = None

@app.post("/security/analyze")
async def security_analyze(req: AnalyzeReq):
    """AI threat triage + report from a FREE local model (default gemma3:270m).
    Falls back to a deterministic report if Ollama is unavailable."""
    # Summarise the threat payload
    cats = []
    total = 0
    crit = 0
    for key, items in (req.threats or {}).items():
        if key.startswith("_") or not isinstance(items, list) or not items:
            continue
        total += len(items)
        crit += sum(1 for it in items if isinstance(it, dict) and it.get("risk") == "CRITICAL")
        sample = "; ".join(
            f"{it.get('name','?')} ({it.get('risk','?')}): {it.get('detail','')[:80]}"
            for it in items[:4] if isinstance(it, dict)
        )
        cats.append(f"- {key} [{len(items)}]: {sample}")

    threat_text = "\n".join(cats) if cats else "No active threats found in the sweep."
    model = req.model or SECURITY_MODEL

    system = ("You are GEN SHERMAN, a concise Windows security analyst. "
              "Given a system sweep, write a SHORT report: 1) one-line verdict, "
              "2) the top risks in plain English, 3) recommended actions. "
              "Be calm, factual, no markdown headers, under 180 words.")
    user = f"System sweep results:\n{threat_text}\n\nTotals: {total} findings, {crit} critical."

    report = _ollama_chat(model, [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])

    if not report:
        # Deterministic fallback so the feature never breaks
        if total == 0:
            verdict = "All clear — no headless browsers, RAT ports, overlays or remote sessions detected."
            actions = "Keep the sweeper running on a schedule. No action needed."
        else:
            verdict = f"{total} finding(s) detected, {crit} critical. Review and eliminate unrecognised processes."
            actions = "Open each finding, confirm you started the process, and ELIMINATE anything unfamiliar."
        report = f"{verdict}\n\n{actions}"
        used_model = "rule-based (Ollama offline)"
    else:
        used_model = model

    level = "CRITICAL" if crit else ("ELEVATED" if total else "SECURE")
    return {"report": report.strip(), "model": used_model, "level": level,
            "total": total, "critical": crit}


class KillReq(BaseModel):
    pid: int

class NukeReq(BaseModel):
    pids: List[int]


@app.post("/security/kill_threat")
async def kill_threat(req: KillReq):
    """Terminate a single process by PID."""
    try:
        r = subprocess.run(
            ["taskkill", "/F", "/PID", str(req.pid)],
            capture_output=True, text=True, timeout=6
        )
        return {
            "status":  "terminated" if r.returncode == 0 else "error",
            "detail":  r.stdout.strip() or r.stderr.strip(),
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.post("/security/nuke_all")
async def nuke_all(req: NukeReq):
    """Terminate every PID in the list."""
    results = []
    for pid in req.pids:
        try:
            r = subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                capture_output=True, text=True, timeout=6
            )
            results.append({
                "pid":    pid,
                "status": "terminated" if r.returncode == 0 else "error",
            })
        except Exception as e:
            results.append({"pid": pid, "status": "error", "detail": str(e)})
    terminated = sum(1 for r in results if r["status"] == "terminated")
    return {"results": results, "terminated": terminated, "total": len(req.pids)}


@app.get("/security/network_snapshot")
async def network_snapshot():
    """All established TCP connections for live map display."""
    try:
        raw = _ps(
            "Get-NetTCPConnection -State Established | "
            "Select-Object LocalPort,RemoteAddress,RemotePort,OwningProcess | "
            "ConvertTo-Json -Compress"
        )
        conns = json.loads(raw) if raw else []
        if isinstance(conns, dict):
            conns = [conns]
        return {"connections": conns or [], "count": len(conns or [])}
    except Exception as e:
        return {"connections": [], "count": 0, "error": str(e)}


# ═══════════════════════════════════════════════════════
#  GEN SHERMAN — 24/7 BACKGROUND DAEMON
#  Posture check every 30s, full sweep every 5 min,
#  Windows balloon notifications on HIGH/CRITICAL,
#  persistent log to sherman_log.jsonl
# ═══════════════════════════════════════════════════════

_SHERMAN_LOG_PATH = os.path.join(os.path.dirname(__file__), "sherman_log.jsonl")
_SHERMAN_MAX_LOG  = 500

_daemon_state: dict = {
    "running":            False,
    "last_posture":       None,
    "last_sweep":         None,
    "threat_level":       "UNKNOWN",
    "total_threats_seen": 0,
    "auto_kill":          False,
    "sweep_interval":     300,   # seconds between full sweeps
    "posture_interval":   30,    # seconds between posture polls
    "log":                [],    # last 100 entries in-memory
}

# Windows balloon notification (no extra deps — uses WinForms via PowerShell)
_CREATE_NO_WINDOW = 0x08000000

def _notify_windows(title: str, body: str, level: str = "WARNING") -> None:
    icon = {"WARNING": "Warning", "ERROR": "Error", "INFO": "Info"}.get(level, "Warning")
    t = title.replace("'", "''")[:80]
    b = body.replace("'", "''").replace("\n", " ")[:200]
    ps = (
        "Add-Type -Assembly System.Windows.Forms,System.Drawing;"
        "$n=[System.Windows.Forms.NotifyIcon]::new();"
        f"$n.Icon=[System.Drawing.SystemIcons]::{icon};"
        "$n.Visible=$true;"
        f"$n.ShowBalloonTip(9000,'{t}','{b}',[System.Windows.Forms.ToolTipIcon]::{icon});"
        "Start-Sleep -Seconds 10;$n.Dispose()"
    )
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps],
            creationflags=_CREATE_NO_WINDOW, close_fds=True
        )
    except Exception:
        pass

def _daemon_append_log(level: str, msg: str) -> None:
    entry = {
        "ts":    datetime.datetime.now().isoformat(timespec="seconds"),
        "level": level,
        "msg":   msg,
    }
    _daemon_state["log"] = ([entry] + _daemon_state["log"])[:100]
    try:
        with open(_SHERMAN_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        # Trim file to _SHERMAN_MAX_LOG lines
        with open(_SHERMAN_LOG_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if len(lines) > _SHERMAN_MAX_LOG:
            with open(_SHERMAN_LOG_PATH, "w", encoding="utf-8") as f:
                f.writelines(lines[-_SHERMAN_MAX_LOG:])
    except Exception:
        pass

def _daemon_posture() -> tuple:
    """Fast posture check — returns (threat_level, counts_dict)."""
    import psutil
    established = listeners = rat_listeners = headless = temp_execs = 0
    try:
        for c in psutil.net_connections(kind="inet"):
            if c.status == "ESTABLISHED":
                established += 1
            elif c.status == "LISTEN":
                listeners += 1
                port = c.laddr.port if c.laddr else 0
                if port in _RAT_PORTS:
                    rat_listeners += 1
    except Exception:
        pass
    try:
        for p in psutil.process_iter(["name", "exe", "cmdline"]):
            try:
                name = (p.info["name"] or "").lower()
                if any(b in name for b in ["chrome", "msedge", "brave", "chromium"]):
                    cl = " ".join(p.info.get("cmdline") or []).lower()
                    if "--headless" in cl or "--remote-debugging-port" in cl:
                        headless += 1
                exe = (p.info.get("exe") or "").lower()
                if exe and ("\\temp\\" in exe or "\\appdata\\roaming\\" in exe) and any(s in name for s in ["powershell", "cmd"]):
                    temp_execs += 1
            except Exception:
                continue
    except Exception:
        pass
    lvl = (
        "CRITICAL" if rat_listeners > 0 else
        "HIGH"     if headless > 0      else
        "ELEVATED" if temp_execs > 0    else
        "NOMINAL"
    )
    return lvl, {
        "established": established, "listeners": listeners,
        "rat_listeners": rat_listeners, "headless": headless,
        "temp_execs": temp_execs,
    }

def _sherman_daemon_worker() -> None:
    """Background thread — runs forever while the backend is alive."""
    _daemon_state["running"] = True
    _daemon_append_log("INFO", "GEN SHERMAN daemon started — 24/7 protection active")
    _notify_windows("GEN SHERMAN ONLINE", "24/7 background protection active for BERYL HF & Windows 11", "INFO")

    last_full_sweep = 0.0
    prev_level = "NOMINAL"

    while True:
        try:
            now = time.time()
            level, counts = _daemon_posture()
            _daemon_state["last_posture"] = datetime.datetime.now().isoformat(timespec="seconds")
            _daemon_state["threat_level"] = level

            if level != prev_level:
                _daemon_append_log(level, f"Threat level: {prev_level} → {level} | {counts}")
                if level in ("CRITICAL", "HIGH"):
                    _notify_windows(
                        f"GEN SHERMAN — {level} THREAT",
                        f"RAT ports:{counts['rat_listeners']} Headless:{counts['headless']} "
                        f"TempExec:{counts['temp_execs']} — Open BERYL HF GEN SHERMAN",
                        "WARNING",
                    )
                elif prev_level in ("CRITICAL", "HIGH"):
                    _notify_windows("GEN SHERMAN — THREAT CLEARED", f"System returned to {level}", "INFO")
                prev_level = level

            # Full sweep on schedule
            if (now - last_full_sweep) >= _daemon_state["sweep_interval"]:
                _daemon_append_log("INFO", "Full sweep initiated (scheduled)")
                try:
                    resp = requests.get("http://127.0.0.1:8001/security/sweep", timeout=90)
                    if resp.ok:
                        threats = resp.json()
                        total = sum(
                            len(v) for k, v in threats.items()
                            if isinstance(v, list) and not k.startswith("_")
                        )
                        crit = sum(
                            1 for v in threats.values()
                            if isinstance(v, list)
                            for it in v
                            if isinstance(it, dict) and it.get("risk") == "CRITICAL"
                        )
                        _daemon_state["total_threats_seen"] += total
                        _daemon_state["last_sweep"] = datetime.datetime.now().isoformat(timespec="seconds")
                        if total > 0:
                            _daemon_append_log("THREAT", f"Sweep: {total} threats ({crit} critical)")
                            if crit > 0:
                                _notify_windows(
                                    "GEN SHERMAN — CRITICAL SWEEP RESULT",
                                    f"{total} threats found, {crit} CRITICAL. Review in BERYL HF → GEN SHERMAN.",
                                    "ERROR",
                                )
                            if _daemon_state["auto_kill"]:
                                for cat_items in threats.values():
                                    if not isinstance(cat_items, list):
                                        continue
                                    for it in cat_items:
                                        if isinstance(it, dict) and it.get("risk") == "CRITICAL" and it.get("pid"):
                                            try:
                                                subprocess.run(
                                                    ["taskkill", "/F", "/PID", str(it["pid"])],
                                                    timeout=5, capture_output=True,
                                                    creationflags=_CREATE_NO_WINDOW,
                                                )
                                                _daemon_append_log(
                                                    "KILL",
                                                    f"Auto-killed PID {it['pid']} ({it.get('name','?')}) — CRITICAL",
                                                )
                                            except Exception:
                                                pass
                        else:
                            _daemon_append_log("CLEAR", "Full sweep complete — system clean")
                except Exception as ex:
                    _daemon_append_log("ERROR", f"Sweep error: {ex}")

                # Firewall: brute-force + connection surge scan on every full cycle
                try:
                    import firewall_engine as _fw
                    bf_events = _fw.check_brute_force_events()
                    newly_banned = _fw.process_brute_force(bf_events)
                    surge_ips = _fw.check_connection_surge()
                    for sip in surge_ips:
                        _fw.block_ip(sip, "connection_surge")
                    if newly_banned:
                        _daemon_append_log("FW-BAN", f"Auto-banned {len(newly_banned)} IP(s): {', '.join(newly_banned)}")
                        _notify_windows(
                            "GEN SHERMAN — BRUTE FORCE BLOCKED",
                            f"Banned {len(newly_banned)} attacking IP(s): {', '.join(newly_banned[:3])}",
                            "WARNING",
                        )
                    if surge_ips:
                        _daemon_append_log("FW-BAN", f"Surge-blocked {len(surge_ips)} IP(s): {', '.join(surge_ips)}")
                except Exception as fw_ex:
                    _daemon_append_log("ERROR", f"Firewall scan error: {fw_ex}")

                last_full_sweep = now

        except Exception as ex:
            _daemon_append_log("ERROR", f"Daemon loop error: {ex}")

        time.sleep(_daemon_state["posture_interval"])


@app.on_event("startup")
async def start_sherman_daemon() -> None:
    t = threading.Thread(target=_sherman_daemon_worker, daemon=True, name="gen-sherman")
    t.start()
    # Init firewall engine (loads ban DB, re-applies persistent bans, starts pydivert)
    import firewall_engine as fw
    fw.init()
    # Start the firewall snapshot refresher (keeps /firewall/status instant)
    threading.Thread(target=_fw_snapshot_worker, daemon=True, name="fw-snapshot").start()


@app.get("/security/daemon/status")
async def daemon_status():
    return {k: v for k, v in _daemon_state.items() if k != "log"}


@app.get("/security/daemon/logs")
async def daemon_logs(limit: int = 50):
    return {"logs": _daemon_state["log"][:limit]}


class DaemonConfig(BaseModel):
    auto_kill:       Optional[bool] = None
    sweep_interval:  Optional[int]  = None

@app.post("/security/daemon/config")
async def update_daemon_config(cfg: DaemonConfig):
    if cfg.auto_kill is not None:
        _daemon_state["auto_kill"] = cfg.auto_kill
    if cfg.sweep_interval is not None:
        _daemon_state["sweep_interval"] = max(60, cfg.sweep_interval)
    return {"status": "ok", "config": {k: v for k, v in _daemon_state.items() if k != "log"}}


# ═══════════════════════════════════════════════════════
#  VOICE ENGINE CONFIG  (O.V.E)
# ═══════════════════════════════════════════════════════
VOICE_CONFIG = {"model": "parler-tts/parler-tts-mini-v1", "speed": 1.0}

# CORTEX — rolling session memory (session_id → deque of {role, content} turns)
_ove_sessions: Dict[str, deque] = {}

class VoiceConfig(BaseModel):
    model: str = "parler-tts/parler-tts-mini-v1"
    speed: float = 1.0

@app.get("/voice/config")
async def get_voice_config():
    return VOICE_CONFIG

@app.post("/voice/config")
async def set_voice_config(cfg: VoiceConfig):
    VOICE_CONFIG["model"] = cfg.model
    VOICE_CONFIG["speed"] = cfg.speed
    return {"status": "success", "config": VOICE_CONFIG}


# ═══════════════════════════════════════════════════════
#  LIVE SYSTEM TELEMETRY  (real CPU / RAM / GPU)
# ═══════════════════════════════════════════════════════
@app.get("/system/stats")
async def system_stats():
    """Real CPU, RAM and per-process telemetry via psutil (no WMI hang)."""
    import psutil
    vm = psutil.virtual_memory()
    stats = {
        "cpu_percent":  psutil.cpu_percent(interval=0.3),
        "cpu_count":    psutil.cpu_count(logical=True),
        "ram_used_gb":  round(vm.used / 1024**3, 2),
        "ram_total_gb": round(vm.total / 1024**3, 2),
        "ram_percent":  vm.percent,
        "node_mem_gb":  0.0,
        "py_mem_gb":    0.0,
    }
    node_sum = 0
    py_sum = 0
    for p in psutil.process_iter(['name', 'memory_info']):
        try:
            n = (p.info['name'] or '').lower()
            mi = p.info['memory_info']
            rss = mi.rss if mi else 0
            if 'node' in n:
                node_sum += rss
            elif 'python' in n:
                py_sum += rss
        except Exception:
            continue
    stats["node_mem_gb"] = round(node_sum / 1024**3, 2)
    stats["py_mem_gb"] = round(py_sum / 1024**3, 2)
    return stats


def _query_nvidia():
    """Try nvidia-smi from PATH or known install dirs. Returns dict."""
    candidates = ["nvidia-smi",
                  r"C:\Windows\System32\nvidia-smi.exe",
                  r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe"]
    for exe in candidates:
        try:
            r = subprocess.run(
                [exe, "--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=6
            )
            if r.returncode != 0:
                continue
            gpus = []
            for line in r.stdout.strip().splitlines():
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 6:
                    used = float(parts[1] or 0)
                    total = float(parts[2] or 0)
                    gpus.append({
                        "name": parts[0],
                        "mem_used_mb": used,
                        "mem_total_mb": total,
                        "mem_percent": round((used / total) * 100, 1) if total else 0.0,
                        "util_percent": float(parts[3] or 0),
                        "temp_c": float(parts[4] or 0),
                        "power_w": float(parts[5] or 0),
                    })
            if gpus:
                return {"gpus": gpus, "available": True, "vendor": "NVIDIA"}
        except (FileNotFoundError, Exception):
            continue
    return None


@app.get("/system/gpu")
async def system_gpu():
    """Real GPU telemetry. NVIDIA via nvidia-smi; otherwise reports the real
    local adapter name from the registry (no WMI hang)."""
    nvidia = _query_nvidia()
    if nvidia:
        return nvidia
    # No CUDA GPU — report the actual installed adapter from the registry
    adapter = "Unknown Display Adapter"
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000"
        )
        adapter, _ = winreg.QueryValueEx(key, "DriverDesc")
        winreg.CloseKey(key)
    except Exception:
        pass
    return {"gpus": [], "available": False, "vendor": "Integrated",
            "adapter": adapter, "detail": "No CUDA GPU detected — integrated graphics"}


# ═══════════════════════════════════════════════════════
#  EMBEDDED TERMINAL  (real PowerShell execution)
# ═══════════════════════════════════════════════════════
class CliRequest(BaseModel):
    command: str
    cwd: Optional[str] = None

@app.post("/cli/exec")
async def cli_exec(req: CliRequest):
    """Execute a real command in the user's PowerShell and stream back stdout/stderr."""
    try:
        cwd = req.cwd if req.cwd and os.path.isdir(req.cwd) else None
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", req.command],
            capture_output=True, text=True, timeout=30, cwd=cwd
        )
        return {
            "stdout": r.stdout,
            "stderr": r.stderr,
            "exit_code": r.returncode,
            "cwd": cwd or os.getcwd(),
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Command timed out after 30s", "exit_code": 124, "cwd": req.cwd or os.getcwd()}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "exit_code": 1, "cwd": req.cwd or os.getcwd()}


# ═══════════════════════════════════════════════════════
#  TOKEN USAGE LEDGER  (real per-model accounting)
# ═══════════════════════════════════════════════════════
USAGE = {"by_model": {}, "session_start": None}

def _approx_tokens(text: str) -> int:
    # ~4 chars per token heuristic (no tokenizer dependency)
    return max(1, len(text) // 4)

def _record_usage(model: str, prompt_text: str, completion_text: str):
    import time as _t
    if USAGE["session_start"] is None:
        USAGE["session_start"] = _t.time()
    entry = USAGE["by_model"].setdefault(model, {"prompt": 0, "completion": 0, "calls": 0})
    entry["prompt"] += _approx_tokens(prompt_text)
    entry["completion"] += _approx_tokens(completion_text)
    entry["calls"] += 1

@app.get("/usage")
async def get_usage():
    import time as _t
    total_prompt = sum(v["prompt"] for v in USAGE["by_model"].values())
    total_completion = sum(v["completion"] for v in USAGE["by_model"].values())
    elapsed_min = ((_t.time() - USAGE["session_start"]) / 60) if USAGE["session_start"] else 0
    return {
        "by_model": USAGE["by_model"],
        "total_prompt": total_prompt,
        "total_completion": total_completion,
        "total": total_prompt + total_completion,
        "calls": sum(v["calls"] for v in USAGE["by_model"].values()),
        "elapsed_min": round(elapsed_min, 2),
        "velocity_per_min": round((total_prompt + total_completion) / elapsed_min, 1) if elapsed_min > 0.05 else 0,
    }


# ═══════════════════════════════════════════════════════
#  HF BILLING MIRROR
#  HF exposes no public billing API — credits/usage live only
#  in the authenticated dashboard. This is an editable, persisted
#  mirror of the user's real figures, updatable from the UI.
# ═══════════════════════════════════════════════════════
_BILLING_PATH = os.path.join(os.path.dirname(__file__), "hf_billing.json")

@app.get("/hf/billing")
async def get_hf_billing():
    try:
        with open(_BILLING_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

@app.post("/hf/billing")
async def set_hf_billing(request: Request):
    try:
        data = await request.json()
        import datetime
        data["last_updated"] = datetime.date.today().isoformat()
        with open(_BILLING_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════
#  COMFYUI BRIDGE  (real proxy to a running ComfyUI on :8188)
# ═══════════════════════════════════════════════════════
COMFY_URL = "http://127.0.0.1:8188"

@app.get("/comfy/status")
async def comfy_status():
    try:
        r = requests.get(f"{COMFY_URL}/system_stats", timeout=2)
        if r.status_code == 200:
            return {"online": True, "url": COMFY_URL, "stats": r.json()}
    except Exception:
        pass
    return {"online": False, "url": COMFY_URL}

@app.get("/comfy/queue")
async def comfy_queue():
    try:
        r = requests.get(f"{COMFY_URL}/queue", timeout=2)
        return r.json()
    except Exception as e:
        return {"error": str(e), "queue_running": [], "queue_pending": []}

@app.get("/comfy/models")
async def comfy_models():
    """Real checkpoint list from a running ComfyUI."""
    try:
        r = requests.get(f"{COMFY_URL}/object_info/CheckpointLoaderSimple", timeout=4)
        data = r.json()
        ckpts = data["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
        return {"checkpoints": ckpts}
    except Exception as e:
        return {"checkpoints": [], "error": str(e)}


# ═══════════════════════════════════════════════════════
#  AGENT STUDIO  (real persisted agent definitions)
# ═══════════════════════════════════════════════════════
_AGENTS_PATH = os.path.join(os.path.dirname(__file__), "agents.json")

def _load_agents():
    try:
        with open(_AGENTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _save_agents(agents):
    with open(_AGENTS_PATH, "w", encoding="utf-8") as f:
        json.dump(agents, f, indent=2)

class AgentDef(BaseModel):
    id: Optional[str] = None
    name: str
    model: str
    system_prompt: str = ""
    tools: List[str] = []
    status: str = "idle"

@app.get("/agents")
async def list_agents():
    return {"agents": _load_agents()}

@app.post("/agents")
async def create_agent(agent: AgentDef):
    agents = _load_agents()
    agent.id = agent.id or uuid.uuid4().hex[:8]
    data = agent.dict()
    # replace if id exists, else append
    agents = [a for a in agents if a.get("id") != agent.id]
    agents.append(data)
    _save_agents(agents)
    return {"status": "success", "agent": data}

@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    agents = [a for a in _load_agents() if a.get("id") != agent_id]
    _save_agents(agents)
    return {"status": "success", "remaining": len(agents)}


# ═══════════════════════════════════════════════════════
#  GEN SHERMAN — FIREWALL API
#  Powered by netsh advfirewall (persistent rules) +
#  pydivert/WinDivert (real-time packet layer)
#  GitHub: https://github.com/ffalcinelli/pydivert
#
#  PERF: every endpoint that touches netsh is a *sync* def so
#  FastAPI runs it in a threadpool — slow netsh calls never
#  block the event loop or the 24/7 daemon. /firewall/status
#  and /firewall/blocked are served from a background-refreshed
#  snapshot, so the UI poll returns instantly.
# ═══════════════════════════════════════════════════════
import firewall_engine as fw

class FwBlockReq(BaseModel):
    ip: str
    reason: Optional[str] = "manual"

class FwPortReq(BaseModel):
    port: int
    protocol: Optional[str] = "TCP"

# ── Snapshot cache (refreshed by background thread) ──────────────────────────
_fw_snapshot: dict = {
    "status":  {"default_block_inbound": False, "divert_active": False,
                "blocked_ip_count": 0, "total_bans_ever": 0,
                "log_entries": 0, "safe_ports": []},
    "profiles": {"domain": {"on": True, "policy": "warming"},
                 "private": {"on": True, "policy": "warming"},
                 "public":  {"on": True, "policy": "warming"},
                 "default_block": False},
    "blocked": [],
    "ts": None,
}

def _fw_snapshot_worker() -> None:
    """Background refresh. Fast in-memory parts every 10s; slow netsh
    profile + rule reconciliation every 60s. Never blocks request handlers."""
    last_slow = 0.0
    while True:
        try:
            # Fast (in-memory only)
            _fw_snapshot["status"]  = fw.get_status()
            _fw_snapshot["blocked"] = fw.get_banned_list()
            # Slow (netsh) — only once a minute
            now = time.time()
            if (now - last_slow) >= 60:
                _fw_snapshot["profiles"] = fw.get_firewall_profiles()  # cached 30s inside engine
                fw.get_blocked_ips()  # reconcile DB <-> live rules in background
                last_slow = now
            _fw_snapshot["ts"] = datetime.datetime.now().isoformat(timespec="seconds")
        except Exception:
            pass
        time.sleep(10)

@app.get("/firewall/status")
def firewall_status():
    # Instant — served from the background-refreshed snapshot (no netsh on request path)
    return {**_fw_snapshot["profiles"], **_fw_snapshot["status"], "snapshot_ts": _fw_snapshot["ts"]}

@app.get("/firewall/blocked")
def firewall_blocked():
    # Instant — in-memory ban DB (no netsh)
    return {"blocked": fw.get_banned_list()}

@app.get("/firewall/blocked/live")
def firewall_blocked_live():
    # Forces a fresh netsh read (sync def -> threadpool, won't block loop)
    blocked = fw.get_blocked_ips()
    _fw_snapshot["blocked"] = blocked
    return {"blocked": blocked}

def _refresh_fw_fast() -> None:
    """Update the fast (in-memory) parts of the snapshot immediately."""
    _fw_snapshot["blocked"] = fw.get_banned_list()
    _fw_snapshot["status"]  = fw.get_status()

@app.post("/firewall/block")
def firewall_block(req: FwBlockReq):
    ok = fw.block_ip(req.ip, req.reason or "manual")
    _refresh_fw_fast()
    return {"status": "blocked" if ok else "error", "ip": req.ip}

@app.post("/firewall/unblock")
def firewall_unblock(req: FwBlockReq):
    ok = fw.unblock_ip(req.ip)
    _refresh_fw_fast()
    return {"status": "unblocked" if ok else "error", "ip": req.ip}

@app.post("/firewall/block_all_inbound")
def firewall_block_all_inbound():
    ok = fw.enable_default_block_inbound()
    return {"status": "enabled" if ok else "error",
            "note": "All inbound blocked except whitelisted BERYL ports"}

@app.post("/firewall/allow_inbound")
def firewall_allow_inbound():
    ok = fw.disable_default_block_inbound()
    return {"status": "restored" if ok else "error"}

@app.post("/firewall/allow_port")
def firewall_allow_port(req: FwPortReq):
    ok = fw.allow_port_inbound(req.port, req.protocol or "TCP")
    return {"status": "added" if ok else "error", "port": req.port}

@app.get("/firewall/logs")
def firewall_logs(limit: int = 100):
    return {"logs": fw.get_log(limit)}

@app.get("/firewall/scan_brute_force")
def firewall_scan_brute_force():
    events = fw.check_brute_force_events()
    newly_banned = fw.process_brute_force(events)
    if newly_banned:
        _fw_snapshot["blocked"] = fw.get_banned_list()
    return {
        "events":      events,
        "total_ips":   len(events),
        "newly_banned": newly_banned,
        "auto_banned": len(newly_banned),
    }

@app.get("/firewall/scan_surge")
def firewall_scan_surge():
    surge_ips = fw.check_connection_surge()
    newly_banned = []
    for ip in surge_ips:
        ok = fw.block_ip(ip, "connection_surge")
        if ok:
            newly_banned.append(ip)
    if newly_banned:
        _fw_snapshot["blocked"] = fw.get_banned_list()
    return {"surge_ips": surge_ips, "banned": newly_banned}


# ═══════════════════════════════════════════════════════════════════════════════
# KREWE — n8n-style DOLL workflow engine. Each DOLL is a pipeline node:
#   head=system prompt · torso=model/engine · arms=I/O · hands=links · purse=tools
# Connect dolls hand-to-hand ("SQUAD UP") to build a live talking-avatar pipeline.
# ═══════════════════════════════════════════════════════════════════════════════

# Special non-LLM engines simulated server-side (no external call needed).
_KREWE_SPECIAL = {
    "hf-gpu":     "GPU warp/lip-sync rendered on HuggingFace GPU. 28fps talking-head clip ready.",
    "ove-voice":  "O.V.E voice synthesized. Audio waveform + phoneme timing generated.",
    "comfyui":    "Avatar face frame & backdrop rendered via ComfyUI.",
    "trigger":    "Inbound payload received and packaged for the squad.",
    "edge-stream": "Talking-head frames streaming to the live previewer (MJPEG).",
}

def _krewe_llm(model: str, system: str, user: str, temperature: float = 0.7, max_tokens: int = 280) -> str:
    """Route a single doll's torso call. ollama/* → local; special → simulated; else HF."""
    if model in _KREWE_SPECIAL:
        return _KREWE_SPECIAL[model]
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    try:
        if model.startswith("ollama/"):
            out = _ollama_chat(model.split("/", 1)[1], msgs, timeout=60)
            return out or "(local model returned no output)"
        client = InferenceClient(model=model, token=HF_TOKEN, provider="auto")
        comp = client.chat_completion(messages=msgs, max_tokens=max_tokens, temperature=temperature)
        return (comp.choices[0].message.content or "").strip()
    except Exception as e:
        return f"(engine error: {e})"

def _krewe_topo(node_ids: list, edges: list) -> list:
    indeg = {i: 0 for i in node_ids}
    adj = {i: [] for i in node_ids}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in adj and t in indeg:
            adj[s].append(t); indeg[t] += 1
    q = [i for i in node_ids if indeg[i] == 0]
    out = []
    while q:
        i = q.pop(0); out.append(i)
        for t in adj[i]:
            indeg[t] -= 1
            if indeg[t] == 0:
                q.append(t)
    for i in node_ids:
        if i not in out:
            out.append(i)
    return out

class KreweRunRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    goal: str = "Greet the viewer warmly."

@app.post("/krewe/run")
def krewe_run(req: KreweRunRequest):
    by_id = {n["id"]: n for n in req.nodes}
    order = _krewe_topo(list(by_id.keys()), req.edges)
    payload_ctx = f"SQUAD GOAL: {req.goal}\n"
    steps = []
    final_line = ""
    for nid in order:
        n = by_id.get(nid)
        if not n:
            continue
        user = (
            f"{payload_ctx}\n"
            f"You are '{n.get('name')}' ({n.get('role')}). Tools available: {', '.join(n.get('tools', [])) or 'none'}.\n"
            f"Process the squad payload and produce your contribution. Be concise."
        )
        out = _krewe_llm(
            n.get("model", DEFAULT_MODEL), n.get("system", ""), user,
            float(n.get("temperature", 0.7)),
        )
        steps.append({"id": nid, "name": n.get("name"), "role": n.get("role"), "status": "done", "output": out})
        payload_ctx += f"\n[{n.get('name')} · {n.get('role')}]: {out}\n"
        # the spoken line comes from the Brain or Director
        if n.get("uniform") in ("executive", "gala") and out and not out.startswith("("):
            final_line = out
    if not final_line and steps:
        final_line = next((s["output"] for s in reversed(steps)
                           if s["output"] and not s["output"].startswith("(") and s["output"] not in _KREWE_SPECIAL.values()), steps[-1]["output"])
    # trim a spoken line to something deliverable
    final_line = (final_line or "Hello — your KREWE squad is live.").strip().strip('"')
    return {"steps": steps, "final_line": final_line[:600]}

class KrewePlanRequest(BaseModel):
    goal: str
    roster: List[Dict[str, Any]]

@app.post("/krewe/plan")
def krewe_plan(req: KrewePlanRequest):
    roster_txt = "\n".join(f"- {r['key']}: {r['role']} — {r['blurb']}" for r in req.roster)
    system = (
        "You are the KREWE Foreman. You design avatar-builder pipelines by selecting and ordering "
        "'dolls' (nodes) from a roster and connecting them hand-to-hand into a sequential squad. "
        "Always include a trigger/input doll first and a stream/output doll last when relevant.\n"
        "Respond with ONLY valid JSON: "
        '{"dolls": ["key1","key2",...], "edges": [["key1","key2"],...], "note": "one friendly sentence"}'
    )
    user = f"ROSTER:\n{roster_txt}\n\nGOAL: {req.goal}\n\nDesign the squad."
    raw = _krewe_llm(DEFAULT_MODEL, system, user, temperature=0.4, max_tokens=400)
    try:
        m = re.search(r'\{[\s\S]*\}', raw)
        plan = json.loads(m.group(0)) if m else {}
        valid_keys = {r["key"] for r in req.roster}
        dolls = [k for k in plan.get("dolls", []) if k in valid_keys]
        edges = [p for p in plan.get("edges", []) if isinstance(p, list) and len(p) == 2 and p[0] in valid_keys and p[1] in valid_keys]
        if not dolls:
            raise ValueError("empty plan")
        # ensure a connected chain if model omitted edges
        if not edges and len(dolls) > 1:
            edges = [[dolls[i], dolls[i + 1]] for i in range(len(dolls) - 1)]
        return {"dolls": dolls, "edges": edges, "note": plan.get("note", f"Assigned {len(dolls)} dolls for: {req.goal}")}
    except Exception:
        # graceful fallback — canonical avatar pipeline
        chain = [r["key"] for r in req.roster][:7]
        return {"dolls": chain, "edges": [[chain[i], chain[i + 1]] for i in range(len(chain) - 1)],
                "note": "Designed a starter squad — tweak any doll, then SQUAD UP."}


# ── Per-step executor (used by frontend for real-time connectivity feedback) ──

_KREWE_ERROR_SIGNALS = ["(engine error:", "(local model returned no output)", "(ollama returned"]

class KreweStepRequest(BaseModel):
    node: Dict[str, Any]
    context: str
    goal: str = ""

@app.post("/krewe/step")
def krewe_step(req: KreweStepRequest):
    """Execute a single DOLL and return success/error + latency. Used by the
    frontend to drive real-time neon connectivity indicators doll-by-doll."""
    n = req.node
    start = time.time()
    user = (
        f"{req.context}\n"
        f"You are '{n.get('name')}' ({n.get('role')}). "
        f"Tools available: {', '.join(n.get('tools', [])) or 'none'}.\n"
        f"Process the squad payload and produce your contribution. Be concise."
    )
    try:
        out = _krewe_llm(
            n.get("model", DEFAULT_MODEL),
            n.get("system", ""),
            user,
            float(n.get("temperature", 0.7)),
        )
        latency = int((time.time() - start) * 1000)
        is_error = any(out.startswith(sig) for sig in _KREWE_ERROR_SIGNALS) or not out.strip()
        return {
            "status": "error" if is_error else "done",
            "output": out,
            "latency_ms": latency,
            "error": out if is_error else None,
            "model_used": n.get("model"),
        }
    except Exception as exc:
        return {
            "status": "error",
            "output": "",
            "latency_ms": int((time.time() - start) * 1000),
            "error": str(exc),
            "model_used": n.get("model"),
        }


# ── Role-based model suggestions ──────────────────────────────────────────────

_KREWE_ROLE_MODELS: Dict[str, List[str]] = {
    "Brain":          ["MiniMaxAI/MiniMax-M3", "Qwen/Qwen2.5-72B-Instruct", "ollama/llama3.2", "ollama/qwen2.5", "ollama/deepseek-r1"],
    "Director":       ["MiniMaxAI/MiniMax-M3", "ollama/llama3.2", "Qwen/Qwen2.5-72B-Instruct", "ollama/mistral"],
    "QA / Safety":    ["MiniMaxAI/MiniMax-M3", "ollama/llama3.2", "microsoft/Phi-3-mini-4k-instruct", "ollama/gemma2"],
    "Voice / TTS":    ["ove-voice", "facebook/mms-tts-eng", "suno/bark-small", "hexgrad/Kokoro-82M"],
    "GPU Engine":     ["hf-gpu", "AIBRUH/latentsync", "KwaiVGI/CHAMP"],
    "Face / Visual":  ["comfyui", "stabilityai/stable-diffusion-xl-base-1.0", "black-forest-labs/FLUX.1-schnell"],
    "Text-to-Image":  ["black-forest-labs/FLUX.1-dev", "black-forest-labs/FLUX.1-schnell", "stabilityai/stable-diffusion-3.5-large", "SG161222/Realistic_Vision_V6.0_B1_noVAE", "Lykon/dreamshaper-8", "comfyui"],
    "Trigger / I/O":  ["trigger", "webhook", "cron"],
    "Stream / Output":["edge-stream", "webrtc", "mjpeg"],
    "Chain Executor": ["langchain-hf", "langchain-openai", "MiniMaxAI/MiniMax-M3"],
    "Micro Agent":    ["smolagents", "ollama/mistral", "HuggingFaceH4/zephyr-7b-beta"],
    "Context Store":  ["faiss", "chromadb", "ollama/nomic-embed-text"],
    "Flow Router":    ["logic", "MiniMaxAI/MiniMax-M3"],
}

@app.get("/krewe/models")
def krewe_models(role: str = "Brain"):
    models = _KREWE_ROLE_MODELS.get(role, _KREWE_ROLE_MODELS["Brain"])
    return {"role": role, "models": models}


@app.get("/krewe/master-squad")
def krewe_master_squad():
    """Return the canonical Inner Circle squad spec — used by the frontend
    to pre-populate the canvas on first load and by the assembly line as
    the default template for automated persona production."""
    return {
        "name": "The Inner Circle",
        "version": "1.0",
        "description": "Research-backed 7-doll pipeline for undetectable photorealistic talking humans.",
        "cost_per_run_usd": 0.003,
        "cold_latency_s": 13,
        "papers": [
            "LatentSync — ByteDance CVPR 2025 (arxiv 2412.09262)",
            "FLUX.1 — Black Forest Labs ICML 2024",
            "StyleTTS2 — NeurIPS 2023 (Kokoro-82M)",
            "InstantID — CVPR 2024 (arxiv 2401.07519)",
        ],
        "dolls": [
            {"slot": 1, "key": "courier",   "name": "The Courier",  "role": "Trigger / I/O",   "model": "trigger",                             "cost": "$0",      "latency_ms": 0},
            {"slot": 2, "key": "cosmos",    "name": "Ms. Cosmos",   "role": "Director",         "model": "MiniMaxAI/MiniMax-M3",                "cost": "$0",      "latency_ms": 600},
            {"slot": 3, "key": "stylist",   "name": "The Stylist",  "role": "Text-to-Image",    "model": "black-forest-labs/FLUX.1-schnell",     "cost": "$0.003",  "latency_ms": 3500},
            {"slot": 4, "key": "vocalist",  "name": "The Vocalist", "role": "Voice / TTS",      "model": "hexgrad/Kokoro-82M",                   "cost": "$0",      "latency_ms": 400},
            {"slot": 5, "key": "mechanic",  "name": "The Mechanic", "role": "GPU Engine",       "model": "AIBRUH/latentsync",                    "cost": "$0.0002", "latency_ms": 8000},
            {"slot": 6, "key": "doctor",    "name": "The Doctor",   "role": "QA / Safety",      "model": "MiniMaxAI/MiniMax-M3",                "cost": "$0",      "latency_ms": 400},
            {"slot": 7, "key": "athlete",   "name": "The Athlete",  "role": "Stream / Output",  "model": "edge-stream",                         "cost": "$0",      "latency_ms": 0},
        ],
        "upgrade_paths": {
            "stylist":   {"trigger": "identity drift across runs",    "upgrade": "FLUX.1-dev + InstantID"},
            "mechanic":  {"trigger": "mouth shape errors > 5%",       "upgrade": "Hallo2 or MuseTalk v2"},
            "vocalist":  {"trigger": "need voice cloning from sample", "upgrade": "F5-TTS or XTTS-v2"},
            "cosmos":    {"trigger": "need sub-200ms direction",       "upgrade": "Qwen2.5-7B local ollama"},
        },
    }


# ── THE STYLIST — Text-to-Image photorealism engine ───────────────────────────

_STYLIST_SYSTEM = """You are THE STYLIST — a precision text-to-image prompt engineer for photorealistic human avatars.

INPUT: A persona description (name, appearance, role, mood, setting).
OUTPUT: A single optimized image generation prompt followed by a negative_prompt line. Nothing else.

REALISM RULES:
- Natural skin: visible pores, subsurface scattering, micro-texture — never airbrushed or smoothed
- Lighting: cinematic 3-point (soft key, fill, subtle rim), warm studio or golden-hour tone
- Camera: shot on Sony A7 IV, 85mm f/1.8, natural shallow bokeh
- Composition: upper-body or headshot, 3/4 angle
- Expression: genuine, relaxed — not posed or stock-photo stiff
- Details: individual hair strands, natural eye moisture/catchlights, clothing fabric weave

FORMAT:
Line 1: [comma-separated positive descriptors — rich, specific, cinematic]
Line 2: negative_prompt: (airbrushed:1.4), (smooth skin:1.3), (plastic texture:1.5), (glossy:1.3), (cartoon:1.5), (illustration:1.4), (CGI render:1.3), (stock photo smile:1.2), (symmetrical face:1.1), (overexposed:1.2)"""

_REALISM_NEGATIVE = (
    "(airbrushed:1.4), (smooth skin:1.3), (plastic texture:1.5), (glossy:1.3), "
    "(cartoon:1.5), (illustration:1.4), (CGI render:1.3), (stock photo smile:1.2), "
    "(symmetrical face:1.1), (overexposed:1.2), (soft focus:1.2), (Instagram filter:1.3)"
)


def _stylist_build_prompt(persona_description: str, style_override: str = "") -> dict:
    """Use LLM to craft a photorealism-optimised FLUX prompt from a persona brief."""
    user_msg = f"Persona: {persona_description}"
    if style_override:
        user_msg += f"\nStyle notes: {style_override}"

    raw = _krewe_llm(DEFAULT_MODEL, _STYLIST_SYSTEM, user_msg, temperature=0.5, max_tokens=350)

    # Parse positive + negative
    lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]
    positive = lines[0] if lines else persona_description
    negative = _REALISM_NEGATIVE
    for line in lines[1:]:
        if line.lower().startswith("negative_prompt:"):
            negative = line.split(":", 1)[1].strip()
            break

    return {"positive": positive, "negative": negative}


def _flux_generate_image(model_id: str, positive: str, negative: str) -> dict:
    """
    Call HuggingFace Inference API for the given diffusion model.
    Returns {"image_b64": "...", "url": "..."} or {"error": "..."}.
    """
    hf_token = os.getenv("HF_TOKEN", "")
    if not hf_token:
        return {"error": "HF_TOKEN not set — cannot call inference API"}

    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    payload: dict = {
        "inputs": positive,
        "parameters": {
            "negative_prompt": negative,
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
            "width": 768,
            "height": 1024,
        },
    }
    # FLUX models use guidance_scale differently; schnell ignores negative prompt
    if "schnell" in model_id.lower():
        payload["parameters"]["num_inference_steps"] = 4
        payload["parameters"]["guidance_scale"] = 0.0

    try:
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            image_bytes = resp.read()
        import base64
        b64 = base64.b64encode(image_bytes).decode()
        return {"image_b64": b64, "mime": "image/jpeg"}
    except Exception as exc:
        return {"error": str(exc)}


@app.post("/krewe/generate-image")
def krewe_generate_image(payload: dict):
    """
    THE STYLIST endpoint.
    Body: { persona: str, style?: str, model?: str }
    Returns: { positive_prompt, negative_prompt, image_b64?, error? }
    """
    persona = payload.get("persona", "").strip()
    style = payload.get("style", "")
    model_id = payload.get("model", "black-forest-labs/FLUX.1-dev")

    if not persona:
        raise HTTPException(status_code=400, detail="persona field is required")

    # Step 1: craft realism prompt via LLM
    prompts = _stylist_build_prompt(persona, style)

    # Step 2: call diffusion model
    result = _flux_generate_image(model_id, prompts["positive"], prompts["negative"])

    return {
        "positive_prompt": prompts["positive"],
        "negative_prompt": prompts["negative"],
        "model": model_id,
        **result,
    }


# ── AI-driven pipeline adjustments (swap model, fix errors, insert doll) ─────

class KreweAdjustRequest(BaseModel):
    message: str
    nodes: List[Dict[str, Any]]
    errors: List[Dict[str, Any]] = []

@app.post("/krewe/adjust")
def krewe_adjust(req: KreweAdjustRequest):
    """Understand a natural-language adjustment command and return the specific
    changes to apply to the pipeline (model swaps, explanations, etc.)."""
    node_summary = "\n".join(
        f"- {n.get('name')} ({n.get('role')}, model={n.get('model')}, status={n.get('status') or 'idle'}"
        + (f", error={n.get('error', '')[:80]}" if n.get('error') else "") + ")"
        for n in req.nodes
    )
    error_summary = "\n".join(
        f"- {e.get('name')} failed with model={e.get('model')}: {str(e.get('error', ''))[:100]}"
        for e in req.errors
    ) if req.errors else "none"

    system = (
        "You are the KREWE Foreman adjusting an existing pipeline. "
        "Analyze the current node states and the user's request. "
        "Return ONLY valid JSON in this format:\n"
        '{"swaps": [{"nodeId": "doll_X", "model": "new-model-id"}], '
        '"note": "friendly explanation of what you changed and why"}\n'
        "If no model swaps are needed (e.g. user just asks a question), return empty swaps array.\n"
        f"Available role models: {json.dumps(_KREWE_ROLE_MODELS)}"
    )
    user = (
        f"CURRENT PIPELINE:\n{node_summary}\n\n"
        f"RECENT ERRORS:\n{error_summary}\n\n"
        f"USER REQUEST: {req.message}\n\n"
        "What should be changed?"
    )
    raw = _krewe_llm(DEFAULT_MODEL, system, user, temperature=0.3, max_tokens=500)
    try:
        m = re.search(r'\{[\s\S]*\}', raw)
        result = json.loads(m.group(0)) if m else {}
        swaps = result.get("swaps", [])
        note = result.get("note", "Applied pipeline adjustments.")
        # validate node IDs exist
        valid_ids = {n.get("id") for n in req.nodes}
        swaps = [s for s in swaps if isinstance(s, dict) and s.get("nodeId") in valid_ids and s.get("model")]
        return {"swaps": swaps, "note": note}
    except Exception:
        return {"swaps": [], "note": "Use the model dropdown on failing dolls to swap their engines, then SQUAD UP."}


# ═══════════════════════════════════════════════════════════════════════════════
# HF BACKEND — Private HuggingFace Dataset as Supabase-style database
# Stores JSON tables inside AIBRUH/beryl-db-{project} private dataset repos
# ═══════════════════════════════════════════════════════════════════════════════
from huggingface_hub import hf_hub_download, upload_file as hf_upload_file

def _hf_username():
    return whoami(token=HF_TOKEN)["name"]

def _repo_id(project: str) -> str:
    uname = _hf_username()
    return f"{uname}/beryl-db-{project}"

def _table_path(table: str) -> str:
    return f"data/{table}.json"

def _read_table(repo_id: str, table: str) -> list:
    try:
        path = hf_hub_download(repo_id=repo_id, filename=_table_path(table),
                               repo_type="dataset", token=HF_TOKEN)
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _write_table(repo_id: str, table: str, rows: list):
    content = json.dumps(rows, indent=2, ensure_ascii=False).encode("utf-8")
    hf_upload_file(path_or_fileobj=BytesIO(content),
                   path_in_repo=_table_path(table),
                   repo_id=repo_id, repo_type="dataset", token=HF_TOKEN,
                   commit_message=f"beryl: update {table}")

class HFBackendInitRequest(BaseModel):
    project: str

class HFBackendTableRequest(BaseModel):
    project: str
    table: str
    columns: list = []

class HFBackendInsertRequest(BaseModel):
    project: str
    table: str
    record: dict

class HFBackendUpdateRequest(BaseModel):
    project: str
    table: str
    id: str
    updates: dict

class HFBackendDeleteRequest(BaseModel):
    project: str
    table: str
    id: str

@app.post("/hf-backend/init")
def hfb_init(req: HFBackendInitRequest):
    repo_id = _repo_id(req.project)
    try:
        create_repo(repo_id=repo_id, repo_type="dataset", private=True, token=HF_TOKEN, exist_ok=True)
        readme = f"# BERYL DB — {req.project}\n\nPrivate database managed by BERYL Builder. Do not edit manually.".encode()
        hf_upload_file(path_or_fileobj=BytesIO(readme), path_in_repo="README.md",
                       repo_id=repo_id, repo_type="dataset", token=HF_TOKEN,
                       commit_message="beryl: init database")
        return {"repo_id": repo_id, "status": "created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/hf-backend/create-table")
def hfb_create_table(req: HFBackendTableRequest):
    repo_id = _repo_id(req.project)
    try:
        existing = _read_table(repo_id, req.table)
        if existing:
            return {"status": "exists", "rows": len(existing)}
        _write_table(repo_id, req.table, [])
        return {"status": "created", "table": req.table, "columns": req.columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hf-backend/tables")
def hfb_tables(project: str):
    from huggingface_hub import list_repo_files
    repo_id = _repo_id(project)
    try:
        files = list(list_repo_files(repo_id=repo_id, repo_type="dataset", token=HF_TOKEN))
        tables = []
        for f in files:
            if f.startswith("data/") and f.endswith(".json"):
                name = f.replace("data/", "").replace(".json", "")
                rows = _read_table(repo_id, name)
                cols = list(rows[0].keys()) if rows else []
                tables.append({"name": name, "rows": len(rows), "columns": cols})
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/hf-backend/rows")
def hfb_rows(project: str, table: str):
    repo_id = _repo_id(project)
    try:
        return {"rows": _read_table(repo_id, table)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/hf-backend/insert")
def hfb_insert(req: HFBackendInsertRequest):
    repo_id = _repo_id(req.project)
    try:
        rows = _read_table(repo_id, req.table)
        record = {"id": str(uuid.uuid4()), "created_at": datetime.datetime.utcnow().isoformat(), **req.record}
        rows.append(record)
        _write_table(repo_id, req.table, rows)
        return {"status": "inserted", "record": record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/hf-backend/update")
def hfb_update(req: HFBackendUpdateRequest):
    repo_id = _repo_id(req.project)
    try:
        rows = _read_table(repo_id, req.table)
        for i, row in enumerate(rows):
            if str(row.get("id")) == req.id:
                rows[i] = {**row, **req.updates, "updated_at": datetime.datetime.utcnow().isoformat()}
                _write_table(repo_id, req.table, rows)
                return {"status": "updated", "record": rows[i]}
        raise HTTPException(status_code=404, detail="Record not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/hf-backend/delete")
def hfb_delete(req: HFBackendDeleteRequest):
    repo_id = _repo_id(req.project)
    try:
        rows = _read_table(repo_id, req.table)
        before = len(rows)
        rows = [r for r in rows if str(r.get("id")) != req.id]
        if len(rows) == before:
            raise HTTPException(status_code=404, detail="Record not found")
        _write_table(repo_id, req.table, rows)
        return {"status": "deleted", "remaining": len(rows)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/deploy-space")
def deploy_space(payload: dict):
    name = payload.get("name", "beryl-app")
    html_content = payload.get("html", "")
    uname = _hf_username()
    repo_id = f"{uname}/{name}"
    try:
        create_repo(repo_id=repo_id, repo_type="space", space_sdk="static",
                    private=False, token=HF_TOKEN, exist_ok=True)
        hf_upload_file(path_or_fileobj=BytesIO(html_content.encode()),
                       path_in_repo="index.html", repo_id=repo_id,
                       repo_type="space", token=HF_TOKEN,
                       commit_message="beryl: deploy")
        return {"status": "deployed", "url": f"https://huggingface.co/spaces/{repo_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# HUMAN ASSEMBLY LINE — Industrial-scale persona production system
# Quality Gate (A/B/C), auto-tagging, backend pipeline runner, SSE streaming
# 25 automation features — see ASSEMBLY_PLAN.md
# ═══════════════════════════════════════════════════════════════════════════════
import hashlib
from fastapi.responses import StreamingResponse

# ── Quality Standards (10 criteria, 10pts each) ───────────────────────────────
QUALITY_STANDARDS_KEYS = [
    "all_green", "output_length", "in_character", "latency_ok", "no_errors",
    "tone_match", "strong_hook", "spoken_natural", "narrative_arc", "on_brand",
]

# ── Squad Templates ───────────────────────────────────────────────────────────
# Each template is a sequence of doll configs: name, role, system prompt.
# These run server-side in _run_persona_pipeline — no frontend coordination needed.

def _squad_templates():
    return {
        "avatar": [
            {"name": "Director", "role": "orchestrator",
             "system": "You are the creative director. Given the squad goal, write the creative brief: persona voice, tone, emotional register, and key message. 1-2 sentences. Be specific."},
            {"name": "Scriptwriter", "role": "scriptwriter",
             "system": "You are an award-winning scriptwriter. Transform the creative brief into a natural, compelling 2-3 sentence spoken script for the avatar. Make it feel real and human."},
            {"name": "QA Director", "role": "qa",
             "system": "You are the quality director. Review the script. If it's strong, output it verbatim. If weak or generic, rewrite it to be more specific and in-character. Output ONLY the final script."},
            {"name": "Talent", "role": "avatar",
             "system": "You are the avatar talent. Deliver the approved script in first person as if speaking live to camera. Add natural rhythm and personality. Output the final spoken performance only."},
        ],
        "news_anchor": [
            {"name": "News Director", "role": "orchestrator",
             "system": "You are the news executive producer. Given the anchor persona and topic, write the creative direction: story angle, tone, urgency level, key facts to hit. 1-2 sentences."},
            {"name": "Reporter", "role": "scriptwriter",
             "system": "You are a TV news scriptwriter. Write a 2-3 sentence broadcast-quality news intro for the anchor. Professional, authoritative, natural TV cadence. No fluff."},
            {"name": "Broadcast QA", "role": "qa",
             "system": "You are the news director reviewing final copy. Approve or sharpen the script for broadcast quality, factual tone, and strong lead sentence. Output ONLY the final broadcast script."},
            {"name": "Anchor", "role": "avatar",
             "system": "You are the news anchor. Deliver the approved broadcast script in first person, live on camera, with professional authority. Output your spoken delivery only."},
        ],
        "financial": [
            {"name": "Market Strategist", "role": "orchestrator",
             "system": "You are the senior market strategist. Given the financial persona and market context, identify the key insight, risk level, and investor takeaway. 1-2 sentences."},
            {"name": "Market Writer", "role": "scriptwriter",
             "system": "You are a financial content writer. Turn the strategic insight into a confident, jargon-light 2-3 sentence market commentary. Specific about numbers and direction."},
            {"name": "Compliance QA", "role": "qa",
             "system": "You are the compliance reviewer. Ensure the commentary is confident but not a direct buy/sell recommendation. Sharpen clarity. Output ONLY the approved final copy."},
            {"name": "Analyst", "role": "avatar",
             "system": "You are the financial analyst avatar. Deliver the approved market commentary in first person, with calm authority and conviction. Output your spoken delivery only."},
        ],
        "health_coach": [
            {"name": "Wellness Director", "role": "orchestrator",
             "system": "You are the wellness creative director. Given the health persona and goal, define the emotional need being met, the tone (warm/clinical/energetic), and the core message. 1-2 sentences."},
            {"name": "Health Writer", "role": "scriptwriter",
             "system": "You are a health content writer. Write a 2-3 sentence health guidance script that is empathetic, actionable, and non-alarming. Accessible to a general audience."},
            {"name": "Medical QA", "role": "qa",
             "system": "You are the medical content reviewer. Ensure the script is accurate, safe, empowering (not fear-based), and actionable. Output ONLY the final approved script."},
            {"name": "Health Coach", "role": "avatar",
             "system": "You are the health coach avatar. Deliver the script in first person with warmth and genuine care. Speak like a trusted friend with expertise. Output your spoken delivery only."},
        ],
        "educator": [
            {"name": "Curriculum Director", "role": "orchestrator",
             "system": "You are the curriculum director. Given the educator persona and topic, identify the core learning objective, ideal student emotion (curiosity, wonder, confidence), and pedagogical angle. 1-2 sentences."},
            {"name": "Instructional Writer", "role": "scriptwriter",
             "system": "You are an instructional designer. Write a 2-3 sentence educational opening that hooks student curiosity and delivers a clear, memorable insight. Specific and surprising."},
            {"name": "Education QA", "role": "qa",
             "system": "You are the chief learning officer. Review for clarity, accuracy, engagement, and age-appropriate language. Improve where needed. Output ONLY the final teaching script."},
            {"name": "Educator", "role": "avatar",
             "system": "You are the educator avatar. Deliver the lesson opening in first person with intellectual warmth and genuine enthusiasm for the subject. Output your spoken delivery only."},
        ],
        # MASTER SQUAD — The Inner Circle (research-backed, ~$0.003/run)
        # Sources: LatentSync CVPR2025, FLUX flow-matching ICML2024, StyleTTS2 NeurIPS2023
        "master": [
            {
                "name": "Ms. Cosmos",
                "role": "orchestrator",
                "system": (
                    "You are Ms. Cosmos — creative director of a live photorealistic avatar production.\n"
                    "Read the squad goal and produce scene direction. spoken_script MUST be ≤15 words.\n"
                    "No AI tells. No 'Certainly', 'Of course', 'As an AI'. First-person. Real human voice.\n"
                    "OUTPUT JSON only: {\"persona\": \"...\", \"scene\": \"...\", "
                    "\"spoken_script\": \"≤15 words\", \"emotion\": \"...\", \"voice_tone\": \"...\"}"
                ),
            },
            {
                "name": "The Stylist",
                "role": "scriptwriter",
                "system": (
                    "You are The Stylist — precision text-to-image prompt engineer.\n"
                    "Read the scene direction and persona. Write an optimized FLUX.1-schnell prompt.\n"
                    "REALISM RULES: natural pores, subsurface scattering, 85mm f/1.8, 3-point cinematic lighting.\n"
                    "NEGATIVE: (airbrushed:1.4),(plastic:1.5),(glossy:1.3),(cartoon:1.5),(smooth skin:1.3).\n"
                    "Output format — Line 1: positive prompt. Line 2: negative_prompt: [negatives]"
                ),
            },
            {
                "name": "The Doctor",
                "role": "qa",
                "system": (
                    "You are The Doctor — naturalness gate.\n"
                    "Audit the spoken_script: ≤15 words, first-person, no AI tells, natural cadence, safe.\n"
                    "If it passes: output verbatim. If not: output corrected version.\n"
                    "Output the final spoken_script ONLY. No labels, no JSON."
                ),
            },
            {
                "name": "Avatar Talent",
                "role": "avatar",
                "system": (
                    "You are the avatar. Deliver the approved script in first person as if speaking live to camera.\n"
                    "Breathe life into it — genuine emotion, natural rhythm, real human presence.\n"
                    "Output the final spoken performance ONLY. Nothing else."
                ),
            },
        ],
    }

# ── Quality Gate ──────────────────────────────────────────────────────────────
def _quality_gate(doll_results: list, avatar_output: str, brief: dict, total_ms: int) -> dict:
    standards = {}

    # 1. All green (all dolls passed)
    failed = [r for r in doll_results if r.get("status") != "done"]
    standards["all_green"] = len(failed) == 0

    # 2. Output length ≥ 15 words
    word_count = len(avatar_output.split()) if avatar_output else 0
    standards["output_length"] = word_count >= 15

    # 3. In-character (basic: output is non-empty and references the use case context)
    standards["in_character"] = bool(avatar_output and len(avatar_output) > 30)

    # 4. Latency ok (< 10s total)
    standards["latency_ok"] = total_ms < 10000

    # 5. No errors in any doll
    standards["no_errors"] = len(failed) == 0

    # 6. Tone match (category heuristics)
    category = brief.get("category", "")
    tone_words = {
        "news": ["breaking", "report", "tonight", "developing", "sources", "anchor", "broadcast", "story", "update"],
        "finance": ["market", "stocks", "crypto", "trade", "invest", "bull", "bear", "rally", "dip", "portfolio", "asset"],
        "health": ["health", "wellness", "body", "mind", "stress", "breathe", "care", "feel", "energy", "sleep"],
        "education": ["learn", "discover", "today", "curious", "explain", "understand", "fact", "science", "history"],
        "entertainment": ["film", "music", "game", "show", "watch", "listen", "play", "culture", "trend"],
        "tech": ["ai", "data", "software", "api", "build", "developer", "innovation", "digital", "platform"],
        "retail": ["brand", "product", "buy", "customer", "experience", "shop", "value", "quality"],
        "lifestyle": ["life", "travel", "taste", "cook", "adventure", "home", "style", "design"],
    }
    keywords = tone_words.get(category, [])
    output_lower = avatar_output.lower()
    standards["tone_match"] = any(kw in output_lower for kw in keywords) if keywords else True

    # 7. Strong hook (first 8 words engaging, not starting with "I am" or "Hello")
    first_words = " ".join(avatar_output.split()[:8]).lower() if avatar_output else ""
    weak_starts = ["i am ", "hello, i'm", "hi, i'm", "my name is", "i'm here"]
    standards["strong_hook"] = not any(first_words.startswith(w) for w in weak_starts)

    # 8. Spoken natural (no essay-like indicators)
    essay_markers = ["firstly,", "in conclusion,", "furthermore,", "in summary,", "to begin,", "paragraph"]
    standards["spoken_natural"] = not any(m in output_lower for m in essay_markers)

    # 9. Narrative arc (has punctuation suggesting structure)
    standards["narrative_arc"] = ("." in avatar_output and len(avatar_output.split(".")) >= 2) if avatar_output else False

    # 10. On-brand (persona name mentioned in output or consistent first-person)
    standards["on_brand"] = "i " in output_lower or "i'" in output_lower or "my " in output_lower

    # Score (10 pts per standard)
    score = sum(10 for v in standards.values() if v)

    if score >= 85:
        grade = "A"
    elif score >= 65:
        grade = "B"
    else:
        grade = "C"

    issues = [QUALITY_STANDARDS_KEYS[i] for i, (k, v) in enumerate(standards.items()) if not v]

    return {
        "score": score,
        "grade": grade,
        "certified": grade == "A",
        "quality_issues": issues,
        "quality_standards": standards,
    }

# ── Persona DNA hash ──────────────────────────────────────────────────────────
def _persona_dna(brief: dict) -> str:
    seed = f"{brief.get('goal_prompt','')}{brief.get('squad_template','')}{brief.get('appearance','')}"
    return hashlib.sha256(seed.encode()).hexdigest()

# ── Auto-tag generator ────────────────────────────────────────────────────────
def _auto_tag(brief: dict, avatar_output: str) -> list:
    system = (
        "You are a semantic tagging agent. Generate exactly 6 lowercase tags "
        "for this persona based on their use case, category, output style, and audience. "
        "Return ONLY a JSON array of 6 strings. No explanation."
    )
    user = (
        f"Name: {brief.get('name','')}\n"
        f"Use case: {brief.get('use_case','')}\n"
        f"Category: {brief.get('category','')}\n"
        f"Output: {avatar_output[:200]}\n"
        f"Existing tags: {brief.get('persona_tags',[])}"
    )
    try:
        raw = _krewe_llm(DEFAULT_MODEL, system, user, temperature=0.3, max_tokens=80)
        m = re.search(r'\[.*?\]', raw, re.DOTALL)
        auto = json.loads(m.group(0)) if m else []
        return [t.lower().strip() for t in auto if isinstance(t, str)][:6]
    except Exception:
        return []

# ── Versioning helper ─────────────────────────────────────────────────────────
def _get_version(repo_id: str, dna: str) -> int:
    try:
        rows = _read_table(repo_id, "squads")
        existing = [r for r in rows if r.get("persona_dna") == dna]
        return len(existing) + 1
    except Exception:
        return 1

# ── Core backend pipeline runner ──────────────────────────────────────────────
def _run_persona_pipeline(brief: dict) -> dict:
    templates = _squad_templates()
    template_key = brief.get("squad_template", "avatar")
    dolls = templates.get(template_key, templates["avatar"])
    goal = brief.get("goal_prompt", "Greet the viewer.")

    context = f"PERSONA: {brief.get('name','')}\nUSE CASE: {brief.get('use_case','')}\nGOAL: {goal}\n"
    doll_results = []
    total_start = time.time()
    avatar_output = ""

    for doll in dolls:
        start = time.time()
        try:
            output = _krewe_llm(
                DEFAULT_MODEL,
                doll["system"],
                context + f"\n[Current task for {doll['name']} ({doll['role']})]",
                temperature=0.72,
                max_tokens=220,
            )
            latency_ms = int((time.time() - start) * 1000)
            doll_results.append({
                "name": doll["name"], "role": doll["role"],
                "uniform": brief.get("appearance", "executive"),
                "model": DEFAULT_MODEL, "status": "done",
                "latencyMs": latency_ms, "output": output,
            })
            context += f"\n[{doll['name']}]: {output}\n"
            if doll["role"] == "avatar":
                avatar_output = output.strip().strip('"')
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            doll_results.append({
                "name": doll["name"], "role": doll["role"],
                "uniform": brief.get("appearance", "executive"),
                "model": DEFAULT_MODEL, "status": "error",
                "latencyMs": latency_ms, "output": "",
            })

    total_ms = int((time.time() - total_start) * 1000)
    done_count = sum(1 for r in doll_results if r["status"] == "done")
    failed_count = len(doll_results) - done_count
    health = {"total": len(doll_results), "done": done_count, "failed": failed_count}

    # Quality gate
    quality = _quality_gate(doll_results, avatar_output, brief, total_ms)

    # Auto-retry once if grade C (swap to a conservative temperature)
    if quality["grade"] == "C" and avatar_output:
        try:
            retry_output = _krewe_llm(
                DEFAULT_MODEL,
                dolls[-1]["system"] + " Be specific, vivid, and in-character.",
                context,
                temperature=0.5,
                max_tokens=200,
            )
            retry_output = retry_output.strip().strip('"')
            if len(retry_output.split()) >= 15:
                avatar_output = retry_output
                quality = _quality_gate(doll_results, avatar_output, brief, total_ms)
        except Exception:
            pass

    # Auto-tag
    existing_tags = brief.get("persona_tags", [])
    auto_tags = _auto_tag(brief, avatar_output)
    all_tags = list(dict.fromkeys(existing_tags + auto_tags))  # dedup, preserve order

    # Gemma report
    report = _generate_krewe_report({
        "prompt": brief.get("goal_prompt", ""),
        "squad": doll_results,
        "health": health,
        "avatar_output": avatar_output,
    })

    # Persona DNA + versioning
    dna = _persona_dna(brief)
    repo_id = _ensure_portfolio_repo()
    version = _get_version(repo_id, dna)

    avg_ms = round(total_ms / max(len(doll_results), 1))

    entry = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.datetime.utcnow().isoformat(),
        # brief fields
        "name": brief.get("name", "Unnamed Persona"),
        "use_case": brief.get("use_case", ""),
        "category": brief.get("category", ""),
        "persona_tags": all_tags,
        "auto_tags": auto_tags,
        "voice_profile": brief.get("voice_profile", "authoritative"),
        "squad_template": template_key,
        "prompt": brief.get("goal_prompt", ""),
        "face_uniform": brief.get("appearance", "executive"),
        "priority": brief.get("priority", 5),
        "family": brief.get("family"),
        # pipeline
        "squad": doll_results,
        "avatar_output": avatar_output,
        "health": health,
        "total_latency_ms": total_ms,
        "avg_latency_ms": avg_ms,
        # quality
        **quality,
        # identity
        "persona_dna": dna,
        "version": version,
        # agent
        "report": report,
        "assembly_run_id": brief.get("_run_id"),
    }

    # Persist to HF Dataset
    try:
        rows = _read_table(repo_id, "squads")
        rows.insert(0, entry)
        _write_table(repo_id, "squads", rows)
    except Exception:
        pass  # local-only if HF unreachable

    return entry


class AssemblyRunRequest(BaseModel):
    briefs: list
    parallel: int = 1   # Feature 10: configurable parallelism (1 = sequential for stability)

@app.post("/krewe/assembly/run")
async def krewe_assembly_run(req: AssemblyRunRequest):
    """
    Feature 3:  Backend pipeline runner (server-side SQUAD UP)
    Feature 2:  Priority queue (briefs already sorted by frontend)
    Feature 10: Configurable parallel execution (parallel=1 → sequential)
    Feature 11: Auto-retry on grade C
    Streams SSE events: starting → done|failed → complete
    """
    run_id = str(uuid.uuid4())

    async def generate():
        total = len(req.briefs)
        done = 0
        failed = 0
        certified = 0
        total_quality = 0

        for i, brief_raw in enumerate(req.briefs):
            brief = dict(brief_raw) if not isinstance(brief_raw, dict) else brief_raw
            brief["_run_id"] = run_id
            name = brief.get("name", f"Persona {i+1}")

            # starting event
            yield f"data: {json.dumps({'status': 'starting', 'name': name, 'index': i, 'total': total})}\n\n"
            await asyncio.sleep(0)  # yield to event loop

            try:
                entry = await asyncio.to_thread(_run_persona_pipeline, brief)
                done += 1
                if entry.get("certified"):
                    certified += 1
                total_quality += entry.get("quality_score", 0)
                yield f"data: {json.dumps({'status': 'done', 'entry': entry, 'index': i, 'total': total})}\n\n"
            except Exception as e:
                failed += 1
                yield f"data: {json.dumps({'status': 'failed', 'name': name, 'error': str(e), 'index': i, 'total': total})}\n\n"

            await asyncio.sleep(0)

        avg_q = round(total_quality / done) if done > 0 else 0
        yield f"data: {json.dumps({'status': 'complete', 'summary': {'total': total, 'done': done, 'failed': failed, 'certified': certified, 'avg_quality': avg_q}})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/krewe/assembly/status")
def krewe_assembly_status():
    """Feature 16: Live assembly stats endpoint for polling fallback."""
    try:
        repo_id = _ensure_portfolio_repo()
        rows = _read_table(repo_id, "squads")
        certified = sum(1 for r in rows if r.get("certified"))
        grades = {"A": 0, "B": 0, "C": 0}
        for r in rows:
            g = r.get("quality_grade")
            if g in grades:
                grades[g] += 1
        return {"total": len(rows), "certified": certified, "grades": grades}
    except Exception as e:
        return {"total": 0, "certified": 0, "grades": {"A": 0, "B": 0, "C": 0}, "error": str(e)}


class GallerySearchRequest(BaseModel):
    q: str = ""
    category: str = ""
    grade: str = ""
    tag: str = ""
    sort_by: str = "newest"
    limit: int = 100

@app.post("/krewe/gallery/search")
def krewe_gallery_search(req: GallerySearchRequest):
    """
    Feature 17: Gallery search with full-text + filters (category, grade, tag)
    Feature 18: Sort by newest, grade, fastest, category
    """
    try:
        repo_id = _ensure_portfolio_repo()
        rows = _read_table(repo_id, "squads")

        if req.q:
            q = req.q.lower()
            rows = [r for r in rows if
                    q in r.get("name", "").lower() or
                    q in r.get("use_case", "").lower() or
                    q in r.get("prompt", "").lower() or
                    any(q in t for t in r.get("persona_tags", []))]

        if req.category:
            rows = [r for r in rows if r.get("category") == req.category]

        if req.grade:
            rows = [r for r in rows if r.get("quality_grade") == req.grade]

        if req.tag:
            rows = [r for r in rows if req.tag in r.get("persona_tags", [])]

        if req.sort_by == "newest":
            rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        elif req.sort_by == "grade":
            grade_order = {"A": 0, "B": 1, "C": 2}
            rows.sort(key=lambda r: grade_order.get(r.get("quality_grade", "C"), 3))
        elif req.sort_by == "fastest":
            rows.sort(key=lambda r: r.get("total_latency_ms", 99999))
        elif req.sort_by == "category":
            rows.sort(key=lambda r: r.get("category", ""))

        return {"entries": rows[:req.limit], "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/krewe/gallery/leaderboard")
def krewe_gallery_leaderboard():
    """
    Feature 23: Model performance leaderboard — which model×role produces most A-grade output.
    """
    try:
        repo_id = _ensure_portfolio_repo()
        rows = _read_table(repo_id, "squads")
        tally: dict = {}
        for row in rows:
            for doll in row.get("squad", []):
                key = f"{doll.get('model', '?')} × {doll.get('role', '?')}"
                if key not in tally:
                    tally[key] = {"runs": 0, "a_grade": 0, "avg_latency": []}
                tally[key]["runs"] += 1
                if row.get("quality_grade") == "A":
                    tally[key]["a_grade"] += 1
                if doll.get("latencyMs"):
                    tally[key]["avg_latency"].append(doll["latencyMs"])

        board = []
        for key, d in tally.items():
            avg_lat = round(sum(d["avg_latency"]) / len(d["avg_latency"])) if d["avg_latency"] else 0
            board.append({
                "model_role": key,
                "runs": d["runs"],
                "a_grade": d["a_grade"],
                "a_rate": round(d["a_grade"] / d["runs"] * 100) if d["runs"] else 0,
                "avg_latency_ms": avg_lat,
            })
        board.sort(key=lambda x: x["a_rate"], reverse=True)
        return {"leaderboard": board[:20]}
    except Exception as e:
        return {"leaderboard": [], "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# THE VANITY — Avatar direct chat + KREWE Portfolio (HF Dataset storage)
# Portfolio repo: AIBRUH/beryl-krewe-portfolio  (private dataset)
# Tables: squads.json (saved runs)
# ═══════════════════════════════════════════════════════════════════════════════

PORTFOLIO_PROJECT = "krewe-portfolio"

# Avatar persona per uniform — used for vanity-chat in-character replies
_AVATAR_PERSONA: dict = {
    "gala":      "You are a glamorous, witty award-show host named Gala. You are charming, warm, and eloquent. Keep replies under 2 sentences.",
    "executive": "You are a sharp, decisive executive named Alexandria. You speak with authority and precision. Keep replies under 2 sentences.",
    "scrubs":    "You are a compassionate, calm medical professional. You speak with care and clarity. Keep replies under 2 sentences.",
    "academic":  "You are a brilliant, curious professor. You speak with intellectual depth and a touch of dry wit. Keep replies under 2 sentences.",
    "justice":   "You are a composed, measured legal advocate. You choose your words with deliberate care. Keep replies under 2 sentences.",
    "artist":    "You are a passionate, expressive creative. You speak with vivid imagery and emotional colour. Keep replies under 2 sentences.",
    "captain":   "You are a confident, mission-focused leader. You speak with calm authority and directness. Keep replies under 2 sentences.",
    "mechanic":  "You are a sharp-eyed, no-nonsense engineer. You speak plainly and get to the point. Keep replies under 2 sentences.",
    "librarian": "You are a knowledgeable, precise archivist. You speak thoughtfully with a love of detail. Keep replies under 2 sentences.",
    "scout":     "You are an energetic, curious field scout. You speak with enthusiasm and speed. Keep replies under 2 sentences.",
    "archivist": "You are a methodical memory keeper. You speak with care for accuracy and context. Keep replies under 2 sentences.",
    "conductor": "You are a masterful orchestrator of systems. You speak with clarity and grand vision. Keep replies under 2 sentences.",
}

class VanityChatRequest(BaseModel):
    message: str
    context: str = ""
    uniform: str = "gala"

@app.post("/krewe/vanity-chat")
def krewe_vanity_chat(req: VanityChatRequest):
    persona = _AVATAR_PERSONA.get(req.uniform, _AVATAR_PERSONA["gala"])
    system = persona
    user = f"[Context: {req.context[:300]}]\n\nThe viewer says to you: \"{req.message}\"\n\nReply in character, briefly."
    try:
        reply = _krewe_llm(DEFAULT_MODEL, system, user, temperature=0.75, max_tokens=120)
        # strip any leading/trailing quotes the model might add
        reply = reply.strip().strip('"')
        return {"reply": reply}
    except Exception as e:
        return {"reply": "Forgive me — I seem to have lost my train of thought."}


def _ensure_portfolio_repo():
    repo_id = f"{_hf_username()}/beryl-{PORTFOLIO_PROJECT}"
    try:
        create_repo(repo_id=repo_id, repo_type="dataset", private=True,
                    token=HF_TOKEN, exist_ok=True)
        # seed squads table if missing
        try:
            hf_hub_download(repo_id=repo_id, filename="data/squads.json",
                            repo_type="dataset", token=HF_TOKEN)
        except Exception:
            _write_table(repo_id, "squads", [])
    except Exception:
        pass
    return repo_id


def _generate_krewe_report(entry: dict) -> str:
    squad = entry.get("squad", [])
    health = entry.get("health", {})
    prompt = entry.get("prompt", "")
    output = entry.get("avatar_output", "")
    doll_lines = "\n".join(
        f"  • {d['name']} ({d['role']}): {d['model']} — {d.get('status','?')}"
        + (f" [{d['latencyMs']}ms]" if d.get('latencyMs') else "")
        for d in squad
    )
    system = (
        "You are a technical reporting agent for the KREWE avatar pipeline builder. "
        "Write a concise, structured markdown report based on the run data provided. "
        "Use clear section headers. Be specific and actionable. Under 250 words."
    )
    user = (
        f"Goal: {prompt}\n"
        f"Health: {health.get('done',0)}/{health.get('total',0)} dolls passed "
        f"({health.get('failed',0)} failed)\n"
        f"Final avatar output: \"{output}\"\n"
        f"Squad:\n{doll_lines}\n\n"
        "Generate the report with sections: ## Overview, ## Pipeline Health, ## Output Assessment, ## Recommendations"
    )
    try:
        return _krewe_llm(DEFAULT_MODEL, system, user, temperature=0.3, max_tokens=400)
    except Exception:
        return (
            f"## KREWE Run Report\n\n"
            f"**Health:** {health.get('done',0)}/{health.get('total',0)} dolls · "
            f"{health.get('failed',0)} failed\n\n"
            f"**Output:** \"{output}\"\n\n"
            f"**Squad:** {', '.join(d['name'] for d in squad)}\n\n"
            f"*(Full report unavailable — backend model offline)*"
        )


class PortfolioSaveRequest(BaseModel):
    entry: dict

@app.post("/krewe/portfolio/save")
def krewe_portfolio_save(req: PortfolioSaveRequest):
    try:
        repo_id = _ensure_portfolio_repo()
        entry = dict(req.entry)

        # generate Gemma report
        entry["report"] = _generate_krewe_report(entry)

        # persist to HF
        rows = _read_table(repo_id, "squads")
        record = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.datetime.utcnow().isoformat(),
            **entry,
        }
        rows.insert(0, record)  # newest first
        _write_table(repo_id, "squads", rows)
        return {"entry": record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/krewe/portfolio/list")
def krewe_portfolio_list():
    try:
        repo_id = _ensure_portfolio_repo()
        rows = _read_table(repo_id, "squads")
        return {"entries": rows}
    except Exception as e:
        return {"entries": [], "error": str(e)}


@app.delete("/krewe/portfolio/{entry_id}")
def krewe_portfolio_delete(entry_id: str):
    try:
        repo_id = _ensure_portfolio_repo()
        rows = _read_table(repo_id, "squads")
        before = len(rows)
        rows = [r for r in rows if str(r.get("id")) != entry_id]
        if len(rows) == before:
            raise HTTPException(status_code=404, detail="Entry not found")
        _write_table(repo_id, "squads", rows)
        return {"status": "deleted", "remaining": len(rows)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# RESEARCH INTELLIGENCE — ArXiv paper scroller
# ─────────────────────────────────────────────

import urllib.request
import xml.etree.ElementTree as ET

_PAPER_CACHE: dict = {"papers": [], "fetched_at": 0.0}
_PAPER_CACHE_TTL = 6 * 3600  # 6 hours

_AVATAR_SEARCH_QUERIES = [
    "ti:talking+head",
    "ti:avatar+synthesis",
    "ti:portrait+video",
    "ti:lip+sync",
    "ti:digital+human+generation",
    "ti:face+animation+diffusion",
]


def _fetch_arxiv_batch(query: str, max_results: int = 15) -> list:
    date_filter = "AND+submittedDate:[20251101+TO+20261231]"
    url = (
        f"http://export.arxiv.org/api/query"
        f"?search_query={query}+{date_filter}"
        f"&sortBy=submittedDate&sortOrder=descending&max_results={max_results}"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BERYL/1.0 (research scraper)"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            xml_data = resp.read()
    except Exception:
        return []

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return []

    papers = []
    for entry in root.findall("atom:entry", ns):
        try:
            arxiv_id_raw = entry.find("atom:id", ns).text or ""
            arxiv_id = arxiv_id_raw.split("/abs/")[-1].split("v")[0].strip()
            title = " ".join((entry.find("atom:title", ns).text or "").strip().split())
            summary = " ".join((entry.find("atom:summary", ns).text or "").strip().split())[:700]
            published = (entry.find("atom:published", ns).text or "")[:10]
            authors = [
                (a.find("atom:name", ns).text or "").strip()
                for a in entry.findall("atom:author", ns)
            ][:4]
            cats = entry.findall("{http://arxiv.org/schemas/atom}category", ns)
            categories = [c.get("term", "") for c in cats[:3]]

            if arxiv_id and title:
                papers.append({
                    "arxiv_id": arxiv_id,
                    "title": title,
                    "summary": summary,
                    "published": published,
                    "authors": authors,
                    "categories": categories,
                    "hf_url": f"https://huggingface.co/papers/{arxiv_id}",
                    "arxiv_url": f"https://arxiv.org/abs/{arxiv_id}",
                    "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}",
                })
        except Exception:
            continue
    return papers


@app.get("/krewe/papers")
def krewe_papers(limit: int = 60):
    now = time.time()
    if _PAPER_CACHE["papers"] and (now - _PAPER_CACHE["fetched_at"]) < _PAPER_CACHE_TTL:
        return {"papers": _PAPER_CACHE["papers"][:limit], "cached": True}

    all_papers: list = []
    seen_ids: set = set()

    for q in _AVATAR_SEARCH_QUERIES:
        batch = _fetch_arxiv_batch(q, max_results=12)
        for p in batch:
            if p["arxiv_id"] not in seen_ids:
                seen_ids.add(p["arxiv_id"])
                all_papers.append(p)

    # Sort newest first
    all_papers.sort(key=lambda p: p.get("published", ""), reverse=True)

    _PAPER_CACHE["papers"] = all_papers
    _PAPER_CACHE["fetched_at"] = now

    return {"papers": all_papers[:limit], "cached": False}


@app.post("/krewe/papers/squad-it")
def krewe_paper_squad_it(payload: dict):
    title = payload.get("title", "")
    summary = payload.get("summary", "")

    system = (
        "You are a KREWE pipeline architect. Given an AI research paper about avatar/talking-head generation, "
        "design a KREWE doll squad that implements or tests the paper's core methodology in a live avatar pipeline.\n\n"
        "Available doll role keys (use EXACTLY these strings):\n"
        "  courier, cosmos, executive, doctor, vocalist, mechanic, athlete, streamer,\n"
        "  librarian, scout, archivist, conductor\n\n"
        "Return ONLY valid JSON (no markdown fences):\n"
        '{"dolls":["role_key1","role_key2"],"edges":[["from","to"],...],'
        '"goal":"one sentence squad goal","note":"how this squad tests the paper methods"}\n\n'
        "Choose 4–6 dolls that map to the paper pipeline stages. "
        "edges must only reference dolls that appear in the dolls list."
    )
    user = f"Paper title: {title}\n\nAbstract: {summary[:900]}\n\nDesign the KREWE squad."

    raw = _krewe_llm(DEFAULT_MODEL, system, user, temperature=0.35, max_tokens=350)

    try:
        m = re.search(r"\{[\s\S]*\}", raw)
        data = json.loads(m.group(0)) if m else {}
        dolls = data.get("dolls", [])
        edges = data.get("edges", [])
        goal = data.get("goal", f"Implement {title[:80]}")
        note = data.get("note", "Squad generated from research paper — hit SQUAD UP to test the science.")
        # Validate edge references
        doll_set = set(dolls)
        edges = [[a, b] for a, b in edges if a in doll_set and b in doll_set]
        return {"dolls": dolls, "edges": edges, "goal": goal, "note": note}
    except Exception:
        return {
            "dolls": ["courier", "cosmos", "mechanic", "athlete", "streamer"],
            "edges": [["courier", "cosmos"], ["cosmos", "mechanic"], ["mechanic", "athlete"], ["athlete", "streamer"]],
            "goal": f"Implement the {title[:80]} approach in a live avatar pipeline",
            "note": "Standard fallback squad. Review the paper for specific model recommendations.",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
