import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Platform registry
// ---------------------------------------------------------------------------

export interface CredField {
  key: string;       // env var name injected into Python subprocesses
  label: string;
  type: 'text' | 'password';
  required: boolean;
  hint: string;
}

export interface Platform {
  id: string;
  name: string;
  description: string;
  analyticsNote: string;
  docsUrl: string;
  fields: CredField[];
}

export const PLATFORMS: Platform[] = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Sync all generated content, audio, and pitch assets to a shared Drive folder.',
    analyticsNote: 'Content sync only — not an analytics source.',
    docsUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
    fields: [
      {
        key: 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON',
        label: 'Service Account JSON',
        type: 'password',
        required: true,
        hint: 'Paste the full contents of your service-account-key.json. Stored securely in VS Code — never written to disk.',
      },
      {
        key: 'GOOGLE_DRIVE_FOLDER_ID',
        label: 'Drive Folder ID',
        type: 'text',
        required: true,
        hint: 'The ID at the end of the folder URL: drive.google.com/drive/folders/<FOLDER_ID>',
      },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Track video views, watch time, impressions, and audience retention.',
    analyticsNote: 'Read-only via YouTube Data API v3. No posting.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      {
        key: 'YOUTUBE_API_KEY',
        label: 'YouTube Data API v3 Key',
        type: 'password',
        required: true,
        hint: 'Create a restricted API key in Google Cloud Console with YouTube Data API v3 enabled.',
      },
      {
        key: 'YOUTUBE_CHANNEL_ID',
        label: 'Channel ID',
        type: 'text',
        required: false,
        hint: 'Your channel ID (e.g. UCxxxxxxxx). Found at youtube.com/account_advanced.',
      },
    ],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Track post impressions, engagement rate, and follower growth.',
    analyticsNote: 'Read-only via LinkedIn Marketing API. No posting.',
    docsUrl: 'https://www.linkedin.com/developers/apps',
    fields: [
      {
        key: 'LINKEDIN_ACCESS_TOKEN',
        label: 'OAuth2 Access Token',
        type: 'password',
        required: true,
        hint: 'Long-lived access token with r_organization_social and r_analytics_adminreports permissions.',
      },
      {
        key: 'LINKEDIN_PERSON_URN',
        label: 'Person or Organization URN',
        type: 'text',
        required: false,
        hint: 'e.g. urn:li:person:ABC123 or urn:li:organization:12345',
      },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Track reach, impressions, and engagement on posts and stories.',
    analyticsNote: 'Read-only via Meta Graph API Insights. No posting.',
    docsUrl: 'https://developers.facebook.com/apps',
    fields: [
      {
        key: 'INSTAGRAM_ACCESS_TOKEN',
        label: 'Long-lived Page Access Token',
        type: 'password',
        required: true,
        hint: 'Token with instagram_basic and instagram_manage_insights permissions. Expires in ~60 days.',
      },
      {
        key: 'INSTAGRAM_ACCOUNT_ID',
        label: 'Instagram Business Account ID',
        type: 'text',
        required: true,
        hint: 'Numeric ID. Find it via Meta Graph API Explorer: /me/accounts → instagram_business_account.',
      },
    ],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Track email open rates, click rates, unsubscribes, and list growth.',
    analyticsNote: 'Read-only via Mailchimp Marketing API. No sending.',
    docsUrl: 'https://admin.mailchimp.com/account/api/',
    fields: [
      {
        key: 'MAILCHIMP_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        hint: 'Account → Extras → API Keys.',
      },
      {
        key: 'MAILCHIMP_SERVER_PREFIX',
        label: 'Server Prefix',
        type: 'text',
        required: true,
        hint: 'The prefix after the dash in your API key, e.g. "us14".',
      },
    ],
  },
  {
    id: 'convertkit',
    name: 'ConvertKit / Kit',
    description: 'Track subscriber growth, broadcast open rates, and form conversion.',
    analyticsNote: 'Read-only via ConvertKit API v4. No sending.',
    docsUrl: 'https://app.convertkit.com/account_settings/advanced_settings',
    fields: [
      {
        key: 'CONVERTKIT_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        hint: 'Settings → Advanced → API.',
      },
    ],
  },
  {
    id: 'beehiiv',
    name: 'Beehiiv',
    description: 'Track newsletter subscriber count, open rates, and post performance.',
    analyticsNote: 'Read-only via Beehiiv API v2. No sending.',
    docsUrl: 'https://app.beehiiv.com/settings/integrations',
    fields: [
      {
        key: 'BEEHIIV_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        hint: 'Settings → Integrations → API.',
      },
      {
        key: 'BEEHIIV_PUBLICATION_ID',
        label: 'Publication ID',
        type: 'text',
        required: true,
        hint: 'Found in your Beehiiv publication URL: app.beehiiv.com/p/<pub_id>/...',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// SecretStorage helpers
// ---------------------------------------------------------------------------

let _ctx: vscode.ExtensionContext | undefined;

export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  _ctx = ctx;
}

function secrets(): vscode.SecretStorage {
  if (!_ctx) throw new Error('Extension context not initialised');
  return _ctx.secrets;
}

function secretKey(platformId: string, fieldKey: string): string {
  return `brandManager.cred.${platformId}.${fieldKey}`;
}

export async function setCredential(platformId: string, fieldKey: string, value: string): Promise<void> {
  await secrets().store(secretKey(platformId, fieldKey), value);
}

export async function getCredential(platformId: string, fieldKey: string): Promise<string | undefined> {
  return secrets().get(secretKey(platformId, fieldKey));
}

export async function clearPlatform(platformId: string): Promise<void> {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return;
  for (const field of platform.fields) {
    await secrets().delete(secretKey(platformId, field.key));
  }
}

/**
 * Returns all stored credentials as a flat env-var map.
 * Passed to subprocess env when running Python scripts.
 */
export async function getAllCredsEnv(): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  for (const platform of PLATFORMS) {
    for (const field of platform.fields) {
      const value = await getCredential(platform.id, field.key);
      if (value) env[field.key] = value;
    }
  }
  return env;
}

/** Returns true for each platform where all required fields are set. */
async function getConfiguredStatus(): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {};
  for (const platform of PLATFORMS) {
    const required = platform.fields.filter((f) => f.required);
    let ok = required.length > 0;
    for (const f of required) {
      if (!(await getCredential(platform.id, f.key))) { ok = false; break; }
    }
    status[platform.id] = ok;
  }
  return status;
}

/** For a single platform, returns which fields currently have a stored value. */
async function getPlatformSetFields(platformId: string): Promise<Record<string, boolean>> {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return {};
  const result: Record<string, boolean> = {};
  for (const f of platform.fields) {
    result[f.key] = !!(await getCredential(platformId, f.key));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Webview
// ---------------------------------------------------------------------------

function nonce(): string {
  let n = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) n += chars.charAt(Math.floor(Math.random() * chars.length));
  return n;
}

function buildHtml(nc: string): string {
  const platformsJson = JSON.stringify(
    PLATFORMS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      analyticsNote: p.analyticsNote,
      docsUrl: p.docsUrl,
      fields: p.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, hint: f.hint })),
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nc}';"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Platform Credentials</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;height:100vh;overflow:hidden}
.sidebar{width:210px;flex-shrink:0;border-right:1px solid var(--vscode-widget-border,#444);overflow-y:auto;padding:12px 0}
.sidebar-title{padding:0 14px 10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--vscode-descriptionForeground)}
.p-item{padding:7px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;border-left:2px solid transparent;user-select:none}
.p-item:hover{background:var(--vscode-list-hoverBackground)}
.p-item.active{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground);border-left-color:var(--vscode-focusBorder)}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot.ok{background:#4caf50}
.dot.off{background:var(--vscode-disabledForeground,#666)}
.main{flex:1;overflow-y:auto;padding:28px 36px;max-width:680px}
.welcome{color:var(--vscode-descriptionForeground);font-size:13px;line-height:1.7}
.welcome p{margin-bottom:10px}
h1{font-size:19px;font-weight:600;margin-bottom:4px}
.desc{color:var(--vscode-descriptionForeground);font-size:13px;margin-bottom:6px}
.badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);font-size:11px;padding:2px 8px;border-radius:10px}
.docs-link{font-size:12px;color:var(--vscode-textLink-foreground);text-decoration:none;margin-left:10px}
.docs-link:hover{text-decoration:underline}
.section{font-size:12px;font-weight:600;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--vscode-widget-border,#444);letter-spacing:.05em;text-transform:uppercase;color:var(--vscode-descriptionForeground)}
label{display:block;font-size:12px;font-weight:600;margin:12px 0 3px}
.hint{font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:5px}
.field-wrap{position:relative;margin-bottom:2px}
input[type=text],input[type=password]{width:100%;padding:6px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,#888);border-radius:3px;font-size:13px;font-family:inherit}
input:focus{outline:1px solid var(--vscode-focusBorder)}
.set-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#4caf50;margin-bottom:4px}
.set-badge button{background:none;border:none;font-size:11px;color:var(--vscode-textLink-foreground);cursor:pointer;padding:0;text-decoration:underline}
.btn-row{display:flex;gap:8px;margin-top:22px;flex-wrap:wrap}
button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;border-radius:3px;font-size:13px;cursor:pointer;font-family:inherit}
button.primary:hover{background:var(--vscode-button-hoverBackground)}
button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:6px 14px;border-radius:3px;font-size:13px;cursor:pointer;font-family:inherit}
button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground,#444)}
button.danger{background:transparent;color:var(--vscode-errorForeground);border:1px solid var(--vscode-errorForeground);padding:5px 13px;border-radius:3px;font-size:13px;cursor:pointer;font-family:inherit}
button.danger:hover{background:var(--vscode-inputValidation-errorBackground)}
.msg{margin-top:12px;font-size:13px;padding:8px 12px;border-radius:3px}
.msg.ok{color:#4caf50;border:1px solid #4caf5066}
.msg.err{color:var(--vscode-errorForeground);border:1px solid var(--vscode-errorForeground)}
</style>
</head>
<body>
<div class="sidebar" id="sidebar">
  <div class="sidebar-title">Platforms</div>
</div>
<div class="main" id="main">
  <div class="welcome">
    <p>Select a platform to configure its credentials.</p>
    <p>All secrets are stored in VS Code's encrypted <strong>SecretStorage</strong> — never written to disk or committed to git.</p>
    <p>The extension automatically injects configured credentials as environment variables whenever it runs Python scripts.</p>
    <p><strong>Purpose:</strong> analytics tracking and Google Drive sync only. No content is posted automatically to any platform.</p>
  </div>
</div>
<script nonce="${nc}">
const vscode = acquireVsCodeApi();
const PLATFORMS = ${platformsJson};

let currentId = null;
let setFields = {};

// --- Sidebar ---
function renderSidebar(statuses) {
  const sidebar = document.getElementById('sidebar');
  const title = sidebar.querySelector('.sidebar-title');
  sidebar.innerHTML = '';
  sidebar.appendChild(title);
  for (const p of PLATFORMS) {
    const el = document.createElement('div');
    el.className = 'p-item' + (p.id === currentId ? ' active' : '');
    el.dataset.pid = p.id;
    const dot = document.createElement('div');
    dot.className = 'dot ' + (statuses[p.id] ? 'ok' : 'off');
    el.appendChild(dot);
    el.appendChild(document.createTextNode(p.name));
    sidebar.appendChild(el);
  }
  sidebar.querySelectorAll('.p-item').forEach(el => {
    el.addEventListener('click', () => {
      currentId = el.dataset.pid;
      renderSidebar(statuses);
      renderPlatformSkeleton(PLATFORMS.find(p => p.id === currentId));
      vscode.postMessage({ type: 'selectPlatform', platformId: currentId });
    });
  });
}

// --- Platform form (skeleton before setFields arrive) ---
function renderPlatformSkeleton(p) {
  const main = document.getElementById('main');
  main.innerHTML =
    '<h1>' + esc(p.name) + '</h1>' +
    '<p class="desc">' + esc(p.description) + '</p>' +
    '<span class="badge">' + esc(p.analyticsNote) + '</span>' +
    '<a class="docs-link" href="' + esc(p.docsUrl) + '" target="_blank">→ How to get credentials</a>' +
    '<div class="section">Credentials</div>' +
    '<div id="fields-area"><p style="color:var(--vscode-descriptionForeground);font-size:12px">Loading…</p></div>' +
    '<div class="btn-row">' +
      '<button class="primary" id="btn-save">Save</button>' +
      '<button class="danger" id="btn-clear">Clear All</button>' +
    '</div>' +
    '<div id="msg"></div>';
  document.getElementById('btn-save').addEventListener('click', saveCreds);
  document.getElementById('btn-clear').addEventListener('click', clearCreds);
}

// --- Render fields once we know which are set ---
function renderFields(p, sf) {
  setFields = sf;
  const area = document.getElementById('fields-area');
  if (!area) return;
  area.innerHTML = p.fields.map(f => {
    const isSet = !!sf[f.key];
    const badge = isSet
      ? '<div class="set-badge">✓ Currently set <button data-key="' + f.key + '" class="replace-btn">replace</button></div>'
      : '';
    const input = (!isSet)
      ? '<input type="' + f.type + '" id="f_' + f.key + '" data-key="' + f.key + '" autocomplete="off" placeholder="' + (f.type === 'password' ? '••••••••' : '') + '"/>'
      : '<input type="' + f.type + '" id="f_' + f.key + '" data-key="' + f.key + '" autocomplete="off" placeholder="Enter new value to replace" style="display:none"/>';
    return '<label for="f_' + f.key + '">' + esc(f.label) +
      (f.required ? ' <span style="color:var(--vscode-errorForeground)">*</span>' : ' <span style="opacity:.5;font-weight:normal;">(optional)</span>') +
      '</label>' +
      '<p class="hint">' + esc(f.hint) + '</p>' +
      badge + input;
  }).join('');
  // Wire replace buttons
  area.querySelectorAll('.replace-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      btn.closest('.set-badge').remove();
      const inp = document.getElementById('f_' + key);
      if (inp) inp.style.display = '';
    });
  });
}

function saveCreds() {
  const p = PLATFORMS.find(x => x.id === currentId);
  if (!p) return;
  const fields = {};
  for (const f of p.fields) {
    const el = document.getElementById('f_' + f.key);
    if (el && el.style.display !== 'none' && el.value.trim()) {
      fields[f.key] = el.value.trim();
    }
  }
  if (Object.keys(fields).length === 0) {
    showMsg('No new values entered — nothing to save.', 'err');
    return;
  }
  vscode.postMessage({ type: 'save', platformId: currentId, fields });
}

function clearCreds() {
  const p = PLATFORMS.find(x => x.id === currentId);
  if (!p) return;
  if (!confirm('Clear all credentials for ' + p.name + '? This cannot be undone.')) return;
  vscode.postMessage({ type: 'clear', platformId: currentId });
}

function showMsg(text, type) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.className = 'msg ' + type;
  el.textContent = text;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

window.addEventListener('message', ev => {
  const msg = ev.data;
  if (msg.type === 'ready') {
    renderSidebar(msg.statuses);
  } else if (msg.type === 'platformData') {
    const p = PLATFORMS.find(x => x.id === msg.platformId);
    if (p && msg.platformId === currentId) renderFields(p, msg.setFields);
  } else if (msg.type === 'saveResult') {
    renderSidebar(msg.statuses);
    // Re-fetch field state
    vscode.postMessage({ type: 'selectPlatform', platformId: currentId });
    showMsg('✓ Credentials saved.', 'ok');
  } else if (msg.type === 'clearResult') {
    renderSidebar(msg.statuses);
    vscode.postMessage({ type: 'selectPlatform', platformId: currentId });
    showMsg('Credentials cleared.', 'ok');
  } else if (msg.type === 'error') {
    showMsg('✗ ' + msg.message, 'err');
  }
});

// Kick off
vscode.postMessage({ type: 'init' });
</script>
</body>
</html>`;
}

export function openCredentialManager(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'brandManagerCreds',
    'Brand Manager: Platform Credentials',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = buildHtml(nonce());

  panel.webview.onDidReceiveMessage(async (msg) => {
    try {
      if (msg.type === 'init') {
        const statuses = await getConfiguredStatus();
        panel.webview.postMessage({ type: 'ready', statuses });
      } else if (msg.type === 'selectPlatform') {
        const sf = await getPlatformSetFields(msg.platformId);
        panel.webview.postMessage({ type: 'platformData', platformId: msg.platformId, setFields: sf });
      } else if (msg.type === 'save') {
        for (const [key, value] of Object.entries(msg.fields as Record<string, string>)) {
          await setCredential(msg.platformId, key, value);
        }
        const statuses = await getConfiguredStatus();
        panel.webview.postMessage({ type: 'saveResult', statuses });
      } else if (msg.type === 'clear') {
        await clearPlatform(msg.platformId);
        const statuses = await getConfiguredStatus();
        panel.webview.postMessage({ type: 'clearResult', statuses });
      }
    } catch (e) {
      panel.webview.postMessage({ type: 'error', message: (e as Error).message });
    }
  }, undefined, context.subscriptions);
}
