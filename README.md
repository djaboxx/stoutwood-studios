# Brand Manager

> A GitHub template repository for building, managing, and pitching any personal or professional brand — AI-native, fully automatable from VS Code.

Clone this repo once. Configure it for your brand. Let Copilot agents run the rest.

---

## What This Is

**Brand Manager** is a structured, opinionated template that gives any consultant, coach, creator, or fractional executive the same automated brand infrastructure that a funded startup would have — driven entirely by a VS Code extension, GitHub Copilot agents, Python scripts, and free/low-cost APIs.

It was designed from two real use cases:
- **IRON STATIC** — an electronic metal duo that built a complete AI-powered creative production pipeline (audio recording, content, visuals, video, publishing) inside a VS Code extension with named Copilot agents handling every role.
- **A senior executive going fractional** — a VP / Chief of Staff with 20+ years in tech pivoting to independent practice, who needs the same infrastructure adapted for a completely different aesthetic and audience.

The insight: the *machinery* is the same. The *aesthetic*, *voice*, and *positioning data* are different. This repo is the reusable machinery.

---

## What It Does

| Capability | What you get |
|---|---|
| **Brand DNA** | A single `database/brand.json` config that drives all AI generation — voice, visual style, platforms, UVP, target audience |
| **Audio Recorder** | In-VS Code WebView recorder — capture audio from any mic, 48kHz WAV, with a post-save pipeline menu |
| **Voice-First Audio Pipeline** | Record voice → AI generates music bed → ffmpeg mixes (voice 100%, bed 35%) → final audio. No DAW, no Ableton, no music knowledge. |
| **Post-Recording Pipeline** | One click: transcribe → content brief → cover art → waveform video → ready to post |
| **Content Engine** | AI-generated social posts, email campaigns, and long-form content calibrated to your brand voice via Gemini |
| **Image Pipeline** | AI brand visuals and cover art via Imagen in your brand aesthetic — not generic stock art |
| **Video Pipeline** | Short-form video via Veo + ffmpeg, waveform visualizers, voice-driven storyboard videos — ready for YouTube/Reels/TikTok |
| **Lead Engine** | Prospect tracking, outreach sequence templates, follow-up checklists from the Fractional in a Box framework |
| **Pitch Arsenal** | One-pager, deck outline, and proposal template auto-filled from your brand data |
| **Publishing** | One-command post to LinkedIn, Instagram, YouTube, and email |
| **VS Code Extension** | `brand-manager-bridge` — LM tools, audio recorder, pipeline runner, all accessible from Copilot Chat |
| **Copilot Agents** | Named agents: Strategist, Copywriter, Visual Artist, **Audio Producer**, Publisher |
| **GitHub Actions** | Scheduled weekly content generation, lead follow-up reminders, and brand audit |

---

## Who This Is For

- **Fractional executives** building a personal brand alongside their work
- **Coaches and consultants** who need a consistent content and pitch presence
- **Creators** who want to automate the business side of their brand
- **Solopreneurs** who can't afford a marketing team but can configure a repo

This template is explicitly **not** opinionated about niche, aesthetic, or audience. A spiritual yoga counselor and an industrial metal band share the same repo structure — they just have different `brand.json` files.

---

## Quick Start

### 1. Use this template

Click **Use this template** on GitHub to create your own repo, or:

```bash
gh repo create my-brand --template HappyPathway/brand-manager --private
cd my-brand
```

### 2. Configure your brand

Edit `database/brand.json`. This file is the single source of truth for everything:

```bash
cp database/brand.example.json database/brand.json
# Edit brand.json with your details — see Brand DNA section below
```

### 3. Set up credentials

```bash
cp .env.example .env
# Fill in: GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT, GMAIL credentials
```

Credentials that go in `.env` (never committed):
- `GEMINI_API_KEY` — Google AI Studio (free tier available)
- `GOOGLE_APPLICATION_CREDENTIALS` — for Imagen/Veo image and video generation
- `GMAIL_CREDENTIALS_PATH` — for email sending (`credentials_gmail.json`)

### 4. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### 5. Run your first content generation

```bash
# Generate a week of social content
python scripts/generate_content.py --platforms instagram linkedin --days 7

# Generate a brand visual
python scripts/generate_image.py --type cover --format square

# Build your one-pager
python scripts/build_pitch.py --format one-pager
```

---

## Repo Structure

```
brand-manager/
├── database/
│   ├── brand.json              # Brand DNA — the single config that drives everything
│   ├── brand.example.json      # Template to copy and fill in
│   ├── leads.json              # Prospect and lead tracking
│   ├── content-calendar.json   # Scheduled and published content log
│   └── visual-style.json       # Visual aesthetic spec (palette, imagery vocab, motion rules)
│
├── content/
│   ├── posts/                  # Generated social posts (ready to publish)
│   ├── emails/                 # Email campaigns and newsletters
│   ├── long-form/              # Blog posts, articles, thought leadership
│   └── scripts/                # Video and podcast scripts
│
├── pitch/
│   ├── one-pager.md            # Single-page brand/offer summary (auto-generated)
│   ├── deck-outline.md         # Slide deck structure with talking points
│   ├── proposal-template.md    # Proposal framework for client engagements
│   └── uvp.md                  # Unique Value Proposition — positioned and tested
│
├── outputs/
│   ├── social/                 # Generated images, videos, and captions
│   └── campaigns/              # Email campaign drafts and send logs
│
├── scripts/
│   ├── voice_to_content.py     # ONE COMMAND: record → transcribe → bed → mix → brief → image → video
│   ├── transcribe_audio.py     # Gemini speech-to-text from a WAV file
│   ├── generate_audio.py       # AI music bed generation (no DAW required)
│   ├── mix_voice.py            # ffmpeg amix: voice at 100%, bed at 35% — fixed ratio
│   ├── generate_content.py     # AI content generation via Gemini
│   ├── generate_image.py       # Brand visuals via Imagen 4
│   ├── generate_video.py       # Short-form video via Veo + ffmpeg (waveform, AI clip, storyboard)
│   ├── build_pitch.py          # Generate pitch docs from brand data
│   ├── manage_leads.py         # Lead tracker (add, update, list, follow-up)
│   ├── publish_social.py       # Post to LinkedIn, Instagram
│   ├── send_email.py           # Send campaigns via Gmail API
│   └── requirements.txt
│
├── knowledge/
│   ├── brand-lore/
│   │   ├── origin-story.md     # How the brand came to be — authentic narrative
│   │   ├── manifesto.md        # What the brand stands for (and against)
│   │   └── audience-insights.md # Who the audience is and what they need
│   ├── competitor-analysis.md
│   └── sessions/               # Weekly working session notes and decisions
│
├── .github/
│   ├── copilot-instructions.md # Copilot workspace context for this brand
│   ├── agents/                 # Named Copilot agent personas
│   │   ├── the-strategist.agent.md
│   │   ├── the-copywriter.agent.md
│   │   ├── the-visual-artist.agent.md
│   │   └── the-publisher.agent.md
│   ├── skills/                 # Reusable Copilot skills
│   │   ├── generate-content/
│   │   ├── generate-image/
│   │   ├── build-pitch/
│   │   └── publish-post/
│   ├── prompts/                # Slash-command workflows
│   │   ├── session-start.prompt.md
│   │   ├── weekly-content.prompt.md
│   │   ├── pitch-builder.prompt.md
│   │   └── lead-followup.prompt.md
│   └── workflows/
│       ├── weekly-content.yml  # Scheduled: generate + queue posts
│       └── lead-audit.yml      # Scheduled: flag stale leads
│
├── audio/
│   ├── recordings/
│   │   └── raw/                # WAV captures from the in-VS Code recorder (48kHz)
│   └── generated/              # AI-generated audio (music beds, brand loops)
│
├── vscode-extension/
│   └── brand-manager-bridge/   # VS Code extension — recorder UI, LM tools, pipeline runner
│
└── .env.example                # Credential template (never commit .env)
```

---

## VS Code Extension — `brand-manager-bridge`

The extension is the primary interface. Everything is accessible from Copilot Chat or the command palette — no terminal required.

### Audio Recorder

Open it: **Command Palette → Brand Manager: Open Recorder** (or `Cmd+Shift+P` → `brandManager.openRecorder`)

The recorder opens as a VS Code WebView panel. It:
- Enumerates all connected audio input devices (mic, USB interface, built-in)
- Records at 48kHz stereo WAV — broadcast quality
- Saves to `audio/recordings/raw/` with brand-slug naming conventions

After saving, a **post-save pipeline menu** appears with one-click actions:

| Action | What it does |
|---|---|
| **Voice to Content (Recommended)** | Transcribe → content brief → generate music bed → mix (voice at 100%, bed at 35%) → cover art → waveform video — the complete voice-first pipeline |
| **Transcribe + Content Brief Only** | Gemini transcription → structured content brief — just the words, no audio production |
| **Generate Music Bed + Mix** | Generate AI instrumental from brand mood config → ffmpeg amix with voice prominent → final WAV |
| **Tag as Training Material** | Register in `database/voices_training.json` for AI voice model fine-tuning |
| **Queue for Cloud Upload** | Mark pending in `database/gcs_manifest.json` for remote storage |
| **Reveal in Finder** | Open the file location |

> **Voice-first principle**: The brand owner is not a musician. The audio pipeline is designed so their voice is always the primary signal — AI-generated music is background texture that supports their words, never competing with them. Mix levels are fixed: voice 100%, music bed 35%. No DAW, no Ableton, no audio engineering required.

### LM Tools (Copilot Chat integration)

The extension registers these tools so Copilot agents can call them directly:

| Tool | What it does |
|---|---|
| `brandManager_generateContent` | Generate social posts, emails, or long-form content via Gemini |
| `brandManager_generateImage` | Create brand visuals via Imagen in the configured visual style |
| `brandManager_generateVideo` | Short-form video via Veo or waveform visualizer via ffmpeg |
| `brandManager_generateMusicBed` | AI instrumental generation from a mood/style description — no DAW, no music knowledge required |
| `brandManager_mixVoiceAndBed` | ffmpeg amix — combine voice recording (prominent) with generated music bed (background) |
| `brandManager_buildPitch` | Generate one-pager, deck outline, or proposal from brand data |
| `brandManager_manageLeads` | Add, list, and draft follow-ups for prospects |
| `brandManager_publishPost` | Post to configured social platforms |

---

## Audio / Video / Image Pipeline

The full creative production pipeline runs from a single voice recording or text brief. **No DAW. No Ableton. No music production skills required.**

### Audio — Voice First

The audio pipeline is built around one rule: **the brand owner's voice is always center.** AI-generated music beds exist to support what they say, not to be the feature.

```bash
# Step 1: Transcribe a voice recording (Gemini)
python scripts/transcribe_audio.py audio/recordings/raw/my-recording.wav
# → saves transcript to audio/transcripts/my-recording.txt

# Step 2: Generate a matching music bed (fully AI, no DAW)
python scripts/generate_audio.py \
  --type music-bed \
  --mood "calm, grounded, meditative" \
  --duration 90 \
  --output audio/generated/my-recording_bed.wav

# Step 3: Mix voice + bed (voice at 100%, bed at 35%)
python scripts/mix_voice.py \
  --voice audio/recordings/raw/my-recording.wav \
  --bed audio/generated/my-recording_bed.wav \
  --output audio/recordings/my-recording_final.wav
# ffmpeg amix: voice=1.0, bed=0.35 — voice is always intelligible
```

Or run all three steps in one command:
```bash
python scripts/voice_to_content.py audio/recordings/raw/my-recording.wav
# → transcript + music bed + final mix + content brief, all in one pass
```

**Mix philosophy**: The bed is a felt presence, not a production. It should add warmth and intention without ever asking the listener to decide between the music and the words. If the voice is hard to follow, the bed is too loud.

### Images

All images are generated in the visual style defined in `database/visual-style.json` (your brand palette, aesthetic vocabulary, what to avoid).

```bash
# Brand cover art — square for Instagram
python scripts/generate_image.py --type cover --format square

# Promo image for a specific post
python scripts/generate_image.py \
  --type promo \
  --caption "Morning breathwork for decision fatigue" \
  --formats square landscape portrait

# Profile photo update candidate
python scripts/generate_image.py --type profile
```

Output lands in `outputs/social/`.

### Video

Three video types, all driven by ffmpeg:

**1. Waveform visualizer** — show the actual audio as a waveform against brand background. Fast, always on-brand.

```bash
python scripts/generate_video.py \
  --type waveform \
  --audio audio/recordings/raw/my-session.wav \
  --cover outputs/social/my-cover_square.png \
  --formats landscape square portrait
```

**2. AI short-form clip** — 8-second Veo-generated clip from a text description. Best for social teasers.

```bash
python scripts/generate_video.py \
  --type ai-clip \
  --prompt "morning light through leaves, slow breath, grounded stillness" \
  --format portrait
```

**3. Multi-scene storyboard** — Gemini writes a scene plan, Imagen renders keyframes, Veo animates each, ffmpeg stitches them together.

```bash
python scripts/generate_video.py \
  --type storyboard \
  --scenes 3 \
  --format landscape
```

All video output: `outputs/social/[brand-slug]_[type]_[format]_v[n].mp4`

### Platform format map

| Platform | Format | Dimensions |
|---|---|---|
| YouTube | landscape | 1920×1080 |
| Instagram feed | square | 1080×1080 |
| Instagram Reels / TikTok | portrait | 1080×1920 |
| LinkedIn | landscape | 1920×1080 |

---



This is the only file you *must* fill in to make everything else work. Every script, every Copilot agent, and every GitHub Action reads from it.

```json
{
  "brand": {
    "name": "Your Brand Name",
    "tagline": "One-line summary of what you do and for whom",
    "owner": "Your Name",
    "niche": "e.g. spiritual yoga counseling, fractional CFO, executive coaching",
    "stage": "launch | growth | established"
  },

  "positioning": {
    "uvp": "I help [target market] achieve [outcome] by [unique method] that [eliminates pain point].",
    "target_audience": {
      "who": "e.g. burned-out tech executives, early-stage founders, senior women in transition",
      "pain": "e.g. disconnected from body and purpose despite professional success",
      "desire": "e.g. sustainable performance and inner clarity without leaving their career"
    },
    "differentiators": [
      "e.g. 20+ years in corporate environments — I understand the pressure from the inside",
      "e.g. Yoga philosophy meets executive coaching frameworks"
    ],
    "competitors": "e.g. generalist wellness coaches, meditation apps, traditional therapists"
  },

  "voice": {
    "tone": "e.g. calm, grounded, direct, warm, non-dogmatic",
    "vocabulary": ["transformation", "integration", "presence", "clarity"],
    "avoid": ["hustle", "crush it", "hack", "guru"],
    "persona": "e.g. A trusted guide who has walked the same path — not a teacher on a pedestal"
  },

  "visual_style": {
    "palette": {
      "background": "#f5f0eb",
      "primary": "#3d5a47",
      "accent": "#c9a96e",
      "text": "#2a2a2a"
    },
    "aesthetic": "e.g. warm minimalism — natural textures, soft light, negative space",
    "imagery_vocabulary": ["earth tones", "water", "breath", "roots", "open sky"],
    "prohibition": "No stock photo smiles. No lotus poses. No Sanskrit clichés."
  },

  "audio": {
    "bed_mood": "e.g. calm, grounded, meditative, minimal, warm — used to generate music beds",
    "bed_volume": 0.35,
    "voice_volume": 1.0,
    "sample_rate": 48000,
    "format": "wav",
    "note": "Voice is always the primary signal. The bed is background texture only."
  },


  "platforms": {
    "primary": ["instagram", "linkedin"],
    "secondary": ["email", "youtube"],
    "posting_frequency": {
      "instagram": "3x per week",
      "linkedin": "2x per week",
      "email": "1x per week"
    }
  },

  "offer": {
    "services": [
      {
        "name": "e.g. 1:1 Yoga Counseling",
        "format": "e.g. 60-min weekly sessions",
        "price_range": "e.g. $300–500/month",
        "ideal_client": "e.g. executive or professional in burnout recovery"
      }
    ],
    "lead_magnet": "e.g. 5-minute morning breathwork guide for high-performers"
  }
}
```

---

## Copilot Agents

Five named agents handle specialized tasks. Switch to them in VS Code's Copilot Chat dropdown.

| Agent | When to use |
|---|---|
| **The Strategist** | Brand positioning, UVP refinement, audience analysis, competitive differentiation |
| **The Copywriter** | Social posts, email campaigns, pitch copy, bio, LinkedIn headline |
| **The Visual Artist** | Brand image generation, cover art, visual style decisions |
| **The Audio Producer** | End-to-end audio content — takes a raw voice recording, generates a matching music bed, mixes with voice prominent, hands off to The Publisher. No DAW required. |
| **The Publisher** | Platform-specific posting, scheduling, caption formatting, hashtag strategy |

**Typical workflow chains:**
- Brand setup: **Strategist** (UVP + positioning) → **Copywriter** (bio + one-pager) → **Visual Artist** (brand images)
- Weekly content: **Copywriter** (drafts) → **Strategist** (review angles) → **Publisher** (post)
- New pitch: **Strategist** (brief) → **Copywriter** (deck outline + one-pager) → review
- Voice content: **Audio Producer** (record → bed → mix → video) → **Visual Artist** (cover art) → **Publisher** (post)

---

## Slash-Command Prompts

| Prompt | What it does |
|---|---|
| `/session-start` | Read brand context, review last week's performance, propose 3 priority actions |
| `/weekly-content` | Generate 7 days of posts across all active platforms, calibrated to brand voice and content pillars |
| `/voice-to-content [recording]` | Full voice-first pipeline — transcribe → content brief → generate music bed → mix (voice center) → cover art → video → queue for publish |
| `/pitch-builder [format]` | Build or update a pitch asset — one-pager, deck, or proposal — from brand data |
| `/lead-followup` | Review stale leads, draft personalized follow-up messages, flag who to call |
| `/brand-audit` | Check consistency of brand voice and visual style across all recent outputs |

---

## Worked Example: Fractional Executive Coach

**Brand:** Executive coaching and advisory for senior professionals in career transition.

**Why this template fits:**
- The owner has 20+ years of corporate leadership — they understand the pressures their clients face from the inside. That's the differentiator.
- They are not a "generic life coach" — they are a credentialed executive with domain expertise. The brand voice must carry that gravity.
- Their pitch audience is two-sided: individual executives seeking private coaching, and corporate L&D/HR buyers seeking group programs.

**Brand DNA highlights:**
```json
{
  "brand": { "name": "Your Brand Name", "niche": "executive coaching and advisory" },
  "positioning": {
    "uvp": "I help senior professionals [achieve outcome] by [unique method] — because [reason it lasts].",
    "target_audience": {
      "who": "VPs, directors, and senior leaders in transition, 35–55",
      "pain": "Achieving external success while feeling increasingly disconnected or depleted",
      "desire": "Sustainable high performance — integrating who they are into what they do"
    }
  },
  "visual_style": {
    "palette": { "background": "#f5f0eb", "primary": "#2a4a5e", "accent": "#c9a96e" },
    "aesthetic": "Clean and authoritative — professional without being corporate cold."
  }
}
```

**Content pillars for weekly content generation:**
1. Insight and tools — practical frameworks for high-pressure moments
2. Client stories — how the methodology creates real outcomes
3. Reframes — challenging dominant narratives about performance and ambition
4. Behind the practice — personal narrative, transparency, the why

**Media creation workflows:**

*Recording a voice note — the primary workflow:*
1. Open VS Code → `Cmd+Shift+P` → `Brand Manager: Open Recorder`
2. Select mic, hit record, speak freely for 2–3 minutes — a reflection, teaching moment, client story, or insight
3. Stop recording → **Voice to Content (Recommended)**
4. The Audio Producer agent runs:
   - Gemini transcribes the recording
   - Content brief generated in your brand voice
   - AI music bed generated to match the mood and duration of your recording (no DAW)
   - ffmpeg mixes voice at 100% and music bed at 35% — your words are always the signal
   - Imagen generates a brand cover image in your visual style
   - ffmpeg renders a waveform video using the final mixed audio + cover
   - All outputs land in `outputs/social/` ready for review
5. Review, approve, hand off to The Publisher agent to post

> **No music knowledge needed.** The music bed mood is derived from `database/brand.json` → `audio.bed_mood`. The owner never touches a mixer or thinks about a key signature.

*Generating a week of LinkedIn content:*
```bash
python scripts/generate_content.py \
  --platforms linkedin \
  --days 7 \
  --pillar "insight-and-tools"
```
Each post gets an AI-generated caption in your brand voice + a matching image in your visual aesthetic.

*Creating a short promo video from a voice note:*
```bash
python scripts/voice_to_content.py audio/recordings/raw/my-recording.wav \
  --video storyboard \
  --scenes 3 \
  --format portrait
```
Gemini transcribes the voice note and writes a 3-scene storyboard from it. Veo generates the clips. ffmpeg assembles them with your mixed audio (voice + bed) underneath — so the video is literally built from what you said.

---

## Lead Engine

Based on the Fractional in a Box framework. The 8-step lead development system lives in `knowledge/lead-engine/` and is integrated into the `/lead-followup` prompt.

```bash
# Add a lead
python scripts/manage_leads.py add \
  --name "Jane Smith" \
  --company "Acme Corp" \
  --role "VP Engineering" \
  --source "LinkedIn DM" \
  --notes "Mentioned burnout, interested in executive yoga program"

# List all leads needing follow-up (stale > 7 days)
python scripts/manage_leads.py list --stale 7

# Draft personalized follow-up for all stale leads
python scripts/manage_leads.py draft-followup --all
```

---

## Pitch System

The pitch system auto-generates from `database/brand.json` + `pitch/uvp.md`.

```bash
# Generate one-pager (Markdown → PDF-ready)
python scripts/build_pitch.py --format one-pager

# Generate deck outline with speaking notes
python scripts/build_pitch.py --format deck

# Generate a proposal for a specific client
python scripts/build_pitch.py --format proposal \
  --client "Jane Smith" \
  --context "Corporate wellness program, 50-person team, quarterly engagement"
```

All outputs land in `pitch/`. Review and edit before sending — the AI drafts, you approve.

---

## Content Pipeline

```bash
# Generate one week of Instagram + LinkedIn posts
python scripts/generate_content.py \
  --platforms instagram linkedin \
  --days 7 \
  --pillar "breath-and-regulation"

# Generate a monthly email newsletter
python scripts/generate_content.py \
  --type email \
  --subject "What your body already knows about decision fatigue"

# Generate brand images (square for Instagram, landscape for LinkedIn)
python scripts/generate_image.py \
  --type promo \
  --formats square landscape \
  --caption "5-minute breathwork guide drop"
```

---

## GitHub Actions

| Workflow | Schedule | What it does |
|---|---|---|
| `weekly-content.yml` | Every Monday 7am | Generates 7 days of draft posts, opens PR for review |
| `lead-audit.yml` | Every Friday 9am | Creates GitHub issues for leads stale > 7 days |

Both workflows read from `database/brand.json` and `database/leads.json`. No secrets are ever written to the repo.

---

## Security

- Never commit `.env`, `credentials*.json`, or `token*.json` — all are in `.gitignore`
- OAuth tokens for Gmail/Google APIs are local-only
- API keys are environment variables only — never hardcoded
- Lead data in `database/leads.json` should be treated as PII — do not commit to a public repo

---

## Development Philosophy — Extension First

**New features belong in the VS Code extension, not Python scripts.**

`vscode-extension/brand-manager-bridge` is the primary build target:
- **New data/API feature** → LM tool in `src/lmTools.ts` + `package.json` `languageModelTools`
- **New command** → register in `src/extension.ts`, callable from prompt files via `run_vscode_command`
- **New Copilot capability** → LM tool + schema in `package.json`, agents call it automatically

Python scripts in `scripts/` are for one-time data migration and bulk batch operations only. Interactive features, AI pipelines, and media creation belong in the extension.

The extension pattern (from `iron-static-bridge`):
```typescript
// lmTools.ts — register a new LM tool
context.subscriptions.push(
  vscode.lm.registerTool('brandManager_myTool', {
    async invoke(options, token) {
      const input = options.input as { param: string };
      // implementation
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }
  })
);
```

Add the schema to `package.json` `contributes.languageModelTools`, then run `npm run build`.

---

## Roadmap

### Phase 1 — Port from iron-static (ready to build)
The following are proven, working implementations in IRON STATIC that need to be extracted and made brand-agnostic:

- [ ] `vscode-extension/brand-manager-bridge` — fork `iron-static-bridge`, replace brand-specific context with `brand.json` reads
- [ ] Audio Recorder WebView (`audioRecorder.ts`) — works as-is, just needs brand-agnostic naming
- [ ] `voice_to_content.py` — **priority #1**; single-command pipeline: transcribe → music bed → mix (voice center) → content brief → image → video. No Ableton, no DAW.
- [ ] `mix_voice.py` — thin ffmpeg wrapper, fixed voice/bed mix ratios from `brand.json` \u2192 `audio`
- [ ] `generate_audio.py` — AI music bed generation from `brand.json` \u2192 `audio.bed_mood`; port from ACE-Step / Lyria pattern in iron-static
- [ ] `transcribe_audio.py` — Gemini speech-to-text, brand-agnostic
- [ ] Post-recording pipeline (from `velaPipeline.ts`) — restructure as voice-first: mix step runs before video render, bed volume from config
- [ ] `the-audio-producer.agent.md` — new agent persona; owns the voice \u2192 audio \u2192 video chain
- [ ] `generate_image.py` — port Imagen generation, wire to `visual-style.json`
- [ ] `generate_video.py` — port waveform visualizer + Veo + storyboard pipeline; waveform version uses voice+bed mixed audio
- [ ] `generate_content.py` — new; Gemini content generation from brand voice + content pillars

### Phase 2 — New features
- [ ] `manage_leads.py` — lead tracker with stale-follow-up detection (from FAB framework)
- [ ] `build_pitch.py` — auto-generate one-pager and deck outline from `brand.json` + `pitch/uvp.md`
- [ ] `publish_social.py` — LinkedIn + Instagram post (LinkedIn API, Instagram Graph API)
- [ ] LinkedIn OAuth publishing (currently copy-paste from generated drafts)
- [ ] Multi-brand support — run multiple brand configs from one repo instance

### Phase 3 — Intelligence layer
- [ ] Brand performance dashboard — engagement tracking from platform APIs
- [ ] AI voice model fine-tuning pipeline — build from `database/voices_training.json` (for coaches/counselors who want a consistent AI content voice trained on their own recordings)
- [ ] `weekly-content.yml` GitHub Action — fully automated weekly content queue

---

## Credits

Architecture and patterns adapted from:
- [IRON STATIC](https://github.com/djaboxx/iron-static) — AI-powered music production pipeline
- [Fractional in a Box](https://github.com/djaboxx/fractional) — 8-step fractional executive brand-building program
- [Fractional Powerhouse](https://fractionalpowerhouse.com) — Sue Mysko's FAB curriculum

---

## License

MIT — fork, adapt, use for any brand.
