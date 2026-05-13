---
mode: agent
description: Audit recent content against brand DNA and flag drift.
---

# /brand-audit

1. Switch to **The Strategist** agent.
2. Read `database/brand.json` (positioning, voice).
3. Walk recent files in `content/posts/` and `content/briefs/` (last 14 days).
4. For each, evaluate:
   - Voice match (any words from `voice.avoid`?)
   - Audience fit (does it speak to the target?)
   - Pillar alignment (does it ladder to a content pillar?)
5. Produce a brief audit report. Flag concrete drift, propose fixes.
6. Hand off to **The Copywriter** for re-drafting flagged content.
