"""
AIBRUH/ditto — Amanda's talking head engine.
SadTalker-backed portrait animation: image + audio → MP4.
ZeroGPU A100 Space.
"""
import gradio as gr
import spaces
import os
import sys
import subprocess
import tempfile

# ── One-time setup ──────────────────────────────────────────────────────────
SADTALKER = "/tmp/SadTalker"
CKPT = f"{SADTALKER}/checkpoints"
GFPGAN = f"{SADTALKER}/gfpgan/weights"

def _setup():
    if not os.path.exists(f"{CKPT}/SadTalker_V0.0.2_256.safetensors"):
        subprocess.run(["git", "clone", "--depth=1",
                        "https://github.com/OpenTalker/SadTalker.git", SADTALKER], check=True)
        os.makedirs(CKPT, exist_ok=True)
        os.makedirs(GFPGAN, exist_ok=True)
        from huggingface_hub import hf_hub_download, snapshot_download
        snapshot_download("vinthony/SadTalker-V002rc", local_dir=CKPT, ignore_patterns=["*.md"])
        hf_hub_download("tencent/GFPGANv1.4", filename="GFPGANv1.4.pth",
                        local_dir=GFPGAN)
    if SADTALKER not in sys.path:
        sys.path.insert(0, SADTALKER)

_setup()

from src.gradio_demo import SadTalker as _ST  # noqa: E402

_sad: _ST | None = None

def _load():
    global _sad
    if _sad is None:
        _sad = _ST(CKPT, f"{SADTALKER}/config", lazy_load=True)
    return _sad


@spaces.GPU
def infer(source_image: str, driven_audio: str):
    """image filepath + audio filepath → video filepath"""
    st = _load()
    result = st.test(
        source_image=source_image,
        driven_audio=driven_audio,
        preprocess="crop",
        still_mode=True,
        use_enhancer=False,
        batch_size=1,
        size=256,
        pose_style=0,
        exp_scale=1.0,
        use_ref_video=False,
        ref_video=None,
        ref_info="pose",
        use_idle_mode=False,
        length_of_audio=0,
        use_blink=True,
    )
    return result


with gr.Blocks(title="AIBRUH/ditto — Amanda Engine") as demo:
    gr.Markdown("## AIBRUH/ditto · Amanda Talking Head Engine")
    with gr.Row():
        img_in = gr.Image(type="filepath", label="Source Portrait")
        aud_in = gr.Audio(type="filepath", label="Driving Audio (WAV)")
    btn = gr.Button("Generate", variant="primary")
    vid_out = gr.Video(label="Amanda Speaking")
    btn.click(fn=infer, inputs=[img_in, aud_in], outputs=vid_out, api_name="infer")

demo.launch()
