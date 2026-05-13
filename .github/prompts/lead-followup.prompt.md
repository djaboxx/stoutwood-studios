---
mode: agent
description: Review overdue lead follow-ups and draft outreach.
---

# /lead-followup

1. Run `python scripts/manage_leads.py due`.
2. For each overdue lead, propose a follow-up action — calibrated to their stage and interest.
3. Switch to **The Copywriter** for any drafted DM/email.
4. Log the follow-up: `python scripts/manage_leads.py followup --id <id> --note "<what was sent>"`.
5. If a lead advances stage, run `manage_leads.py advance`.
