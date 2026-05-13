#!/usr/bin/env python3
"""
manage_leads.py — Lead tracking + follow-up management for the brand.

Stores leads in database/leads.json (gitignored — contains PII).
The schema lives in database/leads.example.json.

Usage:
    python scripts/manage_leads.py add --name "Jane Doe" --email jane@co.com \\
        --org "Acme Corp" --source "linkedin DM" --interest "corporate wellness"

    python scripts/manage_leads.py list
    python scripts/manage_leads.py list --stage warm
    python scripts/manage_leads.py followup --id <lead-id> --note "Sent program PDF"
    python scripts/manage_leads.py advance --id <lead-id> --stage warm
    python scripts/manage_leads.py due  # show leads with overdue follow-ups
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from _brand import REPO_ROOT

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

LEADS_DB = REPO_ROOT / "database" / "leads.json"

STAGES = ["new", "contacted", "warm", "qualified", "proposal", "won", "lost"]
DEFAULT_FOLLOWUP_DAYS = {
    "new": 1,
    "contacted": 3,
    "warm": 7,
    "qualified": 5,
    "proposal": 7,
}


def load_leads() -> dict:
    if not LEADS_DB.exists():
        return {"leads": []}
    return json.loads(LEADS_DB.read_text(encoding="utf-8"))


def save_leads(data: dict) -> None:
    LEADS_DB.parent.mkdir(parents=True, exist_ok=True)
    LEADS_DB.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def next_followup(stage: str) -> str:
    days = DEFAULT_FOLLOWUP_DAYS.get(stage, 7)
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def cmd_add(args: argparse.Namespace) -> None:
    data = load_leads()
    lead_id = uuid.uuid4().hex[:8]
    lead = {
        "id": lead_id,
        "name": args.name,
        "email": args.email,
        "org": args.org,
        "title": args.title,
        "source": args.source,
        "interest": args.interest,
        "stage": "new",
        "created_at": utc_now(),
        "next_followup": next_followup("new"),
        "history": [{"ts": utc_now(), "event": "added", "note": args.note or ""}],
    }
    data["leads"].append(lead)
    save_leads(data)
    print(lead_id)


def _format_lead_line(lead: dict) -> str:
    return (
        f"{lead['id']}  {lead['stage']:<10} {lead.get('name', ''):<24} "
        f"{lead.get('org', ''):<20} next:{lead.get('next_followup', '-')[:10]}  "
        f"{lead.get('interest', '')}"
    )


def cmd_list(args: argparse.Namespace) -> None:
    data = load_leads()
    leads = data["leads"]
    if args.stage:
        leads = [l for l in leads if l.get("stage") == args.stage]
    leads.sort(key=lambda l: l.get("next_followup", "9"))
    for l in leads:
        print(_format_lead_line(l))


def cmd_followup(args: argparse.Namespace) -> None:
    data = load_leads()
    for lead in data["leads"]:
        if lead["id"] == args.id:
            lead["history"].append({"ts": utc_now(), "event": "followup", "note": args.note})
            lead["next_followup"] = next_followup(lead["stage"])
            save_leads(data)
            log.info("Logged follow-up. Next: %s", lead["next_followup"])
            return
    log.error("Lead not found: %s", args.id)
    sys.exit(2)


def cmd_advance(args: argparse.Namespace) -> None:
    if args.stage not in STAGES:
        log.error("Stage must be one of: %s", STAGES)
        sys.exit(2)
    data = load_leads()
    for lead in data["leads"]:
        if lead["id"] == args.id:
            old = lead["stage"]
            lead["stage"] = args.stage
            lead["history"].append({"ts": utc_now(), "event": "advanced", "from": old, "to": args.stage})
            lead["next_followup"] = next_followup(args.stage)
            save_leads(data)
            log.info("Advanced %s: %s → %s", args.id, old, args.stage)
            return
    log.error("Lead not found: %s", args.id)
    sys.exit(2)


def cmd_due(args: argparse.Namespace) -> None:
    data = load_leads()
    now = utc_now()
    due = [l for l in data["leads"]
           if l.get("stage") not in ("won", "lost")
           and l.get("next_followup", "9") <= now]
    due.sort(key=lambda l: l.get("next_followup", "9"))
    if not due:
        log.info("No overdue follow-ups.")
        return
    print(f"# Overdue follow-ups ({len(due)})")
    for l in due:
        print(_format_lead_line(l))


def main() -> None:
    parser = argparse.ArgumentParser(description="Lead tracker + follow-up manager.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("--name", required=True)
    p_add.add_argument("--email", default="")
    p_add.add_argument("--org", default="")
    p_add.add_argument("--title", default="")
    p_add.add_argument("--source", default="")
    p_add.add_argument("--interest", default="")
    p_add.add_argument("--note", default="")

    p_list = sub.add_parser("list")
    p_list.add_argument("--stage", choices=STAGES, default=None)

    p_fu = sub.add_parser("followup")
    p_fu.add_argument("--id", required=True)
    p_fu.add_argument("--note", required=True)

    p_adv = sub.add_parser("advance")
    p_adv.add_argument("--id", required=True)
    p_adv.add_argument("--stage", required=True, choices=STAGES)

    sub.add_parser("due")

    args = parser.parse_args()
    {"add": cmd_add, "list": cmd_list, "followup": cmd_followup,
     "advance": cmd_advance, "due": cmd_due}[args.cmd](args)


if __name__ == "__main__":
    main()
