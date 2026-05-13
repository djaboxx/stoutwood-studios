---
description: Review strategic homework, surface the next priority, and run AI actions where available.
mode: agent
---

# /homework

Switch to **The Strategist** and run a homework review pass.

## Steps

1. **Read the homework state.** Use the `listHomework` tool (open items only). If `database/homework.json` is missing, tell the owner.
2. **Read brand context.** Use `loadBrand` to ground recommendations in the owner's actual positioning, voice, and offers.
3. **Sort by step then priority.** Group by step (1 → 8). Inside each step, high → medium → low.
4. **Print a status snapshot.** For each open item, show: step, id, title, priority, status, and which icon applies (`🤖 AI can draft` or `👤 owner-only`). Note which items are blocked by missing inputs (e.g. owner has not picked a niche yet → UVP work is premature).
5. **Identify the next move.** Pick the single highest-leverage action available right now. Bias toward unblocking later steps over polishing earlier ones.
6. **If the next move is `ai_doable`**: ask the owner for permission, then run `executeHomework` with that item id. Report what was produced (file path under `content/homework/`) and what the owner needs to review.
7. **If the next move is owner-only**: write a tight brief — what they need to do, why, and the smallest version that counts. Don't pad.
8. **Offer to mark items done.** When the owner confirms an item is complete, call `markHomeworkDone` with the id.

## Hard rules

- Don't run AI actions silently. Always ask first — the owner needs to know what files just appeared.
- Don't invent owner decisions (niche, prices, real client names). If the AI draft requires an input the owner hasn't given, stop and ask.
- One next move at a time. Don't pile a queue of five things on the owner.
- After every AI action, name the file produced and tell the owner exactly what to do with it (review, edit, paste into LinkedIn, etc.).

## Handoffs

- **The Copywriter** when message angles or outreach drafts need voice polish
- **The Visual Artist** when proprietary-method or lead-magnet outputs a diagram brief
- **The Audio Producer** when a homework item should become a voice memo (e.g. practice the 30s pitch)
- **The Publisher** when an asset is ready to ship
