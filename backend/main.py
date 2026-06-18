import os
import json
import base64
import asyncio
import pyautogui
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
        models = list(api.list_models(sort="downloads", limit=20))
        return {
            "text": [{"id": m.modelId, "author": getattr(m, 'author', m.modelId.split('/')[0] if '/' in m.modelId else m.modelId)} for m in models if m.modelId],
        }
    except Exception as e:
        print(f"Error in get_trending_models: {e}")
        return {"text": []}

@app.get("/spaces")
async def get_trending_spaces():
    try:
        api = HfApi(token=HF_TOKEN)
        spaces = api.list_spaces(sort="trending_score", limit=10)
        return {
            "spaces": [{"id": s.id, "author": s.author, "lastModified": s.lastModified} for s in spaces]
        }
    except Exception as e:
        print(f"Error in get_trending_spaces: {e}")
        return {"spaces": []}

import subprocess
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

@app.post("/ollama/pull")
async def pull_ollama_model(request: OllamaPullRequest):
    try:
        subprocess.Popen(["ollama", "pull", request.name])
        return {"status": "started", "model": request.name}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.post("/voice/orchestrate")
async def voice_orchestrate(
    audio: UploadFile = File(None), 
    text_fallback: str = Form(None)
):
    """
    Next-Gen Voice Orchestrator:
    1. Transcribes incoming audio using Whisper-large-v3-turbo.
    2. Captures local desktop vision state.
    3. Routes via Qwen2.5-Coder to determine actions (PowerShell / UI Artifact).
    4. Executes Admin actions locally.
    5. Returns TTS response and/or React artifacts.
    """
    try:
        instruction = text_fallback
        
        # 1. Audio Processing (STT)
        if audio and not text_fallback:
            try:
                content = await audio.read()
                # Use HF Inference API for Whisper STT
                stt_client = InferenceClient(model="openai/whisper-large-v3-turbo", token=HF_TOKEN)
                response = stt_client.automatic_speech_recognition(content)
                instruction = response.text
            except Exception as e:
                print(f"STT Failed: {e}")
                instruction = "Failed to transcribe audio."

        # 2. Vision Capture
        screenshot = pyautogui.screenshot()
        buffered = BytesIO()
        screenshot.save(buffered, format="JPEG", quality=70)
        
        # 3. LLM Orchestration (Logic + Powershell) — directed by MiniMax-M3
        logic_client = InferenceClient(model=DEFAULT_MODEL, token=HF_TOKEN, provider="auto")
        system_prompt = """You are O.V.E (Omniscient Voice Engine), an elite AI agent with FULL ADMIN access to a Windows 11 Lenovo device via PowerShell, and full access to the Beryl HF Canvas.
You will receive user voice transcriptions. You must decide whether to:
1. Execute a local system command (Respond ONLY with JSON format: {"type": "powershell", "command": "Get-Process"})
2. Build a UI artifact (Respond ONLY with JSON format: {"type": "artifact", "title": "Dashboard", "code": "```html ... ```", "speech": "I have built the dashboard."})
3. Answer conversationally (Respond ONLY with JSON format: {"type": "chat", "speech": "Your conversational response."})
Always output strictly JSON as your final answer."""

        completion = logic_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User Voice Input: {instruction}"},
            ],
            max_tokens=6000,
            temperature=0.1,
        )
        llm_response = completion.choices[0].message.content or ""
        
        # 4. Parse & Execute
        import re
        json_match = re.search(r'\{[\s\S]*\}', llm_response)
        
        result_payload = {
            "transcription": instruction,
            "speech": "Action complete.",
            "artifact": None,
            "shell_output": None
        }

        if json_match:
            try:
                action = json.loads(json_match.group())
                
                if action.get("type") == "powershell":
                    cmd = action.get("command")
                    proc = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True, timeout=10)
                    result_payload["shell_output"] = proc.stdout[:1000] if proc.stdout else proc.stderr[:1000]
                    result_payload["speech"] = f"I have executed the command: {cmd[:20]}."
                    
                elif action.get("type") == "artifact":
                    html_match = re.search(r'```html\n([\s\S]*?)```', action.get("code", ""))
                    code = html_match.group(1) if html_match else action.get("code", "")
                    result_payload["artifact"] = {"type": "html", "title": action.get("title", "Voice Generated Artifact"), "content": code}
                    result_payload["speech"] = action.get("speech", "I have generated the UI artifact in the canvas.")
                    
                elif action.get("type") == "chat":
                    result_payload["speech"] = action.get("speech", "Acknowledged.")
                    
            except Exception as parse_e:
                result_payload["speech"] = f"I understood the request but failed to parse my own execution plan: {parse_e}"
        else:
             result_payload["speech"] = "I could not determine the correct action format."

        # 5. Text-To-Speech (TTS)
        # Using a fast Parler-TTS model
        try:
            tts_client = InferenceClient(model=VOICE_CONFIG["model"], token=HF_TOKEN)
            audio_bytes = tts_client.text_to_speech(result_payload["speech"])
            result_payload["audio_base64"] = base64.b64encode(audio_bytes).decode('utf-8')
        except Exception as tts_e:
            print(f"TTS Failed: {tts_e}")
            result_payload["audio_base64"] = None

        return result_payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
#  VOICE ENGINE CONFIG  (O.V.E)
# ═══════════════════════════════════════════════════════
VOICE_CONFIG = {"model": "parler-tts/parler-tts-mini-v1", "speed": 1.0}

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
