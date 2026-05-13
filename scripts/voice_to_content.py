#!/usr/bin/env python3
"""
voice_to_content.py — End-to-end voice-first content pipeline.

ONE voice memo in → full content kit out:
    transcript .txt          (Gemini)
    music bed .wav           (Lyria)
    mixed audio .wav         (ffmpeg, voice-first ratios from brand.json)
    content brief .md        (Gemini, calibrated to brand voice)
    cover image .png         (Imagen 4, brand visual style)
    waveform video .mp4      (ffmpeg + cover overlay, brand palette)

This is the priority pipeline. Record a voice memo, this script delivers a posting kit.

Usage:
    python scripts/voice_to_content.py audio/recordings/raw/2025-11-21-morning.wav

    # Skip steps you don't need
    python scripts/voice_to_content.py voice.wav --skip image
    python scripts/voice_to_content.py voice.wav --skip bed --skip mix --skip video

    # Override duration of generated bed (default = ceil to nearest 30s above voice length)
    python scripts/voice_to_content.py voice.wav --bed-duration 120
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import shutil
import subprocess
import sys
from pathlib import Path

from _brand import REPO_ROOT

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

SCRIPTS_DIR = REPO_ROOT / "scripts"
PYTHON = sys.executable

ALL_STEPS = ["transcribe", "bed", "mix", "brief", "image", "video"]


def run_script(script: str, *args: str) -> str:
    """Run a script and return its stdout (last line is the produced path)."""
    cmd = [PYTHON, str(SCRIPTS_DIR / script), *args]
    log.info("→ %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log.error("FAILED: %s\n%s", script, result.stderr)
        sys.exit(result.returncode)
    if result.stderr:
        sys.stderr.write(result.stderr)
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""


def voice_duration_seconds(path: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        log.warning("ffprobe missing — defaulting bed duration to 90s.")
        return 90.0
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def main() -> None:
    parser = argparse.ArgumentParser(description="Voice memo → full content kit (voice-first).")
    parser.add_argument("voice", type=Path, help="Voice memo WAV file.")
    parser.add_argument("--skip", action="append", choices=ALL_STEPS, default=[],
                        help="Skip a pipeline step. Can repeat.")
    parser.add_argument("--bed-duration", type=int, default=None,
                        help="Override bed duration in seconds.")
    parser.add_argument("--bed-mood", default=None,
                        help="Override bed mood from brand.json.")
    args = parser.parse_args()

    if not args.voice.exists():
        log.error("Voice file not found: %s", args.voice)
        sys.exit(2)

    skip = set(args.skip)
    artifacts: dict[str, str] = {"voice_input": str(args.voice)}

    # 1. Transcribe
    if "transcribe" in skip:
        log.info("Skipping transcribe.")
        transcript = None
    else:
        transcript = run_script("transcribe_audio.py", str(args.voice))
        artifacts["transcript"] = transcript

    # 2. Generate music bed
    if "bed" in skip:
        log.info("Skipping bed.")
        bed = None
    else:
        if args.bed_duration:
            bed_dur = args.bed_duration
        else:
            voice_dur = voice_duration_seconds(args.voice)
            bed_dur = max(30, int(math.ceil(voice_dur / 30.0) * 30))
        bed_args = ["--duration", str(bed_dur)]
        if args.bed_mood:
            bed_args += ["--mood", args.bed_mood]
        bed = run_script("generate_audio.py", *bed_args)
        artifacts["bed"] = bed

    # 3. Mix voice + bed (voice-first ratios from brand.json)
    if "mix" in skip:
        log.info("Skipping mix.")
        mixed = None
    else:
        if not bed:
            log.warning("No bed available — cannot mix. Skipping mix.")
            mixed = None
        else:
            mixed = run_script("mix_voice.py", "--voice", str(args.voice), "--bed", bed)
            artifacts["mixed_audio"] = mixed

    # 4. Content brief from transcript
    if "brief" in skip:
        log.info("Skipping brief.")
        brief = None
    else:
        if not transcript:
            log.warning("No transcript — cannot generate brief. Skipping.")
            brief = None
        else:
            brief = run_script("generate_content.py", "brief", "--transcript", transcript)
            artifacts["content_brief"] = brief

    # 5. Cover image
    if "image" in skip:
        log.info("Skipping image.")
        cover = None
    else:
        cover = run_script("generate_image.py", "--type", "cover", "--format", "square")
        artifacts["cover_image"] = cover

    # 6. Waveform video (uses mixed audio if available, otherwise raw voice)
    if "video" in skip:
        log.info("Skipping video.")
        video = None
    else:
        audio_for_video = mixed or str(args.voice)
        video_args = ["waveform", "--audio", audio_for_video, "--formats", "portrait", "square"]
        if cover:
            video_args += ["--cover", cover]
        video = run_script("generate_video.py", *video_args)
        artifacts["video"] = video

    log.info("Pipeline complete.")
    print(json.dumps(artifacts, indent=2))


if __name__ == "__main__":
    main()
