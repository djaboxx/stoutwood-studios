#!/usr/bin/env python3
"""
build_pitch.py — Generate pitch assets (one-pager, deck outline, proposal) from brand DNA.

Reads database/brand.json. Optionally reads pitch/uvp.md and pitch/case-studies.md
if they exist (for richer context). Uses Gemini to compose pitch copy in the brand voice.

Usage:
    python scripts/build_pitch.py one-pager
    python scripts/build_pitch.py deck --audience "VP HR"
    python scripts/build_pitch.py proposal --org "Acme Corp" --offer "Corporate Wellness Q1"
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

from _brand import REPO_ROOT, brand_slug, gemini_api_key, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

PITCH_DIR = REPO_ROOT / "pitch"


def call_gemini(prompt: str) -> str:
    try:
        import google.genai as genai
    except ImportError:
        log.error("google-genai not installed.")
        sys.exit(1)
    client = genai.Client(api_key=gemini_api_key())
    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
    return (response.text or "").strip()


def context_block(brand: dict) -> str:
    voice = brand.get("voice", {})
    pos = brand.get("positioning", {})
    aud = pos.get("target_audience", {})
    offers = brand.get("offers", [])
    offer_lines = "\n".join(
        f"  - {o.get('name', '')}: {o.get('format', '')} — {o.get('price', '')} — {o.get('outcome', '')}"
        for o in offers
    )

    extras = []
    for fname in ("uvp.md", "case-studies.md", "objection-handling.md"):
        path = PITCH_DIR / fname
        if path.exists():
            extras.append(f"## {fname}\n{path.read_text(encoding='utf-8')}")

    block = (
        f"BRAND\n"
        f"  Name: {brand.get('brand', {}).get('name', '')}\n"
        f"  Owner: {brand.get('brand', {}).get('owner', '')}\n"
        f"  Niche: {brand.get('brand', {}).get('niche', '')}\n"
        f"\n"
        f"POSITIONING\n"
        f"  UVP: {pos.get('uvp', '')}\n"
        f"  Audience: {aud.get('who', '')}\n"
        f"  Pain: {aud.get('pain', '')}\n"
        f"  Desire: {aud.get('desire', '')}\n"
        f"\n"
        f"VOICE\n"
        f"  Tone: {voice.get('tone', '')}\n"
        f"  Persona: {voice.get('persona', '')}\n"
        f"  Avoid: {', '.join(voice.get('avoid', []))}\n"
        f"\n"
        f"OFFERS\n{offer_lines}\n"
    )
    if extras:
        block += "\n" + "\n\n".join(extras)
    return block


def cmd_one_pager(args: argparse.Namespace, brand: dict) -> Path:
    prompt = (
        context_block(brand) + "\n"
        "TASK: Write a one-page pitch document in markdown. Sections:\n"
        "  # [Brand Name]\n"
        "  ## What this is\n"
        "  ## Who it's for\n"
        "  ## What changes\n"
        "  ## How it works\n"
        "  ## Offers\n"
        "  ## Next step\n\n"
        "Voice must match the brand voice exactly. No buzzwords from the AVOID list. "
        "No generic consulting-speak. Specific, grounded, in the voice of the owner."
    )
    text = call_gemini(prompt)
    out = PITCH_DIR / f"{brand_slug()}_one-pager.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text + "\n", encoding="utf-8")
    return out


def cmd_deck(args: argparse.Namespace, brand: dict) -> Path:
    prompt = (
        context_block(brand) + "\n"
        f"TASK: Outline a {args.slides}-slide pitch deck for the audience: {args.audience}.\n"
        "Format as markdown with one section per slide:\n"
        "  ## Slide N — [Title]\n"
        "  Speaker note (1-3 sentences in brand voice)\n"
        "  Visual concept (1 sentence describing image, in the brand visual style)\n\n"
        "First slide opens with a specific moment, not a generic title. "
        "Last slide is a clear next step, not 'thank you'."
    )
    text = call_gemini(prompt)
    ts = int(time.time())
    out = PITCH_DIR / f"{brand_slug()}_deck_{ts}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text + "\n", encoding="utf-8")
    return out


def cmd_proposal(args: argparse.Namespace, brand: dict) -> Path:
    prompt = (
        context_block(brand) + "\n"
        f"TASK: Draft a proposal for the organization \"{args.org}\" for the offer: {args.offer}.\n"
        "Sections:\n"
        "  # Proposal — [Org Name]\n"
        "  ## Context (what we discussed)\n"
        "  ## What we'll do\n"
        "  ## How it works (cadence, format, deliverables)\n"
        "  ## Investment\n"
        "  ## Timeline\n"
        "  ## Next step\n\n"
        "Specific, grounded, in the brand voice. No corporate-speak. "
        "If price details aren't in the offer config, write [PRICE] as a placeholder."
    )
    text = call_gemini(prompt)
    org_slug = args.org.lower().replace(" ", "-")
    out = PITCH_DIR / f"{brand_slug()}_proposal_{org_slug}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text + "\n", encoding="utf-8")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Pitch asset generator.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("one-pager")

    p_deck = sub.add_parser("deck")
    p_deck.add_argument("--audience", required=True)
    p_deck.add_argument("--slides", type=int, default=8)

    p_prop = sub.add_parser("proposal")
    p_prop.add_argument("--org", required=True)
    p_prop.add_argument("--offer", required=True)

    args = parser.parse_args()
    brand = load_brand()
    handlers = {"one-pager": cmd_one_pager, "deck": cmd_deck, "proposal": cmd_proposal}
    out = handlers[args.cmd](args, brand)
    log.info("Saved: %s", out)
    print(str(out))


if __name__ == "__main__":
    main()
