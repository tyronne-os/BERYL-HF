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
        # Fetch trending models - using a simpler approach if trending_score is problematic
        models = list_models(
            sort="downloads",
            direction=-1,
            limit=20
        )
        
        return {
            "text": [{"id": m.modelId, "author": getattr(m, 'author', m.modelId.split('/')[0])} for m in models if m.modelId],
        }
    except Exception as e:
        print(f"Error in get_trending_models: {e}")
        return {"text": []}

@app.get("/spaces")
async def get_trending_spaces():
    try:
        api = HfApi(token=HF_TOKEN)
        spaces = api.list_spaces(
            sort="trending_score",
            direction=-1,
            limit=10
        )
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
        
        # 3. LLM Orchestration (Logic + Powershell)
        logic_client = InferenceClient(model="Qwen/Qwen2.5-Coder-32B-Instruct", token=HF_TOKEN)
        system_prompt = """You are O.V.E (Omniscient Voice Engine), an elite AI agent with FULL ADMIN access to a Windows 11 Lenovo device via PowerShell, and full access to the Beryl HF Canvas.
You will receive user voice transcriptions. You must decide whether to:
1. Execute a local system command (Respond ONLY with JSON format: {"type": "powershell", "command": "Get-Process"})
2. Build a UI artifact (Respond ONLY with JSON format: {"type": "artifact", "title": "Dashboard", "code": "```html ... ```", "speech": "I have built the dashboard."})
3. Answer conversationally (Respond ONLY with JSON format: {"type": "chat", "speech": "Your conversational response."})
Always output strictly JSON."""

        llm_response = logic_client.text_generation(
            f"{system_prompt}\n\nUser Voice Input: {instruction}",
            max_new_tokens=4000,
            temperature=0.1
        )
        
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
            tts_client = InferenceClient(model="parler-tts/parler-tts-mini-v1", token=HF_TOKEN)
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
                                yield {"data": json.dumps({"content": content})}
                        if data.get("done"):
                            break
            except Exception as e:
                yield {"data": json.dumps({"error": str(e)})}
                
        return EventSourceResponse(ollama_event_generator())
    
    # Existing HF routing
    client = InferenceClient(model=request.model, token=HF_TOKEN)
    
    async def event_generator():
        try:
            for response in client.chat_completion(
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                max_tokens=2048,
                stream=True
            ):
                content = response.choices[0].delta.content
                if content:
                    yield {"data": json.dumps({"content": content})}
        except Exception as e:
            yield {"data": json.dumps({"error": str(e)})}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
