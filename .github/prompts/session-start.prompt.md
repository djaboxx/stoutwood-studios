---
mode: agent
description: Read brand DNA, surface today's priorities.
---

# /session-start

1. Read `database/brand.json` (positioning, voice, audio settings, pillars).
2. Read `database/content-calendar.json` — what's scheduled today/this week, what's overdue.
3. Run `python scripts/manage_leads.py due` — show overdue follow-ups.
4. Check `audio/recordings/raw/` for unprocessed voice memos.
5. Propose 3 prioritized actions for the session.
