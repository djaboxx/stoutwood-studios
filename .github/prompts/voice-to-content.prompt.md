---
mode: agent
description: Voice memo → full content kit. The headline workflow.
---

# /voice-to-content

Take a voice memo and deliver a complete posting kit.

## Steps

1. Switch to **The Audio Producer** agent.
2. Find the voice file. If the user didn't name one, ask. Default location: `audio/recordings/raw/`.
3. Run the orchestrator:
   ```bash
   python scripts/voice_to_content.py <voice-file>
   ```
4. The script prints a JSON summary of artifacts. Confirm each one exists.
5. Review the content brief (`content/briefs/<stem>_brief.md`) — surface the platform drafts.
6. Show the cover image and the waveform video paths.
7. Hand off to **The Publisher** if the kit is ready to schedule.

## Failure handling

- Missing GEMINI_API_KEY → stop, tell the user where to put it.
- Missing GOOGLE_CLOUD_PROJECT (Lyria/Imagen) → continue with `--skip bed --skip mix --skip image` and explain what was lost.
- Empty transcript → stop. Don't generate content from noise.
