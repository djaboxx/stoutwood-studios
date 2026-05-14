import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  registerHomeworkScheduler,
  getOpenHomework,
  getAllHomework,
  markDone as markHomeworkDoneFn,
  executeItem as executeHomeworkItem,
} from './homeworkScheduler';
import { openMeetingPanel } from './meetingPanel';
import { openSetupWizard } from './setupWizard';
import { openCredentialManager, getAllCredsEnv, setExtensionContext } from './credentialManager';

// Resolved at activation time; used to locate vendored scripts inside the extension bundle.
let _extensionPath = '';

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error('No workspace folder open.');
  }
  return folder.uri.fsPath;
}

function pythonBin(): string {
  const cfg = vscode.workspace.getConfiguration('brandManager').get<string>('pythonPath');
  return cfg || 'python3';
}

/** Resolve a script path from the vendored scripts bundled inside the extension. */
function scriptPath(scriptRel: string): string {
  return path.join(_extensionPath, 'out', 'scripts', scriptRel);
}

async function runScript(scriptRel: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const creds = await getAllCredsEnv();
  const root = workspaceRoot();
  return new Promise((resolve) => {
    const proc = spawn(pythonBin(), [scriptPath(scriptRel), ...args], {
      cwd: root,
      env: { ...process.env, ...creds },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b) => (stdout += b.toString()));
    proc.stderr.on('data', (b) => (stderr += b.toString()));
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

async function runScriptStdin(scriptRel: string, args: string[], stdinText: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const creds = await getAllCredsEnv();
  const root = workspaceRoot();
  return new Promise((resolve) => {
    const proc = spawn(pythonBin(), [scriptPath(scriptRel), ...args], {
      cwd: root,
      env: { ...process.env, ...creds },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b) => (stdout += b.toString()));
    proc.stderr.on('data', (b) => (stderr += b.toString()));
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    if (stdinText) proc.stdin.write(stdinText);
    proc.stdin.end();
  });
}

function readJson(rel: string): any {
  const p = path.join(workspaceRoot(), rel);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function registerLmTools(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_loadBrand', {
      async invoke() {
        const data = readJson('database/brand.json');
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify(data, null, 2)),
        ]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_loadVisualStyle', {
      async invoke() {
        const data = readJson('database/visual-style.json');
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify(data, null, 2)),
        ]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_runVoiceToContent', {
      async invoke(options) {
        const input = options.input as { voiceFile: string; skip?: string[] };
        const args = [input.voiceFile];
        for (const s of input.skip ?? []) {
          args.push('--skip', s);
        }
        const result = await runScript('voice_to_content.py', args);
        const text =
          result.code === 0
            ? `Pipeline complete.\n\n${result.stdout}`
            : `Pipeline FAILED (exit ${result.code}).\n\nSTDERR:\n${result.stderr}\n\nSTDOUT:\n${result.stdout}`;
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_listOverdueLeads', {
      async invoke() {
        const result = await runScript('manage_leads.py', ['due']);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(result.stdout || '(no overdue follow-ups)'),
        ]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_listHomework', {
      async invoke(options) {
        const input = (options.input as { open_only?: boolean }) ?? {};
        const items = input.open_only === false
          ? getAllHomework(workspaceRoot())
          : getOpenHomework(workspaceRoot());
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify(items, null, 2)),
        ]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_executeHomework', {
      async invoke(options) {
        const input = options.input as { id: string };
        const result = await executeHomeworkItem(workspaceRoot(), input.id);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(result.output),
        ]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_markHomeworkDone', {
      async invoke(options) {
        const input = options.input as { id: string };
        const ok = markHomeworkDoneFn(workspaceRoot(), input.id);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            ok ? `Marked "${input.id}" as done.` : `No homework item with id "${input.id}".`
          ),
        ]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_analyzeMeeting', {
      async invoke(options) {
        const input = options.input as { transcript: string };
        if (!input.transcript || !input.transcript.trim()) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Empty transcript.'),
          ]);
        }
        const result = await runScriptStdin('process_meeting.py', ['analyze'], input.transcript);
        const text = result.code === 0
          ? result.stdout
          : `analyze failed (exit ${result.code}):\n${result.stderr}`;
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      },
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('brandManager_gradeImageQuality', {
      async invoke(options) {
        const input = options.input as { imagePaths: string[]; focus?: string; model?: string };
        const imagePaths = input.imagePaths ?? [];
        if (imagePaths.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('No image paths supplied.'),
          ]);
        }
        const args = [...imagePaths];
        if (input.focus) args.push('--focus', input.focus);
        if (input.model) args.push('--model', input.model);
        const result = await runScript('grade_image_quality.py', args);
        const text = result.code === 0
          ? result.stdout
          : `Image quality grading failed (exit ${result.code}).\n\nSTDERR:\n${result.stderr}\n\nSTDOUT:\n${result.stdout}`;
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
      },
    })
  );
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.openBrand', async () => {
      const uri = vscode.Uri.file(path.join(workspaceRoot(), 'database', 'brand.json'));
      await vscode.window.showTextDocument(uri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.runVoiceToContent', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        defaultUri: vscode.Uri.file(path.join(workspaceRoot(), 'audio', 'recordings', 'raw')),
        filters: { Audio: ['wav', 'mp3', 'm4a'] },
        openLabel: 'Run pipeline on this voice file',
      });
      if (!picked || picked.length === 0) return;
      const file = picked[0].fsPath;

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Running voice → content pipeline…', cancellable: false },
        async () => {
          const result = await runScript('voice_to_content.py', [file]);
          const channel = vscode.window.createOutputChannel('Brand Manager');
          if (result.code === 0) {
            vscode.window.showInformationMessage('Pipeline complete. See terminal output.');
            channel.appendLine(result.stdout);
          } else {
            vscode.window.showErrorMessage(`Pipeline failed (exit ${result.code}). See output.`);
            channel.appendLine(result.stderr);
          }
          channel.show();
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.openMeetingReview', async () => {
      openMeetingPanel(context, workspaceRoot(), _extensionPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.recordVoice', async () => {
      vscode.window.showInformationMessage(
        'Voice recording UI is not yet implemented. For now, drop a WAV in audio/recordings/raw/ and run "Run Voice → Content Pipeline".'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.setupWizard', async () => {
      openSetupWizard(context, workspaceRoot());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.manageCredentials', () => {
      openCredentialManager(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.syncDrive', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Syncing to Google Drive…', cancellable: false },
        async () => {
          const result = await runScript('sync_drive.py', []);
          if (result.code === 0) {
            let stats: any = {};
            try { stats = JSON.parse(result.stdout.trim().split('\n').pop() ?? '{}'); } catch { /* ignore */ }
            vscode.window.showInformationMessage(
              `Drive sync complete — ${stats.synced ?? '?'} files synced, ${stats.failed ?? 0} failed.`
            );
          } else {
            vscode.window.showErrorMessage(`Drive sync failed (exit ${result.code}). See output for details.`);
            const ch = vscode.window.createOutputChannel('Brand Manager');
            ch.appendLine(result.stderr);
            ch.show();
          }
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.fetchAnalytics', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Fetching platform analytics…', cancellable: false },
        async () => {
          const result = await runScript('fetch_analytics.py', []);
          if (result.code === 0) {
            vscode.window.showInformationMessage('Analytics fetched. Saved to database/analytics.json.');
          } else {
            vscode.window.showErrorMessage(`Analytics fetch failed (exit ${result.code}).`);
            const ch = vscode.window.createOutputChannel('Brand Manager');
            ch.appendLine(result.stderr);
            ch.show();
          }
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.gradeImageQuality', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: true,
        defaultUri: vscode.Uri.file(path.join(workspaceRoot(), 'outputs', 'social')),
        filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'] },
        openLabel: 'Grade selected images',
      });
      if (!picked || picked.length === 0) return;

      const focus = await vscode.window.showInputBox({
        title: 'Optional review focus',
        placeHolder: 'e.g. style alignment, composition strength, engagement readiness',
      });

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Grading image quality…', cancellable: false },
        async () => {
          const args = picked.map((u) => u.fsPath);
          if (focus && focus.trim()) args.push('--focus', focus.trim());
          const result = await runScript('grade_image_quality.py', args);
          const ch = vscode.window.createOutputChannel('Brand Manager');
          if (result.code === 0) {
            try {
              const parsed = JSON.parse(result.stdout);
              vscode.window.showInformationMessage(`Image quality review complete — overall score: ${parsed.overall_score ?? 'n/a'}.`);
            } catch {
              vscode.window.showInformationMessage('Image quality review complete.');
            }
            ch.appendLine(result.stdout);
          } else {
            vscode.window.showErrorMessage(`Image quality review failed (exit ${result.code}). See output.`);
            ch.appendLine(result.stderr);
            ch.appendLine(result.stdout);
          }
          ch.show();
        }
      );
    })
  );
}

async function maybePromptSetup(context: vscode.ExtensionContext): Promise<void> {
  let root: string;
  try { root = workspaceRoot(); } catch { return; }

  const brandFile = path.join(root, 'database', 'brand.json');
  if (fs.existsSync(brandFile)) return;

  const choice = await vscode.window.showInformationMessage(
    'No brand configured in this workspace. Run the Brand Setup Wizard to get started.',
    'Run Setup Wizard',
    'Later'
  );
  if (choice === 'Run Setup Wizard') {
    vscode.commands.executeCommand('brandManager.setupWizard');
  }
}

export function activate(context: vscode.ExtensionContext) {
  _extensionPath = context.extensionPath;
  setExtensionContext(context);
  registerLmTools(context);
  registerCommands(context);
  try {
    registerHomeworkScheduler(context, workspaceRoot(), _extensionPath);
  } catch (e) {
    console.warn('homework scheduler not registered:', e);
  }
  maybePromptSetup(context);
  console.log('brand-manager-bridge activated');
}

export function deactivate() {}
