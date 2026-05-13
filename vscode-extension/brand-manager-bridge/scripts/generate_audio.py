#!/usr/bin/env python3
"""
generate_audio.py — AI music bed generation for brand-manager.

Generates a music bed (instrumental background audio) using Vertex AI Lyria 2.
The mood is derived from database/brand.json -> audio.bed_mood unless overridden.

This is voice-first: the bed is meant to support a spoken voice recording,
NOT to be the main audio. Output is mono-friendly, low-energy by default.

Usage:
    python scripts/generate_audio.py --duration 90
    python scripts/generate_audio.py --duration 60 --mood "calm, sparse, breath-like"
    python scripts/generate_audio.py --duration 90 --output audio/generated/my_bed.wav
    python scripts/generate_audio.py --duration 30 --dry-run    # print prompt only

Requires:
    - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account with Vertex AI access
    - GOOGLE_CLOUD_PROJECT set
    - Lyria 2 API enabled on the project
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

from _brand import REPO_ROOT, brand_slug, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

GENERATED_DIR = REPO_ROOT / "audio" / "generated"


def build_prompt(brand: dict, mood_override: str | None) -> str:
    """Compose a Lyria prompt from brand audio config + voice context."""
    audio_cfg = brand.get("audio", {})
    mood = mood_override or audio_cfg.get("bed_mood") or "calm, ambient, supportive"
    voice = brand.get("voice", {})
    tone = voice.get("tone", "calm, grounded")

    return (
        f"Instrumental ambient music bed designed to sit underneath spoken voice. "
        f"Mood: {mood}. Voice tone it must support: {tone}. "
        f"NO drums. NO percussion. NO vocals. NO sudden dynamic changes. "
        f"NO melodic hooks that would compete with a speaker. "
        f"Long sustained tones, gentle harmonic movement, soft dynamics. "
        f"This is texture, not a song."
    )


def call_lyria(prompt: str, duration_seconds: int, output_path: Path) -> None:
    """Call Vertex AI Lyria 2 and save the result to output_path."""
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project:
        log.error("GOOGLE_CLOUD_PROJECT not set. Cannot call Vertex AI Lyria.")
        sys.exit(1)
    region = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")

    try:
        from google import genai
        from google.genai import types as gentypes
    except ImportError:
        log.error("google-genai not installed. Run: pip install google-genai>=1.0.0")
        sys.exit(1)

    client = genai.Client(vertexai=True, project=project, location=region)

    log.info("Calling Lyria 2 (project=%s, region=%s, duration=%ds)…", project, region, duration_seconds)
    log.info("Prompt: %s", prompt)

    # Lyria 2 API call. The exact API surface evolves — wrap in try/except
    # so users get a clear error if the SDK signature has shifted.
    try:
        response = client.models.generate_music(  # type: ignore[attr-defined]
            model="lyria-002",
            prompt=prompt,
            config=gentypes.GenerateMusicConfig(  # type: ignore[attr-defined]
                duration_seconds=duration_seconds,
                sample_rate=48000,
            ),
        )
        audio_bytes = response.audio[0].data  # type: ignore[attr-defined]
    except AttributeError as exc:
        log.error(
            "Lyria SDK surface mismatch: %s. The google-genai SDK may have moved "
            "Lyria support. Check Google Cloud docs for the current pattern.",
            exc,
        )
        sys.exit(1)
    except Exception as exc:
        log.error("Lyria generation failed: %s", exc)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(audio_bytes)
    log.info("Saved music bed: %s (%d bytes)", output_path, len(audio_bytes))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate an AI music bed for a brand voice recording.")
    parser.add_argument("--duration", type=int, default=60, help="Bed duration in seconds (default: 60).")
    parser.add_argument("--mood", default=None, help="Override mood from brand.json.")
    parser.add_argument("--output", type=Path, default=None, help="Output WAV path.")
    parser.add_argument("--dry-run", action="store_true", help="Print prompt only, do not call API.")
    args = parser.parse_args()

    brand = load_brand()
    prompt = build_prompt(brand, args.mood)

    if args.dry_run:
        print(f"PROMPT: {prompt}")
        print(f"DURATION: {args.duration}s")
        return

    if args.output:
        output = args.output
    else:
        ts = int(time.time())
        output = GENERATED_DIR / f"{brand_slug()}_bed_{args.duration}s_{ts}.wav"

    call_lyria(prompt, args.duration, output)
    print(str(output))


if __name__ == "__main__":
    main()
