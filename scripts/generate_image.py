#!/usr/bin/env python3
"""
generate_image.py — Brand visual generation via Imagen 4.

Reads database/brand.json + database/visual-style.json. Composes prompts that
enforce the brand aesthetic, palette, and prohibitions. No generic stock art.

Usage:
    python scripts/generate_image.py --type cover --format square
    python scripts/generate_image.py --type promo --caption "Morning breathwork" --formats square landscape portrait
    python scripts/generate_image.py --type profile --format square
    python scripts/generate_image.py --type promo --caption "..." --dry-run
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

from _brand import REPO_ROOT, brand_slug, gemini_api_key, load_brand, load_visual_style

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

OUT_DIR = REPO_ROOT / "outputs" / "social"

FORMAT_RATIOS = {
    "square": "1:1",
    "landscape": "16:9",
    "portrait": "9:16",
}


def build_prompt(image_type: str, caption: str | None, brand: dict, vstyle: dict) -> str:
    palette = vstyle.get("palette", {})
    palette_desc = (
        f"background {palette.get('background', '#f5f0eb')}, "
        f"primary {palette.get('primary', '#3d5a47')}, "
        f"accent {palette.get('accent', '#c9a96e')}"
    )
    aesthetic = vstyle.get("aesthetic", "minimal, warm, natural light")
    vocab = ", ".join(vstyle.get("imagery_vocabulary", []))
    rules = " ".join(vstyle.get("composition_rules", []))
    people = vstyle.get("people_policy", "Faces are rare and partial.")

    base = (
        f"{aesthetic}. Color palette: {palette_desc}. "
        f"Visual vocabulary: {vocab}. {rules} {people}"
    )

    if image_type == "cover":
        focus = (
            f"Brand cover image for {brand.get('brand', {}).get('name', '')}. "
            f"Single iconic composition. No text. Suitable as a profile or hero image."
        )
    elif image_type == "promo":
        focus = (
            f"Promo image supporting this caption: \"{caption or 'brand moment'}\". "
            f"Image should evoke the feeling of the caption without being literal. No text overlay."
        )
    elif image_type == "profile":
        focus = (
            f"Personal brand profile image. Tightly cropped composition. No face shown — "
            f"abstract object, hand, or texture that represents the brand."
        )
    else:
        focus = f"Brand image for {brand.get('brand', {}).get('name', '')}."

    return f"{focus} {base}"


NEGATIVE_PROMPT_DEFAULT = "stock photo aesthetic, polished commercial gloss, text overlay, watermark, logo, busy composition"


def negative_prompt(vstyle: dict) -> str:
    prohibition = vstyle.get("prohibition", "")
    return f"{NEGATIVE_PROMPT_DEFAULT}. {prohibition}".strip()


def generate(prompt: str, neg: str, fmt: str, output: Path, dry_run: bool) -> None:
    if dry_run:
        log.info("DRY RUN — would generate:")
        log.info("  Format: %s (%s)", fmt, FORMAT_RATIOS[fmt])
        log.info("  Output: %s", output)
        log.info("  Prompt: %s", prompt)
        log.info("  Negative: %s", neg)
        return

    try:
        from google import genai
        from google.genai import types as gentypes
    except ImportError:
        log.error("google-genai not installed.")
        sys.exit(1)

    # Imagen 4 is currently exposed via Vertex AI. Fall back to Gemini API key
    # if Vertex isn't configured.
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if project:
        client = genai.Client(vertexai=True, project=project, location=os.environ.get("GOOGLE_CLOUD_REGION", "us-central1"))
    else:
        log.warning("GOOGLE_CLOUD_PROJECT not set — using Gemini API key (Imagen via API).")
        client = genai.Client(api_key=gemini_api_key())

    log.info("Calling Imagen 4 (format=%s)…", fmt)
    response = client.models.generate_images(
        model="imagen-4.0-generate-001",
        prompt=prompt,
        config=gentypes.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio=FORMAT_RATIOS[fmt],
            negative_prompt=neg,
            safety_filter_level="block_low_and_above",
        ),
    )
    if not response.generated_images:
        log.error("No image returned by Imagen.")
        sys.exit(1)

    image_bytes = response.generated_images[0].image.image_bytes
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(image_bytes)
    log.info("Saved: %s (%d bytes)", output, len(image_bytes))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate brand visuals via Imagen 4.")
    parser.add_argument("--type", choices=["cover", "promo", "profile"], required=True)
    parser.add_argument("--caption", default=None, help="For type=promo: the caption to support.")
    parser.add_argument(
        "--format",
        action="append",
        choices=list(FORMAT_RATIOS.keys()),
        help="Format(s) to generate. Repeat to generate multiple. Default: square.",
    )
    parser.add_argument(
        "--formats",
        nargs="+",
        choices=list(FORMAT_RATIOS.keys()),
        help="Alias for repeated --format.",
    )
    parser.add_argument("--output-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    formats = args.formats or args.format or ["square"]

    brand = load_brand()
    vstyle = load_visual_style()
    prompt = build_prompt(args.type, args.caption, brand, vstyle)
    neg = negative_prompt(vstyle)

    ts = int(time.time())
    slug = brand_slug()
    saved = []
    for fmt in formats:
        out_path = args.output_dir / f"{slug}_{args.type}_{fmt}_{ts}.png"
        generate(prompt, neg, fmt, out_path, args.dry_run)
        saved.append(out_path)

    for p in saved:
        print(str(p))


if __name__ == "__main__":
    main()
