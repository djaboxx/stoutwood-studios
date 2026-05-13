#!/usr/bin/env python3
"""
mix_voice.py — ffmpeg amix wrapper that mixes a voice recording with a music bed.

Voice-first: voice volume defaults to 1.0, bed volume defaults to 0.35
(read from database/brand.json -> audio.{voice_volume, bed_volume}).

The bed is looped or trimmed to match the voice duration so the speaker is
never cut off mid-sentence by silence.

Usage:
    python scripts/mix_voice.py \\
        --voice audio/recordings/raw/my-recording.wav \\
        --bed audio/generated/my_bed.wav \\
        --output audio/recordings/my-recording_final.wav

    python scripts/mix_voice.py --voice voice.wav --bed bed.wav  # auto-name output
"""

from __future__ import annotations

import argparse
import logging
import shutil
import subprocess
import sys
from pathlib import Path

from _brand import REPO_ROOT, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

OUTPUT_DIR = REPO_ROOT / "audio" / "recordings"


def check_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        log.error("ffmpeg not found. Install with: brew install ffmpeg")
        sys.exit(1)
    return ffmpeg


def get_duration_seconds(audio_path: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        log.error("ffprobe not found (install via ffmpeg).")
        sys.exit(1)
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def mix(
    voice: Path,
    bed: Path,
    output: Path,
    voice_vol: float,
    bed_vol: float,
    sample_rate: int,
) -> None:
    """ffmpeg amix: voice (loud, intelligible) + bed (quiet, supportive)."""
    ffmpeg = check_ffmpeg()
    voice_dur = get_duration_seconds(voice)

    # Loop the bed to match voice duration, then trim to exact length.
    # Apply per-input volume, then amix with shortest=longest of voice (after loop).
    filtergraph = (
        f"[0:a]volume={voice_vol}[v];"
        f"[1:a]aloop=loop=-1:size=2e+9,atrim=duration={voice_dur:.3f},"
        f"volume={bed_vol},afade=t=in:st=0:d=1.5,"
        f"afade=t=out:st={max(voice_dur - 1.5, 0):.3f}:d=1.5[b];"
        f"[v][b]amix=inputs=2:duration=first:dropout_transition=0,"
        f"aresample={sample_rate}[out]"
    )

    cmd = [
        ffmpeg, "-y",
        "-i", str(voice),
        "-i", str(bed),
        "-filter_complex", filtergraph,
        "-map", "[out]",
        "-ac", "2",
        "-ar", str(sample_rate),
        "-c:a", "pcm_s16le",
        str(output),
    ]

    log.info("Mixing voice + bed (voice=%.2f, bed=%.2f, duration=%.2fs)", voice_vol, bed_vol, voice_dur)
    log.debug("ffmpeg command: %s", " ".join(cmd))

    output.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log.error("ffmpeg failed:\n%s", result.stderr)
        sys.exit(result.returncode)

    log.info("Saved mixed audio: %s", output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mix a voice recording with a music bed (voice-first).")
    parser.add_argument("--voice", type=Path, required=True, help="Voice recording WAV.")
    parser.add_argument("--bed", type=Path, required=True, help="Music bed WAV.")
    parser.add_argument("--output", type=Path, default=None, help="Output WAV path.")
    parser.add_argument("--voice-volume", type=float, default=None, help="Override voice volume (0.0–1.5).")
    parser.add_argument("--bed-volume", type=float, default=None, help="Override bed volume (0.0–1.0).")
    args = parser.parse_args()

    if not args.voice.exists():
        log.error("Voice file not found: %s", args.voice)
        sys.exit(2)
    if not args.bed.exists():
        log.error("Bed file not found: %s", args.bed)
        sys.exit(2)

    brand = load_brand()
    audio_cfg = brand.get("audio", {})
    voice_vol = args.voice_volume if args.voice_volume is not None else audio_cfg.get("voice_volume", 1.0)
    bed_vol = args.bed_volume if args.bed_volume is not None else audio_cfg.get("bed_volume", 0.35)
    sample_rate = audio_cfg.get("sample_rate", 48000)

    output = args.output or OUTPUT_DIR / f"{args.voice.stem}_final.wav"
    mix(args.voice, args.bed, output, voice_vol, bed_vol, sample_rate)
    print(str(output))


if __name__ == "__main__":
    main()
