#!/usr/bin/env python3
"""
generate_content.py — Gemini-powered content generation calibrated to brand voice.

Reads database/brand.json for voice, audience, content pillars, and platforms,
then drafts platform-specific posts, captions, or content briefs.

Usage:
    # Generate one content brief from a transcript
    python scripts/generate_content.py brief --transcript audio/transcripts/my-recording.txt

    # Generate a week of Instagram posts on a specific pillar
    python scripts/generate_content.py weekly --platform instagram --pillar breath-and-regulation --days 7

    # Generate a single post for a specific platform
    python scripts/generate_content.py post --platform linkedin --topic "decision fatigue"

Output: writes to content/<type>/<slug>.md and prints the path.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

from _brand import REPO_ROOT, brand_slug, gemini_api_key, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

CONTENT_DIR = REPO_ROOT / "content"


def voice_block(brand: dict) -> str:
    """Compose the brand voice constraint block used in every prompt."""
    voice = brand.get("voice", {})
    positioning = brand.get("positioning", {})
    audience = positioning.get("target_audience", {})
    return (
        f"BRAND VOICE\n"
        f"  Owner: {brand.get('brand', {}).get('owner', 'unknown')}\n"
        f"  Niche: {brand.get('brand', {}).get('niche', 'unknown')}\n"
        f"  Tone: {voice.get('tone', 'unspecified')}\n"
        f"  Persona: {voice.get('persona', 'unspecified')}\n"
        f"  Vocabulary to use: {', '.join(voice.get('vocabulary', []))}\n"
        f"  Vocabulary to avoid: {', '.join(voice.get('avoid', []))}\n"
        f"\n"
        f"AUDIENCE\n"
        f"  Who: {audience.get('who', 'unspecified')}\n"
        f"  Pain: {audience.get('pain', 'unspecified')}\n"
        f"  Desire: {audience.get('desire', 'unspecified')}\n"
        f"\n"
        f"UVP\n"
        f"  {positioning.get('uvp', 'unspecified')}\n"
    )


def call_gemini(prompt: str, model: str = "gemini-2.0-flash") -> str:
    try:
        import google.genai as genai
    except ImportError:
        log.error("google-genai not installed.")
        sys.exit(1)
    client = genai.Client(api_key=gemini_api_key())
    response = client.models.generate_content(model=model, contents=prompt)
    return (response.text or "").strip()


def cmd_brief(args: argparse.Namespace) -> Path:
    """Generate a content brief from a transcript."""
    brand = load_brand()
    transcript_text = args.transcript.read_text(encoding="utf-8").strip()

    prompt = (
        voice_block(brand) + "\n"
        "TASK: Read the following voice memo transcript. Produce a content brief "
        "with these sections:\n"
        "1. CORE INSIGHT — one sentence capturing what the speaker is actually saying\n"
        "2. AUDIENCE HOOK — a one-line opener calibrated to the audience above\n"
        "3. PLATFORM DRAFTS — separate ready-to-post drafts for each platform listed below, "
        "each fitting that platform's conventions and length\n"
        "4. SUGGESTED VISUAL — one sentence describing an image that would support this content "
        "(in the brand visual style)\n\n"
        f"PLATFORMS: {', '.join(brand.get('platforms', {}).get('primary', ['instagram', 'linkedin']))}\n\n"
        f"TRANSCRIPT:\n{transcript_text}\n"
    )

    output_text = call_gemini(prompt, model=args.model)

    out_dir = CONTENT_DIR / "briefs"
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = args.transcript.stem
    out_path = out_dir / f"{stem}_brief.md"
    out_path.write_text(output_text + "\n", encoding="utf-8")
    log.info("Saved content brief: %s", out_path)
    return out_path


def cmd_post(args: argparse.Namespace) -> Path:
    """Generate a single post for one platform."""
    brand = load_brand()
    prompt = (
        voice_block(brand) + "\n"
        f"TASK: Write a single {args.platform} post about: {args.topic}\n"
        f"Follow {args.platform}'s conventions for length, hashtags, and tone.\n"
        f"Output ONLY the post text. No commentary."
    )
    text = call_gemini(prompt, model=args.model)
    out_dir = CONTENT_DIR / "posts" / args.platform
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())
    out_path = out_dir / f"{brand_slug()}_{ts}.md"
    out_path.write_text(text + "\n", encoding="utf-8")
    log.info("Saved post: %s", out_path)
    return out_path


def cmd_weekly(args: argparse.Namespace) -> Path:
    """Generate N days of posts for a single platform on a single pillar."""
    brand = load_brand()
    pillars = {p["name"]: p for p in brand.get("content_pillars", [])}
    if args.pillar not in pillars:
        log.error("Pillar '%s' not in brand.json. Available: %s", args.pillar, list(pillars))
        sys.exit(2)
    pillar = pillars[args.pillar]

    prompt = (
        voice_block(brand) + "\n"
        f"TASK: Draft {args.days} {args.platform} posts on the content pillar:\n"
        f"  Pillar: {pillar['name']}\n"
        f"  Description: {pillar['description']}\n\n"
        f"Each post must:\n"
        f"  - Stand alone (no 'in our last post' references)\n"
        f"  - Open with a specific hook (no generic greetings)\n"
        f"  - End with a single clear call-to-action or open question\n"
        f"  - Fit {args.platform}'s conventions for length\n\n"
        f"Format the output as a numbered list (1. through {args.days}.) with one post per number. "
        f"No commentary between posts."
    )
    text = call_gemini(prompt, model=args.model)
    out_dir = CONTENT_DIR / "posts" / args.platform
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())
    out_path = out_dir / f"{brand_slug()}_{args.pillar}_week_{ts}.md"
    out_path.write_text(text + "\n", encoding="utf-8")
    log.info("Saved weekly drafts: %s", out_path)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Brand-voice content generation via Gemini.")
    parser.add_argument("--model", default="gemini-2.0-flash")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_brief = sub.add_parser("brief", help="Content brief from a transcript.")
    p_brief.add_argument("--transcript", type=Path, required=True)

    p_post = sub.add_parser("post", help="Single post for one platform.")
    p_post.add_argument("--platform", required=True, help="instagram, linkedin, etc.")
    p_post.add_argument("--topic", required=True)

    p_weekly = sub.add_parser("weekly", help="Multi-day post batch.")
    p_weekly.add_argument("--platform", required=True)
    p_weekly.add_argument("--pillar", required=True, help="Pillar name from brand.json.")
    p_weekly.add_argument("--days", type=int, default=7)

    args = parser.parse_args()

    if args.cmd == "brief":
        out = cmd_brief(args)
    elif args.cmd == "post":
        out = cmd_post(args)
    elif args.cmd == "weekly":
        out = cmd_weekly(args)
    else:
        parser.print_help()
        sys.exit(2)

    print(str(out))


if __name__ == "__main__":
    main()
