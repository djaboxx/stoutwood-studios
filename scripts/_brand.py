#!/usr/bin/env python3
"""
_brand.py — Shared brand context loader for brand-manager scripts.

All scripts read from database/brand.json. This module centralizes that load
so every script gets the same view of brand DNA, voice, audio config, and
visual style.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
BRAND_DB = REPO_ROOT / "database" / "brand.json"
VISUAL_STYLE_DB = REPO_ROOT / "database" / "visual-style.json"


def load_brand() -> dict[str, Any]:
    """Load and return the brand DNA. Exits with error if missing."""
    if not BRAND_DB.exists():
        log.error(
            "database/brand.json not found. Copy database/brand.example.json "
            "and fill in your brand details."
        )
        sys.exit(1)
    with BRAND_DB.open() as f:
        return json.load(f)


def load_visual_style() -> dict[str, Any]:
    """Load and return the visual style spec. Returns {} if missing."""
    if not VISUAL_STYLE_DB.exists():
        log.warning("database/visual-style.json not found — using defaults.")
        return {}
    with VISUAL_STYLE_DB.open() as f:
        return json.load(f)


def brand_slug() -> str:
    """Return the brand slug (used for file naming)."""
    return load_brand().get("brand", {}).get("slug", "brand")


def require_env(name: str) -> str:
    """Return env var or exit with a helpful error."""
    value = os.environ.get(name)
    if not value:
        log.error(
            "%s is not set. Add it to .env (see .env.example) or export it.",
            name,
        )
        sys.exit(1)
    return value


def gemini_api_key() -> str:
    """Return GEMINI_API_KEY or GOOGLE_API_KEY."""
    return os.environ.get("GEMINI_API_KEY") or require_env("GOOGLE_API_KEY")
