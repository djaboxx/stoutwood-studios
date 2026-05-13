---
mode: agent
description: Generate a week of platform content from one pillar.
---

# /weekly-content

1. Switch to **The Copywriter** agent.
2. Ask the user which pillar (from `brand.json -> content_pillars`) and which platform.
3. Run:
   ```bash
   python scripts/generate_content.py weekly --platform <platform> --pillar <pillar> --days 7
   ```
4. Review each draft against `voice.avoid`. Flag any that drift.
5. Hand off to **The Visual Artist** for any post that needs a partner image.
6. Hand off to **The Publisher** to schedule.
