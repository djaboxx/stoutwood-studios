#!/usr/bin/env python3
"""
manage_homework.py — Track strategic homework progress for the brand owner.

Reads/writes database/homework.json. Used by The Strategist agent to:
  - Show what's outstanding and prioritized
  - Mark items in-progress / done
  - Surface which items the AI can do (and which command runs it)

Usage:
    python scripts/manage_homework.py list
    python scripts/manage_homework.py list --open --ai-doable
    python scripts/manage_homework.py show <id>
    python scripts/manage_homework.py status <id> --to in-progress
    python scripts/manage_homework.py status <id> --to done
    python scripts/manage_homework.py next        # what to work on next
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from _brand import REPO_ROOT

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)

HOMEWORK_DB = REPO_ROOT / "database" / "homework.json"

VALID_STATUSES = ("not-started", "in-progress", "done", "blocked", "skipped")
PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def load() -> dict:
    if not HOMEWORK_DB.exists():
        log.error("database/homework.json not found.")
        sys.exit(2)
    return json.loads(HOMEWORK_DB.read_text(encoding="utf-8"))


def save(data: dict) -> None:
    HOMEWORK_DB.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def status_icon(s: str) -> str:
    return {"not-started": "○", "in-progress": "◐", "done": "●",
            "blocked": "⊗", "skipped": "—"}.get(s, "?")


def priority_icon(p: str) -> str:
    return {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(p, "·")


def ai_icon(item: dict) -> str:
    return "🤖" if item.get("ai_doable") else "👤"


def fmt_line(item: dict) -> str:
    return (
        f"{status_icon(item['status'])} {priority_icon(item['priority'])} "
        f"{ai_icon(item):<2} step{item.get('step', '?')}  "
        f"{item['id']:<24} {item['title']}"
    )


def cmd_list(args: argparse.Namespace) -> None:
    data = load()
    items = data["items"]
    if args.open:
        items = [i for i in items if i["status"] not in ("done", "skipped")]
    if args.ai_doable:
        items = [i for i in items if i.get("ai_doable")]
    if args.category:
        items = [i for i in items if i.get("category") == args.category]

    items.sort(key=lambda i: (i.get("step", 99), PRIORITY_RANK.get(i.get("priority", "low"), 9)))
    for i in items:
        print(fmt_line(i))
    if not items:
        print("(no items match)")


def cmd_show(args: argparse.Namespace) -> None:
    data = load()
    item = next((i for i in data["items"] if i["id"] == args.id), None)
    if not item:
        log.error("No homework item with id: %s", args.id)
        sys.exit(2)
    print(json.dumps(item, indent=2))


def cmd_status(args: argparse.Namespace) -> None:
    if args.to not in VALID_STATUSES:
        log.error("Status must be one of: %s", VALID_STATUSES)
        sys.exit(2)
    data = load()
    for i in data["items"]:
        if i["id"] == args.id:
            old = i["status"]
            i["status"] = args.to
            save(data)
            log.info("Updated %s: %s → %s", args.id, old, args.to)
            return
    log.error("No homework item with id: %s", args.id)
    sys.exit(2)


def cmd_next(args: argparse.Namespace) -> None:
    """Surface the highest-priority outstanding item, with AI action if available."""
    data = load()
    open_items = [i for i in data["items"] if i["status"] not in ("done", "skipped", "blocked")]
    if not open_items:
        print("All homework done or blocked. Nothing to assign.")
        return
    open_items.sort(key=lambda i: (i.get("step", 99), PRIORITY_RANK.get(i.get("priority", "low"), 9)))
    nxt = open_items[0]
    print(f"NEXT UP — Step {nxt.get('step')}: {nxt['title']}")
    print(f"  ID:           {nxt['id']}")
    print(f"  Priority:     {nxt['priority']}")
    print(f"  Status:       {nxt['status']}")
    print(f"  Category:     {nxt['category']}")
    print(f"  Notes:        {nxt['notes']}")
    print()
    if nxt.get("ai_doable"):
        print(f"  🤖 AI can draft this. Run:")
        print(f"     {nxt['ai_action']}")
    else:
        print(f"  👤 Owner-only. {nxt.get('owner_action', '')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Strategic homework tracker.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list")
    p_list.add_argument("--open", action="store_true", help="Only outstanding items.")
    p_list.add_argument("--ai-doable", action="store_true", help="Only items AI can draft.")
    p_list.add_argument("--category", default=None)

    p_show = sub.add_parser("show")
    p_show.add_argument("id")

    p_status = sub.add_parser("status")
    p_status.add_argument("id")
    p_status.add_argument("--to", required=True, choices=VALID_STATUSES)

    sub.add_parser("next")

    args = parser.parse_args()
    {"list": cmd_list, "show": cmd_show, "status": cmd_status, "next": cmd_next}[args.cmd](args)


if __name__ == "__main__":
    main()
