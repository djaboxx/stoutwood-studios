# brand-manager — Copilot workspace context

This repository runs **one personal brand**. The owner is configured in
`database/brand.json`. All Copilot agents and slash prompts derive their
behavior from that one file.

## Brand-first architecture

Every script, agent, and prompt:
1. Reads `database/brand.json` for voice, positioning, audio mix ratios, pillars, offers.
2. Reads `database/visual-style.json` for image and video aesthetic.
3. Produces output that matches both, or stops and explains why it can't.

If you're unsure how a feature should behave, **read the brand file first**.

## Voice-first principle

The owner is not a musician. They record voice. Everything else is generated.

- `audio.voice_volume = 1.0` and `audio.bed_volume = 0.35` are **fixed** in `brand.json`.
  Never expose these as adjustable knobs in any UI or prompt.
- AI-generated music beds **must not** contain drums, percussion, vocals, or hooks.
  They are texture — they support the voice, never compete with it.
- The `scripts/voice_to_content.py` orchestrator is the canonical pipeline.

## Agents

Switch to these in the VS Code Chat agents dropdown:

| Agent | When to use |
|---|---|
| The Strategist | Positioning, UVP, audience, offer architecture |
| The Copywriter | Platform copy, captions, email, pitch text |
| The Visual Artist | Cover art, promo images, video concepts |
| The Audio Producer | Voice → mixed audio → cover → video chain |
| The Publisher | Scheduling, calendar, platform publish |

## Slash prompts

Type `/` in chat:

- `/voice-to-content` — full pipeline from a voice memo
- `/session-start` — what to work on today
- `/weekly-content` — a week of posts from one pillar
- `/pitch-builder` — one-pager, deck, or proposal
- `/lead-followup` — overdue follow-up review
- `/brand-audit` — content drift check
- `/homework` — review strategic homework, run AI drafts where available

## Strategic homework system

`database/homework.json` is the program checklist that builds the brand (the 8-step Fractional in a Box homework, ported per owner). The Strategist owns it.

Each item has:
- `step` (1–8), `priority` (high/medium/low), `status` (not-started/in-progress/done/blocked/skipped)
- `ai_doable` — true if AI can draft it
- `ai_action` — the CLI command to run (e.g. `python scripts/do_homework.py uvp`)
- `owner_action` — what the human must do (review, decide, edit, send)

**Rule of separation**: AI drafts; the owner ratifies. AI never invents prices, real client details, niche commitment, or sends outreach. AI output lands in `content/homework/<id>.md` and the item moves to `in-progress` automatically — the owner marks `done` once they've reviewed.

**Entry points**:
- Slash prompt `/homework` (recommended)
- Status bar item "homework N" (click to open the QuickPick)
- LM tools: `listHomework`, `executeHomework`, `markHomeworkDone`
- CLI: `python scripts/manage_homework.py {list,show,status,next}` and `python scripts/do_homework.py <item-id>`

## Meeting review

When a meeting happens (sales call, discovery, podcast, advisory), feed the transcript through the meeting-review pipeline so it advances the brand.

**Webview**: Command Palette → **"Brand Manager: Review Meeting Transcript"** (`brandManager.openMeetingReview`). Paste transcript → Analyze → check approval boxes per proposal → Apply.

**Pipeline**: `scripts/process_meeting.py`
- `analyze` — reads transcript on stdin (or `--file`), loads `brand.json` + open homework, calls Gemini, prints proposals JSON. Writes nothing.
- `apply --proposals <file>` — writes only items flagged with `_approved: true` from the webview.

**What gets updated** (only on approval):
- `database/homework.json` — status changes (done / in-progress / blocked)
- `database/brand.json` — dot-path patches (e.g. `positioning.uvp`, `audience.primary.pain_points`)
- `database/leads.json` — new leads with role/company/context
- `content/meetings/YYYY-MM-DD-<slug>.md` — full meeting notes

**Rule**: AI proposes; the owner ratifies via checkboxes. AI never invents quotes, prices, niche commitments, or client details not in the transcript. The Strategist agent owns this workflow and has the `analyzeMeeting` LM tool for in-chat use.

## Scripting conventions

- Python 3.12+, `argparse`, `logging` to stderr, type hints, `from __future__ import annotations`.
- All scripts live under `scripts/` and import from `scripts/_brand.py` for shared loaders.
- Dependencies in `scripts/requirements.txt`.
- No secrets in code. `.env` and `credentials*.json` are gitignored.
- Idempotent: repeated runs don't duplicate data.

## Where things go

- Voice recordings: `audio/recordings/raw/`
- Mixed final audio: `audio/recordings/`
- Generated music beds: `audio/generated/`
- Transcripts: `audio/transcripts/`
- Content briefs and posts: `content/briefs/`, `content/posts/<platform>/`
- Generated visuals: `outputs/social/`
- Pitch assets: `pitch/`
- Lead PII: `database/leads.json` (gitignored)
- Meeting notes: `content/meetings/YYYY-MM-DD-<slug>.md`
