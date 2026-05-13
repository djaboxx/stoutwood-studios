#!/usr/bin/env python3
"""
process_meeting.py — Analyze a meeting transcript and propose repo updates.

Reads a transcript (from stdin or --file), loads brand.json + homework.json,
and asks Gemini to propose:
  - Homework status changes (which items the meeting just unblocked or completed)
  - Brand DNA refinements (positioning / audience / voice tweaks the conversation surfaced)
  - New leads to add to manage_leads
  - Action items split between owner and AI
  - A meeting notes markdown file to save

Output: a JSON object on stdout describing all proposals. The webview reviews
them, the owner approves/rejects each, and --apply writes the approved changes.

Usage:
    cat transcript.txt | python scripts/process_meeting.py analyze
    python scripts/process_meeting.py analyze --file transcript.txt
    python scripts/process_meeting.py apply --proposals proposals.json
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

from _brand import REPO_ROOT, gemini_api_key, load_brand

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

HOMEWORK_DB = REPO_ROOT / "database" / "homework.json"
BRAND_DB = REPO_ROOT / "database" / "brand.json"
LEADS_DB = REPO_ROOT / "database" / "leads.json"
MEETINGS_DIR = REPO_ROOT / "content" / "meetings"


def call_gemini_json(prompt: str, model: str = "gemini-2.0-flash") -> dict:
    try:
        import google.genai as genai
    except ImportError:
        log.error("google-genai not installed.")
        sys.exit(1)
    client = genai.Client(api_key=gemini_api_key())
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={"response_mime_type": "application/json"},
    )
    text = (response.text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to recover JSON from a code fence
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        log.error("Gemini did not return valid JSON. Raw:\n%s", text)
        sys.exit(1)


def slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60] or "meeting"


# ---------------------------------------------------------------------------
# Analyze
# ---------------------------------------------------------------------------

def cmd_analyze(args: argparse.Namespace) -> None:
    if args.file:
        transcript = Path(args.file).read_text(encoding="utf-8")
    else:
        transcript = sys.stdin.read()
    if not transcript.strip():
        log.error("Empty transcript.")
        sys.exit(2)

    brand = load_brand()
    homework = json.loads(HOMEWORK_DB.read_text(encoding="utf-8")) if HOMEWORK_DB.exists() else {"items": []}

    open_items = [
        {"id": i["id"], "step": i.get("step"), "title": i["title"],
         "status": i["status"], "ai_doable": i.get("ai_doable", False)}
        for i in homework["items"]
        if i["status"] not in ("done", "skipped")
    ]

    prompt = f"""You are The Strategist for a personal brand. A meeting just ended.
Analyze the transcript and propose precise updates to the brand's repo.

BRAND CONTEXT (database/brand.json):
{json.dumps(brand, indent=2)}

OPEN STRATEGIC HOMEWORK (database/homework.json):
{json.dumps(open_items, indent=2)}

MEETING TRANSCRIPT:
\"\"\"
{transcript}
\"\"\"

Return JSON with EXACTLY this schema. Only include items you have real evidence for in the transcript:

{{
  "summary": "2-3 sentence summary of what happened in the meeting",
  "homework_updates": [
    {{
      "id": "<existing homework id>",
      "new_status": "in-progress|done|blocked",
      "reason": "1 sentence — what in the transcript supports this"
    }}
  ],
  "brand_patches": [
    {{
      "path": "dot.path.into.brand.json (e.g. positioning.uvp, voice.tone)",
      "current": "current value or null if new",
      "proposed": "proposed new value (string, list, or object)",
      "reason": "1 sentence — what in the transcript supports this"
    }}
  ],
  "new_leads": [
    {{
      "name": "person name",
      "org": "company",
      "title": "role",
      "context": "how the lead came up in the meeting",
      "next_step": "specific next action",
      "stage": "new|qualified|proposal|won|lost"
    }}
  ],
  "action_items": [
    {{
      "owner": "owner|ai",
      "task": "specific action",
      "homework_id": "<existing id if it maps to a homework item, else null>",
      "due": "YYYY-MM-DD or null"
    }}
  ],
  "meeting_notes_markdown": "A clean markdown writeup of the meeting (## Summary, ## Decisions, ## Action items, ## Quotes worth keeping). Use the brand voice."
}}

HARD RULES:
- Do NOT invent prices, client commitments, deal terms, or quotes the transcript doesn't contain.
- Only propose homework status changes if the transcript shows real evidence of progress.
- For brand_patches, only suggest changes when the meeting clearly contradicts or sharpens the current brand.json.
- If a section has nothing real to propose, return an empty array.
"""

    proposals = call_gemini_json(prompt)
    proposals["_meta"] = {
        "date": date.today().isoformat(),
        "transcript_chars": len(transcript),
    }
    print(json.dumps(proposals, indent=2))


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------

def set_dot_path(obj: dict, path: str, value: Any) -> None:
    keys = path.split(".")
    cur = obj
    for k in keys[:-1]:
        if k not in cur or not isinstance(cur[k], dict):
            cur[k] = {}
        cur = cur[k]
    cur[keys[-1]] = value


def cmd_apply(args: argparse.Namespace) -> None:
    proposals = json.loads(Path(args.proposals).read_text(encoding="utf-8"))
    applied: dict[str, list] = {
        "homework_updates": [],
        "brand_patches": [],
        "new_leads": [],
        "meeting_notes_file": None,
        "action_items_logged": 0,
    }

    # Homework updates
    if proposals.get("homework_updates") and HOMEWORK_DB.exists():
        homework = json.loads(HOMEWORK_DB.read_text(encoding="utf-8"))
        for upd in proposals["homework_updates"]:
            if not upd.get("_approved"):
                continue
            for it in homework["items"]:
                if it["id"] == upd["id"]:
                    old = it["status"]
                    it["status"] = upd["new_status"]
                    applied["homework_updates"].append(
                        {"id": it["id"], "from": old, "to": it["status"]}
                    )
                    break
        HOMEWORK_DB.write_text(json.dumps(homework, indent=2) + "\n", encoding="utf-8")

    # Brand patches
    if proposals.get("brand_patches") and BRAND_DB.exists():
        brand = json.loads(BRAND_DB.read_text(encoding="utf-8"))
        for patch in proposals["brand_patches"]:
            if not patch.get("_approved"):
                continue
            set_dot_path(brand, patch["path"], patch["proposed"])
            applied["brand_patches"].append(
                {"path": patch["path"], "to": patch["proposed"]}
            )
        BRAND_DB.write_text(json.dumps(brand, indent=2) + "\n", encoding="utf-8")

    # New leads
    if proposals.get("new_leads"):
        leads = []
        if LEADS_DB.exists():
            leads = json.loads(LEADS_DB.read_text(encoding="utf-8")).get("leads", [])
        added_now = []
        for lead in proposals["new_leads"]:
            if not lead.get("_approved"):
                continue
            entry = {
                "name": lead.get("name", ""),
                "org": lead.get("org", ""),
                "title": lead.get("title", ""),
                "context": lead.get("context", ""),
                "next_step": lead.get("next_step", ""),
                "stage": lead.get("stage", "new"),
                "added": date.today().isoformat(),
                "last_contact": date.today().isoformat(),
            }
            leads.append(entry)
            added_now.append(entry["name"])
        if added_now:
            LEADS_DB.parent.mkdir(parents=True, exist_ok=True)
            LEADS_DB.write_text(
                json.dumps({"leads": leads}, indent=2) + "\n", encoding="utf-8"
            )
            applied["new_leads"] = added_now

    # Meeting notes
    notes = proposals.get("meeting_notes_markdown")
    if notes and proposals.get("_meeting_notes_approved"):
        MEETINGS_DIR.mkdir(parents=True, exist_ok=True)
        meta = proposals.get("_meta", {})
        d = meta.get("date") or date.today().isoformat()
        title = proposals.get("summary", "meeting").split(".")[0]
        slug = slugify(title)
        out = MEETINGS_DIR / f"{d}-{slug}.md"
        action_items = proposals.get("action_items", [])
        approved_actions = [a for a in action_items if a.get("_approved")]
        body = f"# Meeting — {d}\n\n## Summary\n{proposals.get('summary', '')}\n\n{notes}\n"
        if approved_actions:
            body += "\n## Approved action items\n"
            for a in approved_actions:
                owner_tag = "🤖 AI" if a.get("owner") == "ai" else "👤 Owner"
                due = f" (due {a['due']})" if a.get("due") else ""
                hw = f" [hw:{a['homework_id']}]" if a.get("homework_id") else ""
                body += f"- {owner_tag}: {a.get('task', '')}{due}{hw}\n"
            applied["action_items_logged"] = len(approved_actions)
        out.write_text(body, encoding="utf-8")
        applied["meeting_notes_file"] = str(out.relative_to(REPO_ROOT))

    print(json.dumps(applied, indent=2))


def main() -> None:
    p = argparse.ArgumentParser(description="Process a meeting transcript into repo updates.")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analyze", help="Analyze transcript, output proposals JSON.")
    a.add_argument("--file", default=None, help="Transcript file. If omitted, reads stdin.")
    ap = sub.add_parser("apply", help="Apply approved proposals.")
    ap.add_argument("--proposals", required=True, help="Path to proposals JSON (with _approved flags set).")
    args = p.parse_args()
    {"analyze": cmd_analyze, "apply": cmd_apply}[args.cmd](args)


if __name__ == "__main__":
    main()
