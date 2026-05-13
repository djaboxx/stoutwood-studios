#!/usr/bin/env python3
"""
transcribe_audio.py — Gemini speech-to-text for brand voice recordings.

Sends an audio file to the Gemini API and returns a clean transcript.
Saves transcript to audio/transcripts/<recording-name>.txt by default.

Usage:
    python scripts/transcribe_audio.py audio/recordings/raw/my-recording.wav
    python scripts/transcribe_audio.py my-recording.wav --output -      # stdout
    python scripts/transcribe_audio.py my-recording.wav --json          # JSON envelope
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from _brand import REPO_ROOT, gemini_api_key, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

TRANSCRIPT_DIR = REPO_ROOT / "audio" / "transcripts"

PROMPT = """\
Transcribe the following audio recording verbatim. The speaker is a brand owner
recording a voice memo for content creation.

Rules:
- Output ONLY the transcript. No preamble, no commentary, no formatting marks.
- Preserve natural sentence breaks with newlines.
- Remove obvious filler words (um, uh) but keep meaningful pauses as commas.
- Do not paraphrase. Do not summarize. Do not add headings.
- If the audio is unintelligible, output: [UNINTELLIGIBLE]
"""


def transcribe(audio_path: Path, model: str = "gemini-2.0-flash") -> str:
    try:
        import google.genai as genai
    except ImportError:
        log.error("google-genai not installed. Run: pip install google-genai>=1.0.0")
        sys.exit(1)

    client = genai.Client(api_key=gemini_api_key())

    log.info("Uploading %s to Gemini Files API…", audio_path.name)
    audio_file = client.files.upload(file=str(audio_path))

    log.info("Requesting transcription from %s…", model)
    response = client.models.generate_content(
        model=model,
        contents=[audio_file, PROMPT],
    )

    try:
        client.files.delete(name=audio_file.name)
    except Exception as exc:
        log.warning("Could not delete uploaded file: %s", exc)

    return (response.text or "").strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe a voice recording via Gemini.")
    parser.add_argument("audio", type=Path, help="Path to audio file (wav/mp3/m4a/flac).")
    parser.add_argument(
        "--output",
        default=None,
        help="Output path. Default: audio/transcripts/<name>.txt. Use '-' for stdout.",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON envelope on stdout.")
    parser.add_argument("--model", default="gemini-2.0-flash", help="Gemini model.")
    args = parser.parse_args()

    if not args.audio.exists():
        log.error("File not found: %s", args.audio)
        sys.exit(2)

    # Touch brand to confirm config is valid before spending API call
    load_brand()

    transcript = transcribe(args.audio, model=args.model)

    if args.output == "-":
        print(transcript)
    else:
        out_path = (
            Path(args.output)
            if args.output
            else TRANSCRIPT_DIR / f"{args.audio.stem}.txt"
        )
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(transcript + "\n", encoding="utf-8")
        log.info("Saved transcript: %s", out_path)
        if args.json:
            print(json.dumps({"audio": str(args.audio), "transcript_path": str(out_path), "transcript": transcript}, indent=2))
        else:
            print(str(out_path))


if __name__ == "__main__":
    main()
