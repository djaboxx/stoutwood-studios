#!/usr/bin/env python3
"""
grade_image_quality.py — Grade product photos and give capture guidance.

Reads brand + visual style context, sends image(s) to Gemini vision, and returns
structured JSON scoring plus actionable recommendations.
"""

from __future__ import annotations

import argparse
import json
import logging
import mimetypes
import re
import sys
from pathlib import Path
from typing import Any

from _brand import REPO_ROOT, gemini_api_key, load_brand, load_visual_style

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"}


def resolve_image(path_arg: str) -> Path:
    p = Path(path_arg)
    if not p.is_absolute():
        p = REPO_ROOT / p
    return p.resolve()


def mime_for(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if mime and mime.startswith("image/"):
        return mime
    return "image/jpeg"


def parse_json_response(text: str) -> dict[str, Any]:
    clean = (text or "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError as first_error:
        m = re.search(r"\{.*\}", clean, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError as fallback_error:
                raise ValueError(
                    "Model response did not contain valid JSON, including regex-extracted block."
                ) from fallback_error
        raise ValueError("Model response did not contain valid JSON.") from first_error


def evaluate(images: list[Path], focus: str | None, model: str) -> dict[str, Any]:
    try:
        import google.genai as genai
        from google.genai import types as gentypes
    except ImportError:
        log.error("google-genai not installed.")
        sys.exit(1)

    brand = load_brand()
    vstyle = load_visual_style()

    client = genai.Client(api_key=gemini_api_key())

    photo_notes = "\n".join(f"- {p.name}" for p in images)
    focus_text = focus or "overall product photo quality and conversion-readiness"
    prompt = f"""You are a product photography quality reviewer.
Score each image and provide practical reshoot guidance.

BRAND CONTEXT:
{json.dumps(brand, indent=2)}

VISUAL STYLE CONTEXT:
{json.dumps(vstyle, indent=2)}

FOCUS:
{focus_text}

IMAGES:
{photo_notes}

Return strict JSON only with this schema:
{{
  "overall_score": <integer 0-100>,
  "summary": "<2-4 sentence summary>",
  "engagement_outlook": "<how likely this set is to drive engagement and why>",
  "images": [
    {{
      "file": "<file name>",
      "score": <integer 0-100>,
      "engagement_score": <integer 0-100>,
      "style_alignment_score": <integer 0-100>,
      "composition_score": <integer 0-100>,
      "strengths": ["..."],
      "issues": ["..."],
      "style_and_composition_guidance": [
        {{
          "adjustment": "<style/composition improvement>",
          "how_to_capture_it": "<specific camera/framing/distance/angle/lighting action>",
          "engagement_impact": "<how this should improve click/save/comment intent>"
        }}
      ],
      "capture_guidance": [
        {{
          "issue": "<what to fix>",
          "do_this": "<specific step while shooting>",
          "why_it_helps": "<short reason>"
        }}
      ]
    }}
  ],
  "engagement_playbook": [
    "specific style/composition tactics for product images that improve engagement"
  ],
  "next_shoot_checklist": ["5-10 concrete capture checklist bullets for this product"]
}}
"""

    contents: list[Any] = [prompt]
    for img in images:
        contents.append(
            gentypes.Part.from_bytes(
                data=img.read_bytes(),
                mime_type=mime_for(img),
            )
        )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config={"response_mime_type": "application/json"},
    )
    return parse_json_response(response.text or "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Grade product image quality and provide capture guidance.")
    parser.add_argument("images", nargs="+", help="Absolute or workspace-relative paths to image files.")
    parser.add_argument("--focus", default=None, help="Optional review focus (e.g. lighting, composition, conversion).")
    parser.add_argument("--model", default="gemini-2.0-flash", help="Gemini model.")
    args = parser.parse_args()

    resolved = [resolve_image(p) for p in args.images]
    for p in resolved:
        if not p.exists() or not p.is_file():
            log.error("Image not found: %s", p)
            sys.exit(2)
        if p.suffix.lower() not in SUPPORTED_EXTENSIONS:
            log.error("Unsupported image extension for %s. Supported: %s", p.name, ", ".join(sorted(SUPPORTED_EXTENSIONS)))
            sys.exit(2)

    result = evaluate(resolved, args.focus, args.model)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
