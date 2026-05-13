#!/usr/bin/env python3
"""
do_homework.py — AI-execute homework items that are marked ai_doable.

Each subcommand corresponds to an item id in database/homework.json.
Output is saved under content/homework/<id>.md and the item status is
auto-advanced to 'in-progress' (the owner marks 'done' after review).

Usage:
    python scripts/do_homework.py niche-clarity
    python scripts/do_homework.py uvp
    python scripts/do_homework.py audience-matrix
    python scripts/do_homework.py message-angles
    python scripts/do_homework.py outreach-drafts --count 20 --contacts contacts.csv
    python scripts/do_homework.py offer-doc
    python scripts/do_homework.py proprietary-method
    python scripts/do_homework.py linkedin-profile
    python scripts/do_homework.py lead-magnet
    python scripts/do_homework.py dream-100
    python scripts/do_homework.py weekly-system
    python scripts/do_homework.py validate-niche

Some items just delegate to existing scripts (e.g. one-pager → build_pitch.py).
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import subprocess
import sys
from pathlib import Path

from _brand import REPO_ROOT, gemini_api_key, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

OUT_DIR = REPO_ROOT / "content" / "homework"
HOMEWORK_DB = REPO_ROOT / "database" / "homework.json"


def call_gemini(prompt: str, model: str = "gemini-2.0-flash") -> str:
    try:
        import google.genai as genai
    except ImportError:
        log.error("google-genai not installed.")
        sys.exit(1)
    client = genai.Client(api_key=gemini_api_key())
    response = client.models.generate_content(model=model, contents=prompt)
    return (response.text or "").strip()


def voice_block(brand: dict) -> str:
    voice = brand.get("voice", {})
    pos = brand.get("positioning", {})
    aud = pos.get("target_audience", {})
    return (
        f"BRAND: {brand.get('brand', {}).get('name', '')} — "
        f"{brand.get('brand', {}).get('niche', '')}\n"
        f"OWNER: {brand.get('brand', {}).get('owner', '')}\n"
        f"UVP: {pos.get('uvp', '')}\n"
        f"AUDIENCE: {aud.get('who', '')} | pain: {aud.get('pain', '')} | "
        f"desire: {aud.get('desire', '')}\n"
        f"VOICE TONE: {voice.get('tone', '')}\n"
        f"VOICE PERSONA: {voice.get('persona', '')}\n"
        f"AVOID: {', '.join(voice.get('avoid', []))}\n"
    )


def write_output(item_id: str, text: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{item_id}.md"
    out.write_text(text + "\n", encoding="utf-8")
    log.info("Saved: %s", out)
    return out


def advance_status(item_id: str) -> None:
    """Auto-mark item as in-progress so the owner sees AI did its part."""
    if not HOMEWORK_DB.exists():
        return
    data = json.loads(HOMEWORK_DB.read_text(encoding="utf-8"))
    for i in data["items"]:
        if i["id"] == item_id and i["status"] == "not-started":
            i["status"] = "in-progress"
            HOMEWORK_DB.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
            log.info("Marked %s: not-started → in-progress (review and mark done when ready)", item_id)
            return


# ---------------------------------------------------------------------------
# Item handlers
# ---------------------------------------------------------------------------

def handle_niche_clarity(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Draft a Niche Clarity Workbook based on the brand info above.\n"
        "Sections:\n"
        "  ## Niche statement (one sentence: who you serve and what outcome)\n"
        "  ## Why this niche (3 bullets — why you, why now, why them)\n"
        "  ## Adjacent niches you are NOT serving (3 bullets — clarity by exclusion)\n"
        "  ## Three sentences this niche would say about their pain (in their words)\n"
        "  ## Three sentences this niche would say about the desired outcome (in their words)\n"
        "  ## Open questions for the owner (anything ambiguous in brand.json that needs a real answer)\n"
    )
    return write_output("niche-clarity", call_gemini(prompt))


def handle_validate_niche(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Produce a niche demand validation brief. Sections:\n"
        "  ## Demand signals (job titles hiring for adjacent skills, search trends I should check, communities)\n"
        "  ## Three competitor archetypes (not real names — patterns: who else serves this niche, how, at what price)\n"
        "  ## Three quick validation experiments the owner can run this week\n"
        "  ## Red flags that would mean re-scope the niche\n"
        "Be concrete. No 'do market research' — name the exact searches, communities, and conversations."
    )
    return write_output("validate-niche", call_gemini(prompt))


def handle_uvp(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Generate 5 candidate UVP one-liners + 3 proof bullets each.\n"
        "Each UVP must:\n"
        "  - Be one sentence under 20 words\n"
        "  - Name the audience and the outcome specifically\n"
        "  - Use the brand voice (no buzzwords from AVOID)\n"
        "  - Not be interchangeable with a competitor's UVP\n"
        "Format:\n"
        "  ## Option N\n"
        "  UVP: ...\n"
        "  Proof:\n"
        "  - ...\n"
        "  - ...\n"
        "  - ...\n"
    )
    return write_output("uvp-and-proof", call_gemini(prompt))


def handle_audience_matrix(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Build an Audience Insights Matrix for this brand.\n"
        "Output a markdown table with columns: Persona | Role/Title | Daily pain "
        "| Hidden desire | Top objection | Words they actually use | Where to reach them.\n"
        "Generate 3 distinct personas inside the audience definition above. "
        "Use real-world language, not consulting jargon. "
        "After the table, list 5 specific phrases each persona has likely said out loud — "
        "these become hooks for content."
    )
    return write_output("audience-matrix", call_gemini(prompt))


def handle_message_angles(args, brand) -> Path:
    pillars = brand.get("content_pillars", [])
    pillar_text = "\n".join(f"  - {p['name']}: {p['description']}" for p in pillars)
    prompt = (
        voice_block(brand) + "\n"
        f"EXISTING PILLARS:\n{pillar_text}\n\n"
        "TASK: Generate 8 distinct message angles for this brand. Each angle is a "
        "way of framing the work that could become a content pillar.\n"
        "For each angle:\n"
        "  ## Angle N — [short name]\n"
        "  Frame: one sentence describing the framing\n"
        "  Lead hook: a sample opening line a post in this angle would use\n"
        "  Why it works for this audience: one sentence\n"
        "  Risk: what makes this angle weak or generic if mishandled\n\n"
        "After the 8, recommend the 3-5 strongest as the working content pillars."
    )
    return write_output("message-angles", call_gemini(prompt))


def handle_outreach_drafts(args, brand) -> Path:
    """Draft personalized openers from a contacts CSV."""
    if not args.contacts:
        log.error("--contacts CSV required (columns: name, org, title, context)")
        sys.exit(2)
    contacts_path = Path(args.contacts)
    if not contacts_path.exists():
        log.error("Contacts file not found: %s", contacts_path)
        sys.exit(2)

    rows = list(csv.DictReader(contacts_path.open(encoding="utf-8")))
    rows = rows[: args.count]
    if not rows:
        log.error("No contacts in CSV.")
        sys.exit(2)

    contacts_block = "\n".join(
        f"  {i+1}. {r.get('name', '')} — {r.get('title', '')} at {r.get('org', '')}. "
        f"Context: {r.get('context', '(none)')}"
        for i, r in enumerate(rows)
    )
    prompt = (
        voice_block(brand) + "\n"
        f"CONTACTS:\n{contacts_block}\n\n"
        "TASK: Draft a warm outreach message for each contact. Each message:\n"
        "  - Opens with a specific reference to them (their context above), not a generic compliment\n"
        "  - States one observation or question relevant to their world\n"
        "  - Suggests one specific low-friction next step (15-min call, share a relevant case study, etc.)\n"
        "  - Under 90 words\n"
        "  - Does NOT pitch the offer in the first message\n"
        "Format each as:\n"
        "  ## To: [name] — [org]\n"
        "  [message body]\n"
    )
    return write_output("warm-outreach", call_gemini(prompt))


def handle_offer_doc(args, brand) -> Path:
    offers = brand.get("offers", [])
    offers_block = json.dumps(offers, indent=2)
    prompt = (
        voice_block(brand) + "\n"
        f"EXISTING OFFERS (from brand.json):\n{offers_block}\n\n"
        "TASK: Draft a complete Offer Document for each offer above. For each offer:\n"
        "  # [Offer name]\n"
        "  ## Who this is for (one paragraph)\n"
        "  ## What you get (concrete deliverables — bulleted)\n"
        "  ## How it works (cadence, format, milestones)\n"
        "  ## Investment ([USE PRICE FROM brand.json — if missing, write [PRICE: owner to confirm]])\n"
        "  ## Timeline & next step\n"
        "Use brand voice. Concrete over abstract. If a number is missing, write a placeholder — never invent prices."
    )
    return write_output("offer-doc", call_gemini(prompt))


def handle_proprietary_method(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Propose a 3-5 step Proprietary Method for this brand.\n"
        "It should be the framework the owner uses to take a client from pain → desired outcome.\n"
        "Output:\n"
        "  ## Method name (3 word maximum, memorable)\n"
        "  ## Why this method (one paragraph)\n"
        "  ## The Steps\n"
        "  For each step (3-5 total):\n"
        "    ### Step N — [Name]\n"
        "    What happens: one sentence\n"
        "    Why this step: one sentence\n"
        "    Visual concept: one sentence describing an icon/diagram element for this step\n"
        "  ## Diagram brief\n"
        "  One paragraph telling The Visual Artist how to render the method as a single diagram in the brand visual style.\n"
    )
    return write_output("proprietary-method", call_gemini(prompt))


def handle_linkedin_profile(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Draft a LinkedIn profile pack for this brand owner.\n"
        "Sections:\n"
        "  ## Headline (under 220 chars — must include audience + outcome, no buzzwords)\n"
        "  ## About section (3 paragraphs in brand voice — opens with a specific scene, not 'I help X do Y')\n"
        "  ## Featured items (3 suggestions for what to feature)\n"
        "  ## 30-second spoken pitch (transcript the owner can practice out loud — natural cadence, "
        "no slide-deck phrasing)\n"
        "  ## CTA in profile (one sentence directing to the next step)\n"
    )
    return write_output("linkedin-profile", call_gemini(prompt))


def handle_lead_magnet(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Propose a lead magnet + case study template for this brand.\n"
        "Sections:\n"
        "  ## Lead magnet concept (what + format + length — must be deliverable in <2 hours of owner work)\n"
        "  ## Lead magnet outline (sections with one-line descriptions)\n"
        "  ## Headline + landing-page copy (under 150 words)\n"
        "  ## Case study template\n"
        "    ### Sections: Client context, Pain, What we did, What changed, Owner quote (placeholder)\n"
        "    Format the template so the owner just fills in real client details.\n"
    )
    return write_output("lead-magnet", call_gemini(prompt))


def handle_dream_100(args, brand) -> Path:
    prompt = (
        voice_block(brand) + "\n"
        "TASK: Build a Dream 100 framework for this brand.\n"
        "Output:\n"
        "  ## Target persona profiles (3 personas — title, company stage, signals you'd recognize)\n"
        "  ## Where to find them (specific platforms, communities, events, lists)\n"
        "  ## Outreach templates — 3 variations per persona\n"
        "    Template A: cold value-first (you share something useful, no ask)\n"
        "    Template B: warm referral (mutual connection or shared context)\n"
        "    Template C: event-triggered (they posted/spoke/launched something)\n"
        "  ## Tracking sheet columns the owner should set up\n"
        "Concrete and ready to use. No 'engage authentically' fluff."
    )
    return write_output("dream-100", call_gemini(prompt))


def handle_weekly_system(args, brand) -> Path:
    pillars = brand.get("content_pillars", [])
    platforms = brand.get("platforms", {}).get("primary", [])
    prompt = (
        voice_block(brand) + "\n"
        f"PILLARS: {[p['name'] for p in pillars]}\n"
        f"PRIMARY PLATFORMS: {platforms}\n\n"
        "TASK: Map a sustainable weekly system for this brand owner.\n"
        "Sections:\n"
        "  ## MVME (Minimum Viable Marketing Effort)\n"
        "  The smallest weekly cadence that still moves the brand forward. "
        "Be honest — the owner has limited hours.\n"
        "  ## Weekly calendar\n"
        "  Day-by-day: what gets created, what gets posted, what gets followed up. "
        "Block time, name the action, link to the script (e.g. 'Mon AM: record voice memo → /voice-to-content').\n"
        "  ## Follow-up checklist\n"
        "  Standard cadence for new leads, warm leads, proposals out, won/lost.\n"
        "  ## Weekly review questions (5 prompts)\n"
        "  ## What to drop if the week falls apart\n"
    )
    return write_output("weekly-system", call_gemini(prompt))


# ---------------------------------------------------------------------------
# Delegation: items that just call existing scripts
# ---------------------------------------------------------------------------

def handle_one_pager(args, brand) -> Path:
    log.info("Delegating to scripts/build_pitch.py one-pager")
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "build_pitch.py"), "one-pager"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.error("build_pitch failed:\n%s", result.stderr)
        sys.exit(result.returncode)
    return Path(result.stdout.strip().splitlines()[-1])


HANDLERS = {
    "niche-clarity": handle_niche_clarity,
    "validate-niche": handle_validate_niche,
    "uvp": handle_uvp,
    "audience-matrix": handle_audience_matrix,
    "message-angles": handle_message_angles,
    "one-pager": handle_one_pager,
    "outreach-drafts": handle_outreach_drafts,
    "offer-doc": handle_offer_doc,
    "proprietary-method": handle_proprietary_method,
    "linkedin-profile": handle_linkedin_profile,
    "lead-magnet": handle_lead_magnet,
    "dream-100": handle_dream_100,
    "weekly-system": handle_weekly_system,
}

# Map ai_action keys back to homework item ids so status auto-advances.
ITEM_ID_MAP = {
    "niche-clarity": "niche-clarity",
    "validate-niche": "validate-niche-demand",
    "uvp": "uvp-and-proof",
    "audience-matrix": "audience-matrix",
    "message-angles": "message-angles",
    "one-pager": "one-pager",
    "outreach-drafts": "warm-outreach",
    "offer-doc": "offer-doc",
    "proprietary-method": "proprietary-method",
    "linkedin-profile": "linkedin-profile",
    "lead-magnet": "lead-magnet",
    "dream-100": "dream-100",
    "weekly-system": "weekly-system",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="AI executor for ai_doable homework items.")
    parser.add_argument("item", choices=sorted(HANDLERS.keys()))
    parser.add_argument("--count", type=int, default=20, help="For outreach-drafts: number of contacts.")
    parser.add_argument("--contacts", type=Path, default=None, help="For outreach-drafts: CSV of contacts.")
    args = parser.parse_args()

    brand = load_brand()
    handler = HANDLERS[args.item]
    out = handler(args, brand)
    advance_status(ITEM_ID_MAP.get(args.item, args.item))
    print(str(out))


if __name__ == "__main__":
    main()
