#!/usr/bin/env python3
"""
generate_video.py — Brand-aesthetic short-form video via ffmpeg (waveform) + Veo (AI clips).

Three video types:
  waveform   — Audio waveform visualizer over brand background, optional cover art overlay.
               Fast, deterministic, always on-brand.
  ai-clip    — Single 8-second Veo clip from a text description.
  storyboard — Multi-scene Veo composition (Gemini writes scenes, Veo animates, ffmpeg stitches).

Usage:
    python scripts/generate_video.py waveform \\
        --audio audio/recordings/my-recording_final.wav \\
        --cover outputs/social/<brand-slug>_cover_square_*.png \\
        --formats portrait square

    python scripts/generate_video.py ai-clip \\
        --prompt "morning light through linen curtains, slow breath" \\
        --format portrait

    python scripts/generate_video.py storyboard \\
        --prompt "executive finds stillness through morning practice" \\
        --scenes 3 --format portrait
"""

from __future__ import annotations

import argparse
import logging
import shutil
import subprocess
import sys
import time
from pathlib import Path

from _brand import REPO_ROOT, brand_slug, load_visual_style

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

OUT_DIR = REPO_ROOT / "outputs" / "social"

FORMAT_SPECS = {
    "landscape": (1920, 1080),
    "square": (1080, 1080),
    "portrait": (1080, 1920),
}


def hex_to_ffmpeg(color: str) -> str:
    """#f5f0eb -> 0xf5f0eb"""
    return "0x" + color.lstrip("#")


def check_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        log.error("ffmpeg not found. brew install ffmpeg")
        sys.exit(1)
    return ffmpeg


def render_waveform(
    audio: Path,
    cover: Path | None,
    fmt: str,
    output: Path,
    bg_color: str,
    wave_color: str,
    accent_color: str,
) -> None:
    ffmpeg = check_ffmpeg()
    width, height = FORMAT_SPECS[fmt]
    bg = hex_to_ffmpeg(bg_color)
    wave = hex_to_ffmpeg(wave_color)
    accent = hex_to_ffmpeg(accent_color)

    if cover and cover.exists():
        cmd = [
            ffmpeg, "-y",
            "-loop", "1", "-i", str(cover),
            "-i", str(audio),
            "-filter_complex",
            (
                f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color={accent}[bg];"
                f"[1:a]showwaves=s={width}x{height}:mode=cline:rate=30:"
                f"colors={wave}:scale=sqrt[w];"
                f"[bg][w]blend=all_mode=screen[out]"
            ),
            "-map", "[out]",
            "-map", "1:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(output),
        ]
    else:
        cmd = [
            ffmpeg, "-y",
            "-i", str(audio),
            "-filter_complex",
            (
                f"color=c={bg}:s={width}x{height}:r=30[bg];"
                f"[0:a]showwaves=s={width}x{height}:mode=cline:rate=30:"
                f"colors={wave}:scale=sqrt[w];"
                f"[bg][w]blend=all_mode=screen[out]"
            ),
            "-map", "[out]",
            "-map", "0:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(output),
        ]

    log.info("Rendering waveform video: %s (%dx%d)", output.name, width, height)
    output.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log.error("ffmpeg failed:\n%s", result.stderr[-2000:])
        sys.exit(result.returncode)
    log.info("Saved: %s", output)


def render_ai_clip(prompt: str, fmt: str, output: Path) -> None:
    """Veo 3 AI clip generation. Requires GOOGLE_CLOUD_PROJECT."""
    log.warning(
        "ai-clip generation requires Veo 3 API access via Vertex AI. "
        "This stub does not call the API — wire it up when access is granted. "
        "See iron-static/scripts/storyboard_video.py for the working pattern."
    )
    sys.exit(78)  # EX_CONFIG — feature not yet enabled


def render_storyboard(prompt: str, scenes: int, fmt: str, output: Path) -> None:
    """Multi-scene storyboard via Gemini + Veo + ffmpeg xfade."""
    log.warning(
        "storyboard generation requires Veo 3 + Imagen 4 access via Vertex AI. "
        "This stub does not call the API — wire it up when access is granted. "
        "See iron-static/scripts/storyboard_video.py for the working pattern."
    )
    sys.exit(78)


def cmd_waveform(args: argparse.Namespace) -> None:
    vstyle = load_visual_style()
    palette = vstyle.get("palette", {})
    bg = palette.get("background", "#0a0a0a")
    primary = palette.get("primary", "#3d5a47")
    accent = palette.get("accent", "#c9a96e")

    formats = args.formats or ["portrait"]
    ts = int(time.time())
    slug = brand_slug()

    for fmt in formats:
        out = args.output_dir / f"{slug}_waveform_{fmt}_{ts}.mp4"
        render_waveform(args.audio, args.cover, fmt, out, bg, primary, accent)
        print(str(out))


def main() -> None:
    parser = argparse.ArgumentParser(description="Brand-aesthetic short-form video generator.")
    parser.add_argument("--output-dir", type=Path, default=OUT_DIR)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_wave = sub.add_parser("waveform", help="Audio waveform visualizer.")
    p_wave.add_argument("--audio", type=Path, required=True)
    p_wave.add_argument("--cover", type=Path, default=None)
    p_wave.add_argument("--formats", nargs="+", choices=list(FORMAT_SPECS), default=None)

    p_clip = sub.add_parser("ai-clip", help="Single Veo AI clip (8s).")
    p_clip.add_argument("--prompt", required=True)
    p_clip.add_argument("--format", choices=list(FORMAT_SPECS), default="portrait")

    p_story = sub.add_parser("storyboard", help="Multi-scene Veo composition.")
    p_story.add_argument("--prompt", required=True)
    p_story.add_argument("--scenes", type=int, default=3)
    p_story.add_argument("--format", choices=list(FORMAT_SPECS), default="portrait")

    args = parser.parse_args()

    if args.cmd == "waveform":
        cmd_waveform(args)
    elif args.cmd == "ai-clip":
        ts = int(time.time())
        out = args.output_dir / f"{brand_slug()}_aiclip_{args.format}_{ts}.mp4"
        render_ai_clip(args.prompt, args.format, out)
    elif args.cmd == "storyboard":
        ts = int(time.time())
        out = args.output_dir / f"{brand_slug()}_storyboard_{args.format}_{ts}.mp4"
        render_storyboard(args.prompt, args.scenes, args.format, out)


if __name__ == "__main__":
    main()
