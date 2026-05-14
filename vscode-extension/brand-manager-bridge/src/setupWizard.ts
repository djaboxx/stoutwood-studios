import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Homework template — brand-neutral, deployed to every new workspace
// ---------------------------------------------------------------------------
const HOMEWORK_TEMPLATE = {
  version: 1,
  description:
    "Strategic homework for the brand owner. The Strategist reviews progress, assigns the next step, and runs the AI action for any item where one is available. Items with ai_doable=true can be drafted by AI; items with ai_doable=false require the owner's lived input (interview, decision, real conversation).",
  items: [
    {
      id: "current-business-status",
      step: 1,
      title: "Complete Current Business Status Worksheet",
      category: "discovery",
      priority: "high",
      status: "not-started",
      ai_doable: false,
      ai_action: null,
      owner_action:
        "Open Current-Business-Status-Worksheet, fill in honestly. Owner-only — this is real numbers and real situation.",
      notes: "Foundation for everything that follows. AI cannot fabricate this.",
    },
    {
      id: "niche-clarity",
      step: 2,
      title: "Submit Niche Clarity Workbook",
      category: "positioning",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py niche-clarity",
      owner_action: "Review the AI draft, edit until it sounds like you, then submit.",
      notes: "AI drafts from brand.json + a short interview. Owner approves.",
    },
    {
      id: "validate-niche-demand",
      step: 2,
      title: "Define niche & validate demand",
      category: "positioning",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py validate-niche",
      owner_action: "Review demand evidence, decide go/no-go on niche.",
      notes: "AI runs market signal analysis (search trends, LinkedIn job titles, competitor scan).",
    },
    {
      id: "uvp-and-proof",
      step: 3,
      title: "Craft UVP 1-liner + 3 proof bullets",
      category: "positioning",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py uvp",
      owner_action: "Pick favorite, refine wording, paste into brand.json -> positioning.uvp.",
      notes: "AI generates 5 UVP options + proof bullets in brand voice.",
    },
    {
      id: "audience-matrix",
      step: 4,
      title: "Complete Audience Insights Matrix",
      category: "audience",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py audience-matrix",
      owner_action:
        "Validate AI draft against your real client conversations. Edit anything that doesn't match what you actually hear.",
      notes:
        "AI drafts a who/pain/desire/objection/language matrix from brand.json + audience block.",
    },
    {
      id: "message-angles",
      step: 4,
      title: "Create 3-5 core message angles",
      category: "messaging",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py message-angles",
      owner_action:
        "Pick 3-5 that ring true. AI uses these as content pillars for weekly content.",
      notes: "AI generates 8 angles, owner narrows to 3-5.",
    },
    {
      id: "one-pager",
      step: 5,
      title: "Build one-pager explaining offer",
      category: "assets",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/build_pitch.py one-pager",
      owner_action: "Review, edit if needed, send to first prospect.",
      notes: "build_pitch.py one-pager",
    },
    {
      id: "warm-outreach",
      step: 6,
      title: "Send 20+ warm outreach messages",
      category: "outreach",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py outreach-drafts --count 20",
      owner_action:
        "Review each draft, personalize the opener, send from your account.",
      notes:
        "AI drafts personalized openers from a contact list. Owner sends — no automation of the actual send.",
    },
    {
      id: "lead-tracker",
      step: 6,
      title: "Set up lead tracker & book calls",
      category: "outreach",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/manage_leads.py list",
      owner_action:
        "Add each warm contact: python scripts/manage_leads.py add --name ... etc.",
      notes: "Lead tracker is manage_leads.py. AI can populate from a CSV.",
    },
    {
      id: "offer-doc",
      step: 7,
      title: "Develop offer doc (scope, pricing, deliverables)",
      category: "assets",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py offer-doc",
      owner_action:
        "Set real prices and timelines. AI structures, owner decides numbers.",
      notes:
        "AI drafts structure from brand.json -> offers. Owner fills in actual prices.",
    },
    {
      id: "proprietary-method",
      step: 7,
      title: "Define proprietary method (visuals + bullets)",
      category: "assets",
      priority: "medium",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py proprietary-method",
      owner_action:
        "AI proposes a 3-5 step method based on how you actually work. Owner refines.",
      notes:
        "Outputs a method diagram brief — hand off to The Visual Artist for the diagram.",
    },
    {
      id: "linkedin-profile",
      step: 8,
      title: "Update LinkedIn profile & 30s pitch",
      category: "assets",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py linkedin-profile",
      owner_action:
        "Paste headline + about into LinkedIn. Practice the 30s pitch out loud.",
      notes: "AI drafts headline, about, and a 30-second spoken pitch in brand voice.",
    },
    {
      id: "lead-magnet",
      step: 8,
      title: "Create lead magnet and case study",
      category: "assets",
      priority: "medium",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py lead-magnet",
      owner_action: "Pick which case study to feature, AI structures the writeup.",
      notes:
        "Lead magnet draft + case study template. Real client details require owner.",
    },
    {
      id: "dream-100",
      step: 8,
      title: "Build Dream 100 list & outreach templates",
      category: "outreach",
      priority: "medium",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py dream-100",
      owner_action:
        "Review the 100, mark which to actually pursue. AI drafts 3 template variations per persona.",
      notes:
        "AI generates target persona profiles + 3 outreach template variants.",
    },
    {
      id: "weekly-system",
      step: 8,
      title: "Map weekly calendar, content cadence, follow-up checklist",
      category: "operations",
      priority: "high",
      status: "not-started",
      ai_doable: true,
      ai_action: "python scripts/do_homework.py weekly-system",
      owner_action:
        "Review proposed weekly cadence, adjust to your real calendar, commit to it.",
      notes:
        "AI proposes a weekly content + outreach + follow-up cadence based on offers and pillars.",
    },
  ],
};

const GITIGNORE_ADDITIONS = `
# Brand Manager — added by brand-manager-bridge extension
# Python
__pycache__/
*.py[cod]
.venv/
venv/
env/

# Credentials — NEVER commit
.env
.env.local
credentials*.json
token*.json
service-account*.json

# Audio (use cloud storage; manifests stay in database/)
audio/recordings/raw/*.wav
audio/recordings/raw/*.mp3
audio/recordings/raw/*.m4a
audio/recordings/*.wav
audio/recordings/*.mp3
audio/recordings/*.m4a
audio/recordings/*.aac
audio/recordings/*.flac
audio/generated/*.wav
audio/generated/*.mp3
audio/generated/*.m4a
audio/generated/*.aac
audio/generated/*.flac
audio/transcripts/*.txt

# Generated outputs (regenerable)
outputs/social/*.png
outputs/social/*.jpg
outputs/social/*.jpeg
outputs/social/*.webp
outputs/social/*.heic
outputs/social/*.heif
outputs/social/*.mp4
outputs/social/*.mov

# Lead PII — tracked locally only
database/leads.json

# OS
.DS_Store
Thumbs.db
`;

const ENV_EXAMPLE = `# Brand Manager — environment variables
# Copy this file to .env and fill in your values.
# .env is gitignored — never commit real keys.

# ── AI (required for core features) ──────────────────────────────────────────
GEMINI_API_KEY=your-gemini-api-key-here

# ── Google Cloud (optional — unlocks Imagen 4, Lyria 2 music, Veo video) ─────
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# ── Platform credentials (analytics read-only + Google Drive sync) ────────────
# Recommended: manage these via the VS Code Command Palette →
#   "Brand Manager: Manage Platform Credentials"
# They are stored in VS Code's encrypted SecretStorage (never on disk).
# Only fill these in below if you need to run scripts from the CLI.

# Google Drive sync
# GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=<paste full contents of service-account.json>
# GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id

# YouTube analytics (read-only, YouTube Data API v3)
# YOUTUBE_API_KEY=your-youtube-api-v3-key
# YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxx

# LinkedIn analytics (read-only)
# LINKEDIN_ACCESS_TOKEN=your-oauth2-access-token
# LINKEDIN_PERSON_URN=urn:li:person:xxxxx

# Instagram insights (read-only)
# INSTAGRAM_ACCESS_TOKEN=your-long-lived-page-access-token
# INSTAGRAM_ACCOUNT_ID=123456789

# Email — Mailchimp
# MAILCHIMP_API_KEY=your-mailchimp-api-key
# MAILCHIMP_SERVER_PREFIX=us14

# Email — ConvertKit / Kit
# CONVERTKIT_API_KEY=your-convertkit-api-key

# Email — Beehiiv
# BEEHIIV_API_KEY=your-beehiiv-api-key
# BEEHIIV_PUBLICATION_ID=your-publication-id
`;

// ---------------------------------------------------------------------------
// Data builders
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function parseList(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildBrandJson(d: any): object {
  const primaryPlatforms: string[] = [];
  const secondaryPlatforms: string[] = [];
  const postingFrequency: Record<string, string> = {};

  for (const p of d.platforms ?? []) {
    if (p.checked) {
      (p.primary ? primaryPlatforms : secondaryPlatforms).push(p.name);
      if (p.frequency) {
        postingFrequency[p.name] = p.frequency;
      }
    }
  }

  return {
    brand: {
      slug: slugify(d.brandName ?? 'my-brand'),
      name: d.brandName ?? '',
      tagline: d.tagline ?? '',
      owner: d.ownerName ?? '',
      niche: d.niche ?? '',
      stage: d.stage ?? 'launch',
    },
    positioning: {
      uvp: d.uvp ?? '',
      target_audience: {
        who: d.audienceWho ?? '',
        pain: d.audiencePain ?? '',
        desire: d.audienceDesire ?? '',
      },
      differentiators: parseList(d.differentiators ?? ''),
      competitors: d.competitors ?? '',
    },
    voice: {
      tone: d.tone ?? '',
      vocabulary: parseList(d.vocabulary ?? ''),
      avoid: parseList(d.avoid ?? ''),
      persona: d.persona ?? '',
    },
    audio: {
      bed_mood: d.bedMood || 'calm, ambient, minimal, warm — no drums, no percussion, no vocals',
      bed_volume: 0.35,
      voice_volume: 1.0,
      sample_rate: 48000,
      format: 'wav',
      note: "Voice is always the primary signal. The bed is background texture only.",
    },
    platforms: {
      primary: primaryPlatforms,
      secondary: secondaryPlatforms,
      posting_frequency: postingFrequency,
    },
    content_pillars: (d.pillars ?? []).map((p: any) => ({
      name: slugify(p.name ?? ''),
      description: p.description ?? '',
    })),
    offer: {
      services: (d.services ?? []).map((s: any) => ({
        name: s.name ?? '',
        format: s.format ?? '',
        price_range: s.priceRange ?? '',
        ideal_client: s.idealClient ?? '',
      })),
      lead_magnet: d.leadMagnet ?? '',
    },
  };
}

function buildVisualStyleJson(d: any): object {
  return {
    palette: {
      background: d.bgColor || '#f5f0eb',
      primary: d.primaryColor || '#2a2a2a',
      accent: d.accentColor || '#c9a96e',
      text: d.textColor || '#2a2a2a',
      text_muted: d.textMutedColor || '#5a5a5a',
    },
    aesthetic: d.aesthetic || 'Minimal, warm, natural light.',
    imagery_vocabulary: parseList(d.imageryWords ?? ''),
    composition_rules: parseList(d.compositionRules ?? '').length
      ? parseList(d.compositionRules)
      : [
          'Generous negative space — never crowd the frame',
          'Single focal point',
          'Natural light preferred',
          'Color palette stays within the brand range',
        ],
    prohibition: d.prohibition || '',
    people_policy: d.peoplePolicy || 'Faces are optional. When a person appears, they may be partial — hands, silhouette, or gesture.',
    video: {
      transitions: 'Slow crossfades only.',
      motion: 'Gentle parallax, slow zoom. No quick pans.',
      text_overlays: 'Sparse. Single words or short phrases.',
    },
  };
}

// ---------------------------------------------------------------------------
// Workspace scaffolder
// ---------------------------------------------------------------------------

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(p: string, obj: object): void {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function writeText(p: string, text: string): void {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, text, 'utf-8');
}

function appendGitignore(root: string): void {
  const gi = path.join(root, '.gitignore');
  const existing = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf-8') : '';
  if (!existing.includes('Brand Manager')) {
    fs.writeFileSync(gi, existing + GITIGNORE_ADDITIONS, 'utf-8');
  }
}

export function scaffoldWorkspace(workspaceRoot: string, data: any): string[] {
  const created: string[] = [];
  const w = (rel: string) => path.join(workspaceRoot, rel);

  // Directories
  const dirs = [
    'audio/recordings/raw',
    'audio/recordings',
    'audio/generated',
    'audio/transcripts',
    'audio/references',
    'content/briefs',
    'content/posts',
    'content/homework',
    'content/meetings',
    'database',
    'outputs/social',
    'pitch',
  ];
  for (const d of dirs) {
    ensureDir(w(d));
  }

  // brand.json
  writeJson(w('database/brand.json'), buildBrandJson(data));
  created.push('database/brand.json');

  // visual-style.json
  writeJson(w('database/visual-style.json'), buildVisualStyleJson(data));
  created.push('database/visual-style.json');

  // homework.json — fresh template, all items not-started
  writeJson(w('database/homework.json'), HOMEWORK_TEMPLATE);
  created.push('database/homework.json');

  // content-calendar.json
  if (!fs.existsSync(w('database/content-calendar.json'))) {
    writeJson(w('database/content-calendar.json'), { schema_version: 1, entries: [] });
    created.push('database/content-calendar.json');
  }

  // .env.example
  writeText(w('.env.example'), ENV_EXAMPLE);
  created.push('.env.example');

  // .env (only if API key was provided, don't overwrite existing)
  if (data.geminiApiKey && !fs.existsSync(w('.env'))) {
    const envContent =
      `GEMINI_API_KEY=${data.geminiApiKey}\n` +
      (data.gcpProject ? `GOOGLE_CLOUD_PROJECT=${data.gcpProject}\n` : '') +
      `GOOGLE_CLOUD_REGION=us-central1\n`;
    writeText(w('.env'), envContent);
    created.push('.env  (gitignored — contains your API key)');
  }

  // .gitignore
  appendGitignore(workspaceRoot);
  created.push('.gitignore  (updated)');

  return created;
}

// ---------------------------------------------------------------------------
// Nonce helper
// ---------------------------------------------------------------------------

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// ---------------------------------------------------------------------------
// Wizard HTML
// ---------------------------------------------------------------------------

function getWizardHtml(nonce: string): string {
  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      max-width: 760px;
    }
    h1 { font-size: 1.3em; font-weight: 600; margin-bottom: 4px; }
    h2 { font-size: 1.05em; font-weight: 600; margin-bottom: 16px; color: var(--vscode-foreground); }
    p, .hint { font-size: 0.88em; color: var(--vscode-descriptionForeground); margin-bottom: 12px; line-height: 1.5; }
    .progress-bar { display: flex; gap: 4px; margin-bottom: 24px; }
    .progress-bar .seg {
      height: 4px; flex: 1; border-radius: 2px;
      background: var(--vscode-input-border);
      transition: background 0.2s;
    }
    .progress-bar .seg.done { background: var(--vscode-button-background); }
    .progress-bar .seg.active { background: var(--vscode-focusBorder); }
    label { display: block; font-size: 0.88em; color: var(--vscode-foreground); margin-bottom: 4px; font-weight: 500; }
    .required::after { content: ' *'; color: var(--vscode-editorError-foreground); }
    input[type="text"], input[type="password"], input[type="color"],
    textarea, select {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 8px;
      font-family: inherit;
      font-size: inherit;
      margin-bottom: 14px;
    }
    input[type="color"] { padding: 2px 4px; height: 30px; cursor: pointer; }
    textarea { min-height: 70px; resize: vertical; }
    .row { display: flex; gap: 12px; }
    .row > * { flex: 1; }
    .col-half { flex: 0 0 calc(50% - 6px) !important; }
    .field-group { margin-bottom: 8px; }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 7px 16px;
      cursor: pointer;
      font-size: 0.9em;
      font-family: inherit;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.small { padding: 4px 10px; font-size: 0.82em; }
    button.danger { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); }
    .nav { display: flex; gap: 10px; margin-top: 24px; align-items: center; }
    .nav .step-label { font-size: 0.82em; color: var(--vscode-descriptionForeground); margin-left: auto; }
    .step { display: none; }
    .step.active { display: block; }
    .card {
      border: 1px solid var(--vscode-panel-border);
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 3px;
      position: relative;
    }
    .card .remove-btn {
      position: absolute;
      top: 8px; right: 8px;
      padding: 2px 8px;
      font-size: 0.78em;
    }
    .platform-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    .platform-item { display: flex; align-items: center; gap: 6px; font-size: 0.88em; }
    .platform-item input[type="checkbox"] { width: auto; margin: 0; }
    .freq-row { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; margin-bottom: 6px; font-size: 0.85em; }
    .freq-row input { margin-bottom: 0; }
    .color-row { display: grid; grid-template-columns: 40px 1fr; gap: 8px; align-items: center; margin-bottom: 10px; }
    .color-row input[type="color"] { width: 40px; margin: 0; }
    .color-row input[type="text"] { margin-bottom: 0; }
    .info-box {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 0.88em;
      line-height: 1.6;
    }
    .success-box {
      background: color-mix(in srgb, var(--vscode-charts-green) 12%, transparent);
      border: 1px solid var(--vscode-charts-green);
      padding: 14px;
      margin-bottom: 16px;
    }
    .success-box h3 { color: var(--vscode-charts-green); margin-bottom: 8px; }
    .success-box ul { padding-left: 18px; font-size: 0.88em; line-height: 1.8; }
    .error-box {
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 0.88em;
    }
    .review-section { margin-bottom: 14px; }
    .review-section h3 { font-size: 0.9em; font-weight: 600; margin-bottom: 6px; color: var(--vscode-foreground); }
    .review-kv { display: grid; grid-template-columns: 160px 1fr; gap: 4px 12px; font-size: 0.85em; margin-bottom: 4px; }
    .review-kv .key { color: var(--vscode-descriptionForeground); }
    .review-kv .val { color: var(--vscode-foreground); }
    .pill {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 7px;
      border-radius: 10px;
      font-size: 0.8em;
      margin: 1px;
    }
    #status-msg { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>

<div class="progress-bar" id="progress-bar"></div>

<!-- STEP 1: Welcome -->
<div class="step active" id="step-1">
  <h1>Brand Setup Wizard</h1>
  <p style="margin-top:8px;">This wizard captures your brand DNA and scaffolds a ready-to-use workspace.<br>
  By the end, Copilot agents can start generating content, strategy, and pitch assets.</p>

  <div class="info-box" style="margin-top:16px;">
    <strong>What gets created:</strong><br>
    <code>database/brand.json</code> — voice, positioning, audience, platforms, offers<br>
    <code>database/visual-style.json</code> — palette, aesthetic, composition rules<br>
    <code>database/homework.json</code> — 8-step strategic roadmap, ready to execute<br>
    <code>.env</code> — your API keys (gitignored)<br>
    Directory scaffold: <code>audio/</code>, <code>content/</code>, <code>outputs/</code>, <code>pitch/</code>
  </div>
  <p>The whole walkthrough takes about 10 minutes. Every field can be edited afterwards in <code>database/brand.json</code>.</p>
</div>

<!-- STEP 2: Brand Identity -->
<div class="step" id="step-2">
  <h2>Brand Identity</h2>
  <p>The basics. These power file naming, headlines, and how the AI refers to your brand.</p>

  <label class="required" for="brandName">Brand / Business Name</label>
  <input type="text" id="brandName" placeholder="e.g. Stoutwood Studios" />

  <label class="required" for="ownerName">Your Name</label>
  <input type="text" id="ownerName" placeholder="e.g. Dave Arnold" />

  <label for="tagline">Tagline <span class="hint" style="display:inline;">(one line, optional)</span></label>
  <input type="text" id="tagline" placeholder="e.g. Handcrafted furniture for spaces that last a lifetime" />

  <label class="required" for="niche">Niche / What You Do</label>
  <input type="text" id="niche" placeholder="e.g. custom woodworking, fractional CFO, executive coaching" />

  <label for="stage">Current Stage</label>
  <select id="stage">
    <option value="idea">Idea — not launched yet</option>
    <option value="launch" selected>Launch — early clients, building presence</option>
    <option value="growth">Growth — consistent revenue, scaling</option>
    <option value="scale">Scale — established, optimizing</option>
  </select>
</div>

<!-- STEP 3: Audience & Positioning -->
<div class="step" id="step-3">
  <h2>Audience & Positioning</h2>
  <p>Who you serve and why you're the right fit. The more specific, the better the AI output.</p>

  <label class="required" for="audienceWho">Who is your audience?</label>
  <input type="text" id="audienceWho" placeholder="e.g. homeowners renovating a forever home, 35–55, values craft over speed" />

  <label class="required" for="audiencePain">What is their main pain or frustration?</label>
  <textarea id="audiencePain" placeholder="e.g. Tired of mass-produced furniture that falls apart. Want something unique that reflects who they are, but don't know where to start with a custom maker."></textarea>

  <label class="required" for="audienceDesire">What do they actually want?</label>
  <textarea id="audienceDesire" placeholder="e.g. A piece they'll pass down — something with a story, made by a real person who understood what they wanted."></textarea>

  <label for="uvp">Your UVP 1-liner <span class="hint" style="display:inline;">(leave blank to AI-draft later)</span></label>
  <textarea id="uvp" style="min-height:50px;" placeholder="e.g. I help families build heirloom-quality furniture by combining traditional joinery with modern design — because mass production can't make something that lasts 100 years."></textarea>

  <label for="differentiators">What makes you different? <span class="hint" style="display:inline;">(one per line or comma-separated)</span></label>
  <textarea id="differentiators" placeholder="e.g. 20+ years of traditional joinery training, Only use locally-sourced hardwood, Small batch — 12 pieces per year"></textarea>

  <label for="competitors">Who do customers consider instead of you?</label>
  <input type="text" id="competitors" placeholder="e.g. IKEA, local cabinet shops, big-box custom furniture retailers" />
</div>

<!-- STEP 4: Voice & Tone -->
<div class="step" id="step-4">
  <h2>Voice & Tone</h2>
  <p>How your brand speaks. This is used in every AI-generated caption, email, and pitch.</p>

  <label class="required" for="tone">Tone descriptors <span class="hint" style="display:inline;">(comma-separated)</span></label>
  <input type="text" id="tone" placeholder="e.g. warm, direct, craftsman-proud, approachable, unhurried" />

  <label for="vocabulary">Vocabulary to use <span class="hint" style="display:inline;">(words that feel right)</span></label>
  <input type="text" id="vocabulary" placeholder="e.g. craft, heirloom, grain, joinery, honest, enduring" />

  <label for="avoid">Words to avoid</label>
  <input type="text" id="avoid" placeholder="e.g. luxury, premium, bespoke, artisanal, curated" />

  <label class="required" for="persona">Brand persona <span class="hint" style="display:inline;">(describe the voice in 1-2 sentences)</span></label>
  <textarea id="persona" placeholder="e.g. The master woodworker down the street who will shoot straight with you about what wood to use, what will hold up, and what's worth the investment."></textarea>

  <label for="bedMood">Music bed mood <span class="hint" style="display:inline;">(for AI-generated audio backgrounds)</span></label>
  <input type="text" id="bedMood" placeholder="e.g. warm, acoustic, slow-moving, no percussion, no vocals" />
</div>

<!-- STEP 5: Platforms -->
<div class="step" id="step-5">
  <h2>Platforms</h2>
  <p>Where you publish. Check every platform you plan to use — even aspirationally. Frequency guides the content engine.</p>

  <div class="platform-grid" id="platform-grid">
    <!-- Populated by JS -->
  </div>

  <div id="freq-inputs" style="margin-top:4px;"></div>
</div>

<!-- STEP 6: Content Pillars -->
<div class="step" id="step-6">
  <h2>Content Pillars</h2>
  <p>2–5 recurring topics that anchor all your content. Each pillar becomes a category the AI writes from.</p>

  <div id="pillars-container"></div>
  <button class="secondary small" id="add-pillar" style="margin-top:4px;">+ Add pillar</button>
</div>

<!-- STEP 7: Services & Offers -->
<div class="step" id="step-7">
  <h2>Services & Offers</h2>
  <p>What you sell. The AI uses this for pitch assets, one-pagers, and content angles.</p>

  <div id="services-container"></div>
  <button class="secondary small" id="add-service" style="margin-top:4px;">+ Add service</button>

  <div style="margin-top:16px;">
    <label for="leadMagnet">Lead magnet description <span class="hint" style="display:inline;">(optional)</span></label>
    <input type="text" id="leadMagnet" placeholder="e.g. Free guide: 5 questions to ask before hiring a custom furniture maker" />
  </div>
</div>

<!-- STEP 8: Visual Style -->
<div class="step" id="step-8">
  <h2>Visual Style</h2>
  <p>Colors and aesthetic used for AI image and video generation.</p>

  <div class="row">
    <div>
      <label>Background</label>
      <div class="color-row">
        <input type="color" id="bgColor" value="#f5f0eb" />
        <input type="text" id="bgColorHex" value="#f5f0eb" maxlength="7" />
      </div>
    </div>
    <div>
      <label>Primary (text / main)</label>
      <div class="color-row">
        <input type="color" id="primaryColor" value="#2a2a2a" />
        <input type="text" id="primaryColorHex" value="#2a2a2a" maxlength="7" />
      </div>
    </div>
    <div>
      <label>Accent</label>
      <div class="color-row">
        <input type="color" id="accentColor" value="#c9a96e" />
        <input type="text" id="accentColorHex" value="#c9a96e" maxlength="7" />
      </div>
    </div>
  </div>

  <label class="required" for="aesthetic">Aesthetic in one sentence</label>
  <textarea id="aesthetic" style="min-height:50px;" placeholder="e.g. Warm, tactile imagery — raw wood grain, natural light, no gloss, no perfection."></textarea>

  <label for="imageryWords">Imagery vocabulary <span class="hint" style="display:inline;">(comma-separated words that describe your visuals)</span></label>
  <textarea id="imageryWords" style="min-height:50px;" placeholder="e.g. natural light, wood grain, hand tools, sawdust, weathered surfaces, still life, close-ups of joints"></textarea>

  <label for="prohibition">Visual prohibitions <span class="hint" style="display:inline;">(what to never put in images)</span></label>
  <input type="text" id="prohibition" placeholder="e.g. stock photo smiles, white glove luxury staging, harsh studio lighting" />
</div>

<!-- STEP 9: API Keys -->
<div class="step" id="step-9">
  <h2>API Keys</h2>

  <div class="info-box">
    Keys are written to <code>.env</code> in your workspace — <strong>gitignored, never committed</strong>.<br>
    Only <code>GEMINI_API_KEY</code> is required for core features (transcription, content, strategy).<br>
    Google Cloud credentials unlock Imagen 4 images, Lyria 2 music beds, and Veo video.
  </div>

  <label class="required" for="geminiApiKey">Gemini API Key</label>
  <input type="password" id="geminiApiKey" placeholder="Get one free at aistudio.google.com" autocomplete="off" />
  <p style="margin-top:-8px;">Used for: transcription, content generation, strategy drafts, meeting analysis.</p>

  <label for="gcpProject">Google Cloud Project ID <span class="hint" style="display:inline;">(optional)</span></label>
  <input type="text" id="gcpProject" placeholder="e.g. my-project-123456" />
  <p style="margin-top:-8px;">Optional: unlocks Imagen 4 (images), Lyria 2 (music beds), and Veo (video).</p>

  <p>You can skip keys now and add them to <code>.env</code> later. The setup will still scaffold everything.</p>
</div>

<!-- STEP 10: Review & Create -->
<div class="step" id="step-10">
  <h2>Review & Create</h2>
  <p>Everything looks correct? Click <strong>Create Brand Files</strong> to scaffold your workspace.</p>
  <div id="review-content"></div>
  <div id="result-area"></div>
</div>

<!-- Navigation -->
<div class="nav">
  <button class="secondary" id="btn-back" style="display:none;">← Back</button>
  <button id="btn-next">Get Started →</button>
  <span class="step-label" id="step-label"></span>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const TOTAL_STEPS = 10;
let currentStep = 1;

const PLATFORM_LIST = [
  { name: 'instagram', label: 'Instagram' },
  { name: 'linkedin', label: 'LinkedIn' },
  { name: 'youtube', label: 'YouTube' },
  { name: 'tiktok', label: 'TikTok' },
  { name: 'email', label: 'Email newsletter' },
  { name: 'podcast', label: 'Podcast' },
  { name: 'twitter', label: 'X / Twitter' },
  { name: 'facebook', label: 'Facebook' },
  { name: 'threads', label: 'Threads' },
];

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
const progressBar = document.getElementById('progress-bar');
for (let i = 1; i <= TOTAL_STEPS; i++) {
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.id = 'seg-' + i;
  progressBar.appendChild(seg);
}

function updateProgress() {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const seg = document.getElementById('seg-' + i);
    seg.className = 'seg' + (i < currentStep ? ' done' : i === currentStep ? ' active' : '');
  }
  const label = document.getElementById('step-label');
  label.textContent = 'Step ' + currentStep + ' of ' + TOTAL_STEPS;
}

// ---------------------------------------------------------------------------
// Platform grid
// ---------------------------------------------------------------------------
function buildPlatformGrid() {
  const grid = document.getElementById('platform-grid');
  grid.innerHTML = '';
  for (const p of PLATFORM_LIST) {
    const item = document.createElement('div');
    item.className = 'platform-item';
    item.innerHTML =
      '<input type="checkbox" id="plat-' + p.name + '" value="' + p.name + '" onchange="updateFreqInputs()"> ' +
      '<label for="plat-' + p.name + '" style="margin:0;font-weight:normal;">' + p.label + '</label>';
    grid.appendChild(item);
  }
}

function updateFreqInputs() {
  const container = document.getElementById('freq-inputs');
  container.innerHTML = '';
  const checked = PLATFORM_LIST.filter(p => document.getElementById('plat-' + p.name)?.checked);
  if (checked.length === 0) return;
  const h = document.createElement('p');
  h.style.marginBottom = '8px';
  h.textContent = 'Posting frequency per platform:';
  container.appendChild(h);
  for (const p of checked) {
    const row = document.createElement('div');
    row.className = 'freq-row';
    row.innerHTML =
      '<span>' + p.label + '</span>' +
      '<input type="text" id="freq-' + p.name + '" placeholder="e.g. 3x per week" style="margin:0;" />';
    container.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Dynamic lists: pillars
// ---------------------------------------------------------------------------
let pillarCount = 0;

function addPillar(name = '', desc = '') {
  pillarCount++;
  const id = pillarCount;
  const c = document.getElementById('pillars-container');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'pillar-card-' + id;
  card.innerHTML =
    '<button class="secondary small remove-btn" onclick="removePillar(' + id + ')">Remove</button>' +
    '<label for="pillar-name-' + id + '">Pillar name <span class="hint" style="display:inline;">(short slug, e.g. process-stories)</span></label>' +
    '<input type="text" id="pillar-name-' + id + '" value="' + escHtml(name) + '" placeholder="e.g. process-stories" />' +
    '<label for="pillar-desc-' + id + '">Description</label>' +
    '<textarea id="pillar-desc-' + id + '" placeholder="What this pillar is about and why it matters to your audience...">' + escHtml(desc) + '</textarea>';
  c.appendChild(card);
}

function removePillar(id) {
  document.getElementById('pillar-card-' + id)?.remove();
}

// ---------------------------------------------------------------------------
// Dynamic lists: services
// ---------------------------------------------------------------------------
let serviceCount = 0;

function addService(name = '', fmt = '', price = '', client = '') {
  serviceCount++;
  const id = serviceCount;
  const c = document.getElementById('services-container');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'service-card-' + id;
  card.innerHTML =
    '<button class="secondary small remove-btn" onclick="removeService(' + id + ')">Remove</button>' +
    '<div class="row">' +
    '  <div><label for="svc-name-' + id + '">Service name</label><input type="text" id="svc-name-' + id + '" value="' + escHtml(name) + '" placeholder="e.g. 1:1 Custom Build" /></div>' +
    '  <div><label for="svc-fmt-' + id + '">Format</label><input type="text" id="svc-fmt-' + id + '" value="' + escHtml(fmt) + '" placeholder="e.g. 8-week design + build" /></div>' +
    '</div>' +
    '<div class="row">' +
    '  <div><label for="svc-price-' + id + '">Price range</label><input type="text" id="svc-price-' + id + '" value="' + escHtml(price) + '" placeholder="e.g. $3,000–$8,000" /></div>' +
    '  <div><label for="svc-client-' + id + '">Ideal client</label><input type="text" id="svc-client-' + id + '" value="' + escHtml(client) + '" placeholder="e.g. homeowner with a clear vision" /></div>' +
    '</div>';
  c.appendChild(card);
}

function removeService(id) {
  document.getElementById('service-card-' + id)?.remove();
}

// ---------------------------------------------------------------------------
// Color sync
// ---------------------------------------------------------------------------
function syncColor(pickerEl, hexEl) {
  document.getElementById(pickerEl).addEventListener('input', function() {
    document.getElementById(hexEl).value = this.value;
  });
  document.getElementById(hexEl).addEventListener('input', function() {
    if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
      document.getElementById(pickerEl).value = this.value;
    }
  });
}

// ---------------------------------------------------------------------------
// Review page
// ---------------------------------------------------------------------------
function buildReview() {
  const data = collectData();
  const el = document.getElementById('review-content');
  
  function kv(key, val) {
    if (!val) return '';
    return '<div class="review-kv"><span class="key">' + escHtml(key) + '</span><span class="val">' + escHtml(String(val)) + '</span></div>';
  }
  function pills(arr) {
    if (!arr || !arr.length) return '<span class="hint">—</span>';
    return arr.map(v => '<span class="pill">' + escHtml(v) + '</span>').join(' ');
  }

  const checked = PLATFORM_LIST.filter(p => document.getElementById('plat-' + p.name)?.checked);
  const pillars = collectPillars();
  const services = collectServices();

  el.innerHTML =
    '<div class="review-section"><h3>Brand Identity</h3>' +
    kv('Name', data.brandName) + kv('Owner', data.ownerName) +
    kv('Tagline', data.tagline) + kv('Niche', data.niche) + kv('Stage', data.stage) + '</div>' +

    '<div class="review-section"><h3>Audience</h3>' +
    kv('Who', data.audienceWho) + kv('Pain', data.audiencePain) + kv('Desire', data.audienceDesire) + '</div>' +

    '<div class="review-section"><h3>Voice</h3>' +
    kv('Tone', data.tone) +
    '<div class="review-kv"><span class="key">Vocabulary</span><span class="val">' + pills(data.vocabulary?.split(',').map(s=>s.trim()).filter(Boolean)) + '</span></div>' +
    '<div class="review-kv"><span class="key">Avoid</span><span class="val">' + pills(data.avoid?.split(',').map(s=>s.trim()).filter(Boolean)) + '</span></div>' + '</div>' +

    '<div class="review-section"><h3>Platforms</h3>' +
    '<div class="review-kv"><span class="key">Active</span><span class="val">' + pills(checked.map(p=>p.label)) + '</span></div>' + '</div>' +

    '<div class="review-section"><h3>Content Pillars (' + pillars.length + ')</h3>' +
    pillars.map(p => kv(p.name, p.description)).join('') + '</div>' +

    '<div class="review-section"><h3>Services (' + services.length + ')</h3>' +
    services.map(s => kv(s.name, (s.format ? s.format + ' · ' : '') + (s.priceRange || ''))).join('') + '</div>' +

    '<div class="review-section"><h3>API Keys</h3>' +
    kv('Gemini key', data.geminiApiKey ? '●●●●●●●●' : '(not set — add to .env later)') +
    kv('GCP Project', data.gcpProject || '(not set)') + '</div>';
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------
function val(id) { return (document.getElementById(id)?.value || '').trim(); }

function collectPillars() {
  const result = [];
  document.querySelectorAll('[id^="pillar-card-"]').forEach(card => {
    const id = card.id.replace('pillar-card-', '');
    const name = val('pillar-name-' + id);
    const desc = val('pillar-desc-' + id);
    if (name) result.push({ name, description: desc });
  });
  return result;
}

function collectServices() {
  const result = [];
  document.querySelectorAll('[id^="service-card-"]').forEach(card => {
    const id = card.id.replace('service-card-', '');
    const name = val('svc-name-' + id);
    if (name) result.push({
      name,
      format: val('svc-fmt-' + id),
      priceRange: val('svc-price-' + id),
      idealClient: val('svc-client-' + id),
    });
  });
  return result;
}

function collectData() {
  const platforms = PLATFORM_LIST.map(p => {
    const checked = document.getElementById('plat-' + p.name)?.checked ?? false;
    return {
      name: p.name,
      label: p.label,
      checked,
      primary: checked,
      frequency: checked ? val('freq-' + p.name) : '',
    };
  });

  return {
    brandName: val('brandName'),
    ownerName: val('ownerName'),
    tagline: val('tagline'),
    niche: val('niche'),
    stage: document.getElementById('stage')?.value || 'launch',
    audienceWho: val('audienceWho'),
    audiencePain: val('audiencePain'),
    audienceDesire: val('audienceDesire'),
    uvp: val('uvp'),
    differentiators: val('differentiators'),
    competitors: val('competitors'),
    tone: val('tone'),
    vocabulary: val('vocabulary'),
    avoid: val('avoid'),
    persona: val('persona'),
    bedMood: val('bedMood'),
    platforms,
    pillars: collectPillars(),
    services: collectServices(),
    leadMagnet: val('leadMagnet'),
    bgColor: val('bgColorHex') || document.getElementById('bgColor')?.value || '#f5f0eb',
    primaryColor: val('primaryColorHex') || document.getElementById('primaryColor')?.value || '#2a2a2a',
    accentColor: val('accentColorHex') || document.getElementById('accentColor')?.value || '#c9a96e',
    textColor: val('primaryColorHex') || '#2a2a2a',
    textMutedColor: '#5a5a5a',
    aesthetic: val('aesthetic'),
    imageryWords: val('imageryWords'),
    compositionRules: '',
    prohibition: val('prohibition'),
    peoplePolicy: '',
    geminiApiKey: val('geminiApiKey'),
    gcpProject: val('gcpProject'),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate(step) {
  if (step === 2) {
    if (!val('brandName')) { alert('Brand name is required.'); return false; }
    if (!val('ownerName')) { alert('Owner name is required.'); return false; }
    if (!val('niche')) { alert('Niche is required.'); return false; }
  }
  if (step === 3) {
    if (!val('audienceWho')) { alert('Audience description is required.'); return false; }
    if (!val('audiencePain')) { alert('Audience pain is required.'); return false; }
    if (!val('audienceDesire')) { alert('Audience desire is required.'); return false; }
  }
  if (step === 4) {
    if (!val('tone')) { alert('Tone is required.'); return false; }
    if (!val('persona')) { alert('Persona is required.'); return false; }
  }
  if (step === 6) {
    const pillars = collectPillars();
    if (pillars.length < 1) { alert('Add at least one content pillar.'); return false; }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  document.getElementById('btn-back').style.display = n === 1 ? 'none' : '';
  const btnNext = document.getElementById('btn-next');

  if (n === 1) {
    btnNext.textContent = 'Get Started →';
  } else if (n === TOTAL_STEPS) {
    buildReview();
    btnNext.textContent = 'Create Brand Files';
  } else {
    btnNext.textContent = 'Next →';
  }

  updateProgress();
  window.scrollTo(0, 0);
}

document.getElementById('btn-next').addEventListener('click', () => {
  if (!validate(currentStep)) return;

  if (currentStep === TOTAL_STEPS) {
    const data = collectData();
    document.getElementById('btn-next').disabled = true;
    document.getElementById('btn-next').textContent = 'Creating…';
    document.getElementById('result-area').innerHTML = '';
    vscode.postMessage({ type: 'create', data });
    return;
  }
  currentStep++;
  showStep(currentStep);
});

document.getElementById('btn-back').addEventListener('click', () => {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
});

// ---------------------------------------------------------------------------
// Messages from extension
// ---------------------------------------------------------------------------
window.addEventListener('message', event => {
  const msg = event.data;
  const btn = document.getElementById('btn-next');

  if (msg.type === 'created') {
    btn.disabled = false;
    btn.textContent = 'Done ✓';
    btn.disabled = true;
    document.getElementById('result-area').innerHTML =
      '<div class="success-box">' +
      '<h3>Brand workspace created!</h3>' +
      '<ul>' + msg.files.map(f => '<li>' + escHtml(f) + '</li>').join('') + '</ul>' +
      '<p style="margin-top:10px;">Open <strong>Copilot Chat</strong> and try:<br>' +
      '<code>@workspace /homework</code> — review your strategic roadmap<br>' +
      '<code>@workspace /session-start</code> — what to work on today<br>' +
      '<code>@workspace /weekly-content</code> — draft a week of posts</p>' +
      '</div>';
  }

  if (msg.type === 'error') {
    btn.disabled = false;
    btn.textContent = 'Create Brand Files';
    document.getElementById('result-area').innerHTML =
      '<div class="error-box">Error: ' + escHtml(msg.message) + '</div>';
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
buildPlatformGrid();
addPillar();
addService();
syncColor('bgColor', 'bgColorHex');
syncColor('primaryColor', 'primaryColorHex');
syncColor('accentColor', 'accentColorHex');
document.getElementById('add-pillar').addEventListener('click', () => addPillar());
document.getElementById('add-service').addEventListener('click', () => addService());
showStep(1);
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function openSetupWizard(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): void {
  const panel = vscode.window.createWebviewPanel(
    'brandSetupWizard',
    'Brand Manager Setup',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  const nonce = getNonce();
  panel.webview.html = getWizardHtml(nonce);

  panel.webview.onDidReceiveMessage(
    async (msg) => {
      if (msg.type === 'create') {
        try {
          const files = scaffoldWorkspace(workspaceRoot, msg.data);
          panel.webview.postMessage({ type: 'created', files });
          vscode.window.showInformationMessage(
            `Brand workspace for "${msg.data.brandName}" created. Open Copilot Chat to start.`
          );
        } catch (e) {
          panel.webview.postMessage({ type: 'error', message: String(e) });
        }
      }
    },
    undefined,
    context.subscriptions
  );
}
