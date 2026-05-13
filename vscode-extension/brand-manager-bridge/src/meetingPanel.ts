import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { getAllCredsEnv } from './credentialManager';

function pythonBin(): string {
  const cfg = vscode.workspace.getConfiguration('brandManager').get<string>('pythonPath');
  return cfg || 'python3';
}

function runScriptWithStdin(
  workspaceRoot: string,
  extensionPath: string,
  scriptRel: string,
  args: string[],
  stdinText: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return getAllCredsEnv().then((creds) => new Promise((resolve) => {
    const scriptFullPath = path.join(extensionPath, 'out', 'scripts', scriptRel);
    const proc = spawn(
      pythonBin(),
      [scriptFullPath, ...args],
      { cwd: workspaceRoot, env: { ...process.env, ...creds } }
    );
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b) => (stdout += b.toString()));
    proc.stderr.on('data', (b) => (stderr += b.toString()));
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    if (stdinText) {
      proc.stdin.write(stdinText);
    }
    proc.stdin.end();
  }));
}

function html(nonce: string): string {
  return /* html */ `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h2 { margin-top: 0; font-size: 1.1em; }
    h3 { font-size: 0.95em; margin: 16px 0 6px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    textarea { width: 100%; min-height: 220px; box-sizing: border-box; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; cursor: pointer; margin-right: 6px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .proposal { border: 1px solid var(--vscode-panel-border); padding: 10px; margin-bottom: 8px; border-radius: 4px; }
    .proposal.approved { border-color: var(--vscode-charts-green); background: color-mix(in srgb, var(--vscode-charts-green) 10%, transparent); }
    .proposal.skipped { opacity: 0.5; }
    .proposal pre { white-space: pre-wrap; margin: 4px 0; font-family: var(--vscode-editor-font-family); font-size: 0.9em; }
    .meta { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 0.8em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); margin-left: 6px; }
    label { font-size: 0.9em; }
    .summary { background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); padding: 8px 12px; margin: 12px 0; }
    .hidden { display: none; }
    .empty { color: var(--vscode-descriptionForeground); font-style: italic; }
    input[type="checkbox"] { margin-right: 6px; }
  </style>
</head>
<body>
  <h2>📝 Meeting Review</h2>
  <p class="meta">Paste a meeting transcript. The Strategist will surface homework status changes, brand refinements, new leads, and action items. You approve each one before anything is written.</p>

  <textarea id="transcript" placeholder="Paste meeting transcript here..."></textarea>
  <div class="row">
    <button id="analyze">Analyze with Strategist</button>
    <button class="secondary" id="clear">Clear</button>
    <span id="status" class="meta"></span>
  </div>

  <div id="results" class="hidden">
    <div id="summary" class="summary"></div>

    <h3>Homework updates</h3>
    <div id="homework_updates"></div>

    <h3>Brand DNA refinements</h3>
    <div id="brand_patches"></div>

    <h3>New leads</h3>
    <div id="new_leads"></div>

    <h3>Action items</h3>
    <div id="action_items"></div>

    <h3>Meeting notes</h3>
    <div id="meeting_notes"></div>

    <div class="row" style="margin-top: 16px;">
      <button id="apply">Apply approved changes</button>
      <button class="secondary" id="approveAll">Approve all</button>
      <button class="secondary" id="reset">Discard proposals</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let proposals = null;

    const $ = (id) => document.getElementById(id);

    $('analyze').addEventListener('click', () => {
      const text = $('transcript').value.trim();
      if (!text) { $('status').textContent = 'Paste a transcript first.'; return; }
      $('status').textContent = 'Analyzing… (Gemini call, may take ~10s)';
      $('analyze').disabled = true;
      vscode.postMessage({ type: 'analyze', transcript: text });
    });

    $('clear').addEventListener('click', () => {
      $('transcript').value = '';
      $('status').textContent = '';
      $('results').classList.add('hidden');
      proposals = null;
    });

    $('reset').addEventListener('click', () => {
      $('results').classList.add('hidden');
      proposals = null;
    });

    $('approveAll').addEventListener('click', () => {
      document.querySelectorAll('.approve-cb').forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); });
    });

    $('apply').addEventListener('click', () => {
      if (!proposals) return;
      $('status').textContent = 'Applying…';
      $('apply').disabled = true;
      vscode.postMessage({ type: 'apply', proposals });
    });

    function renderList(containerId, items, renderer) {
      const c = $(containerId);
      c.innerHTML = '';
      if (!items || items.length === 0) {
        c.innerHTML = '<div class="empty">(nothing proposed)</div>';
        return;
      }
      items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'proposal';
        div.innerHTML = renderer(item, idx);
        const cb = div.querySelector('.approve-cb');
        if (cb) {
          cb.addEventListener('change', () => {
            item._approved = cb.checked;
            div.classList.toggle('approved', cb.checked);
            div.classList.toggle('skipped', !cb.checked);
          });
        }
        c.appendChild(div);
      });
    }

    function escape(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function renderProposals(p) {
      proposals = p;
      $('summary').textContent = p.summary || '(no summary)';

      renderList('homework_updates', p.homework_updates, (it) => \`
        <label><input type="checkbox" class="approve-cb" /><b>\${escape(it.id)}</b> → <span class="badge">\${escape(it.new_status)}</span></label>
        <div class="meta">\${escape(it.reason)}</div>
      \`);

      renderList('brand_patches', p.brand_patches, (it) => \`
        <label><input type="checkbox" class="approve-cb" /><b>\${escape(it.path)}</b></label>
        <div class="meta">\${escape(it.reason)}</div>
        <pre><b>current:</b> \${escape(JSON.stringify(it.current))}</pre>
        <pre><b>proposed:</b> \${escape(JSON.stringify(it.proposed))}</pre>
      \`);

      renderList('new_leads', p.new_leads, (it) => \`
        <label><input type="checkbox" class="approve-cb" /><b>\${escape(it.name)}</b> — \${escape(it.title)} @ \${escape(it.org)} <span class="badge">\${escape(it.stage || 'new')}</span></label>
        <div class="meta"><b>context:</b> \${escape(it.context)}</div>
        <div class="meta"><b>next step:</b> \${escape(it.next_step)}</div>
      \`);

      renderList('action_items', p.action_items, (it) => \`
        <label><input type="checkbox" class="approve-cb" /><span class="badge">\${escape(it.owner === 'ai' ? '🤖 AI' : '👤 Owner')}</span> \${escape(it.task)}</label>
        <div class="meta">\${it.homework_id ? 'maps to homework: ' + escape(it.homework_id) : ''} \${it.due ? '· due ' + escape(it.due) : ''}</div>
      \`);

      // Meeting notes — single approve checkbox
      const mn = $('meeting_notes');
      mn.innerHTML = '';
      if (p.meeting_notes_markdown) {
        const div = document.createElement('div');
        div.className = 'proposal';
        div.innerHTML = \`
          <label><input type="checkbox" class="approve-cb-notes" /><b>Save meeting notes file</b></label>
          <pre>\${escape(p.meeting_notes_markdown.slice(0, 800))}\${p.meeting_notes_markdown.length > 800 ? '…' : ''}</pre>
        \`;
        const cb = div.querySelector('.approve-cb-notes');
        cb.addEventListener('change', () => {
          proposals._meeting_notes_approved = cb.checked;
          div.classList.toggle('approved', cb.checked);
        });
        mn.appendChild(div);
      } else {
        mn.innerHTML = '<div class="empty">(no notes generated)</div>';
      }

      $('results').classList.remove('hidden');
      $('analyze').disabled = false;
      $('status').textContent = 'Review and approve, then click "Apply approved changes".';
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'proposals') {
        renderProposals(msg.proposals);
      } else if (msg.type === 'analyze_error') {
        $('status').textContent = 'Analyze failed: ' + msg.error;
        $('analyze').disabled = false;
      } else if (msg.type === 'applied') {
        $('status').textContent = 'Applied: ' + JSON.stringify(msg.summary);
        $('apply').disabled = false;
      } else if (msg.type === 'apply_error') {
        $('status').textContent = 'Apply failed: ' + msg.error;
        $('apply').disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function nonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

export function openMeetingPanel(context: vscode.ExtensionContext, workspaceRoot: string, extensionPath: string): void {
  const panel = vscode.window.createWebviewPanel(
    'brandManager.meetingReview',
    'Meeting Review',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = html(nonce());

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.type === 'analyze') {
      const result = await runScriptWithStdin(
        workspaceRoot,
        extensionPath,
        'process_meeting.py',
        ['analyze'],
        msg.transcript
      );
      if (result.code !== 0) {
        panel.webview.postMessage({
          type: 'analyze_error',
          error: result.stderr || `exit ${result.code}`,
        });
        return;
      }
      try {
        const proposals = JSON.parse(result.stdout);
        panel.webview.postMessage({ type: 'proposals', proposals });
      } catch (e) {
        panel.webview.postMessage({
          type: 'analyze_error',
          error: 'Could not parse proposals JSON: ' + (e as Error).message,
        });
      }
    } else if (msg.type === 'apply') {
      // Write proposals (with _approved flags) to a temp file, then call apply
      const tmp = path.join(os.tmpdir(), `brand-mgr-proposals-${Date.now()}.json`);
      fs.writeFileSync(tmp, JSON.stringify(msg.proposals, null, 2));
      const result = await runScriptWithStdin(
        workspaceRoot,
        extensionPath,
        'process_meeting.py',
        ['apply', '--proposals', tmp],
        ''
      );
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      if (result.code !== 0) {
        panel.webview.postMessage({
          type: 'apply_error',
          error: result.stderr || `exit ${result.code}`,
        });
        return;
      }
      let summary: any;
      try { summary = JSON.parse(result.stdout); } catch { summary = result.stdout; }
      panel.webview.postMessage({ type: 'applied', summary });
      vscode.window.showInformationMessage('Meeting changes applied. See panel for summary.');
      // Refresh any open homework editor
      vscode.commands.executeCommand('brandManager.openHomework').then(() => {}, () => {});
    }
  });

  context.subscriptions.push(panel);
}
