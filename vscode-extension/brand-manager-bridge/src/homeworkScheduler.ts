import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { getAllCredsEnv } from './credentialManager';

interface AiAction {
  // The CLI command (script path + args) AI should run for this item, or null.
  // Stored in homework.json as a single string like "python scripts/do_homework.py uvp".
}

interface HomeworkItem {
  id: string;
  step?: number;
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  status: 'not-started' | 'in-progress' | 'done' | 'blocked' | 'skipped';
  ai_doable: boolean;
  ai_action: string | null;
  owner_action?: string;
  notes?: string;
}

interface HomeworkFile {
  version: number;
  description?: string;
  items: HomeworkItem[];
}

const HOMEWORK_REL = 'database/homework.json';
const LAST_REMINDER_KEY = 'brandManager.homework.lastReminder';

let statusBarItem: vscode.StatusBarItem | undefined;
let reminderTimer: NodeJS.Timeout | undefined;

function loadHomework(workspaceRoot: string): HomeworkFile | null {
  const p = path.join(workspaceRoot, HOMEWORK_REL);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as HomeworkFile;
  } catch (e) {
    vscode.window.showErrorMessage(`Failed to parse ${HOMEWORK_REL}: ${e}`);
    return null;
  }
}

function saveHomework(workspaceRoot: string, data: HomeworkFile): void {
  const p = path.join(workspaceRoot, HOMEWORK_REL);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function openItems(data: HomeworkFile): HomeworkItem[] {
  return data.items.filter((i) => i.status !== 'done' && i.status !== 'skipped');
}

function priorityIcon(p: string): string {
  return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';
}

function categoryIcon(c: string): string {
  switch (c) {
    case 'positioning':
      return '🎯';
    case 'audience':
      return '👥';
    case 'messaging':
      return '💬';
    case 'assets':
      return '🎨';
    case 'outreach':
      return '📨';
    case 'operations':
      return '⚙️';
    case 'discovery':
      return '🔍';
    case 'platform':
      return '🌐';
    default:
      return '📋';
  }
}

function aiIcon(item: HomeworkItem): string {
  return item.ai_doable ? '🤖' : '👤';
}

function updateStatusBar(openCount: number, highCount: number): void {
  if (!statusBarItem) return;
  if (openCount === 0) {
    statusBarItem.text = '$(check) homework clear';
    statusBarItem.tooltip = 'All strategic homework done.';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `$(checklist) homework ${openCount}`;
    statusBarItem.tooltip = `${openCount} open homework item(s), ${highCount} high priority. Click to review.`;
    statusBarItem.backgroundColor =
      highCount > 0
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;
  }
  statusBarItem.show();
}

function refreshStatusBar(workspaceRoot: string): void {
  const data = loadHomework(workspaceRoot);
  if (!data) {
    if (statusBarItem) statusBarItem.hide();
    return;
  }
  const open = openItems(data);
  const high = open.filter((i) => i.priority === 'high').length;
  updateStatusBar(open.length, high);
}

async function maybeShowStartupReminder(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<void> {
  const last = context.globalState.get<string>(LAST_REMINDER_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (last === today) return;

  const data = loadHomework(workspaceRoot);
  if (!data) return;
  const open = openItems(data);
  if (open.length === 0) return;

  const high = open.filter((i) => i.priority === 'high').length;
  const aiDoable = open.filter((i) => i.ai_doable).length;
  const msg =
    `Strategic homework: ${open.length} open` +
    (high > 0 ? `, ${high} high priority` : '') +
    (aiDoable > 0 ? ` — ${aiDoable} AI can draft now.` : '.');

  const choice = await vscode.window.showInformationMessage(msg, 'Review', 'Dismiss');
  await context.globalState.update(LAST_REMINDER_KEY, today);
  if (choice === 'Review') {
    vscode.commands.executeCommand('brandManager.showHomework');
  }
}

function startReminderInterval(workspaceRoot: string): void {
  const cfg = vscode.workspace.getConfiguration('brandManager.homework');
  const hours = cfg.get<number>('reminderIntervalHours', 0);
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = undefined;
  }
  if (hours <= 0) return;
  reminderTimer = setInterval(() => {
    refreshStatusBar(workspaceRoot);
  }, hours * 60 * 60 * 1000);
}

function stopReminderInterval(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = undefined;
  }
}

function runAiAction(workspaceRoot: string, extensionPath: string, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  // command is e.g. "python scripts/do_homework.py uvp"
  return getAllCredsEnv().then((creds) => new Promise((resolve) => {
    const parts = command.split(/\s+/);
    let bin = parts.shift() || 'python3';
    if (bin === 'python') {
      const cfg = vscode.workspace.getConfiguration('brandManager').get<string>('pythonPath');
      bin = cfg || 'python3';
    }
    // Remap "scripts/<name>.py" to the vendored path inside the extension bundle.
    const remappedArgs = parts.map((arg) =>
      arg.startsWith('scripts/')
        ? path.join(extensionPath, 'out', 'scripts', arg.slice('scripts/'.length))
        : arg
    );
    const proc = spawn(bin, remappedArgs, { cwd: workspaceRoot, env: { ...process.env, ...creds } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b) => (stdout += b.toString()));
    proc.stderr.on('data', (b) => (stderr += b.toString()));
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  }));
}

export function getOpenHomework(workspaceRoot: string): HomeworkItem[] {
  const data = loadHomework(workspaceRoot);
  return data ? openItems(data) : [];
}

export function getAllHomework(workspaceRoot: string): HomeworkItem[] {
  const data = loadHomework(workspaceRoot);
  return data ? data.items : [];
}

export function markDone(workspaceRoot: string, id: string): boolean {
  const data = loadHomework(workspaceRoot);
  if (!data) return false;
  const item = data.items.find((i) => i.id === id);
  if (!item) return false;
  item.status = 'done';
  saveHomework(workspaceRoot, data);
  refreshStatusBar(workspaceRoot);
  return true;
}

// extensionPath is threaded through so runAiAction can remap vendored script paths.
let _extensionPath = '';

export async function executeItem(
  workspaceRoot: string,
  id: string
): Promise<{ ok: boolean; output: string }> {
  const data = loadHomework(workspaceRoot);
  if (!data) return { ok: false, output: 'homework.json not found' };
  const item = data.items.find((i) => i.id === id);
  if (!item) return { ok: false, output: `No item with id "${id}"` };
  if (!item.ai_doable || !item.ai_action) {
    return {
      ok: false,
      output:
        `"${item.title}" is owner-only. ` +
        (item.owner_action || 'See item notes for what the owner needs to do.'),
    };
  }
  const result = await runAiAction(workspaceRoot, _extensionPath, item.ai_action);
  refreshStatusBar(workspaceRoot);
  if (result.code !== 0) {
    return {
      ok: false,
      output: `Command failed (exit ${result.code}).\n\nSTDERR:\n${result.stderr}\n\nSTDOUT:\n${result.stdout}`,
    };
  }
  return {
    ok: true,
    output: `Ran: ${item.ai_action}\n\n${result.stdout}\n\nReview the output, then mark "${item.id}" done when ready.`,
  };
}

export function registerHomeworkScheduler(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  extensionPath: string
): void {
  _extensionPath = extensionPath;
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBarItem.command = 'brandManager.showHomework';
  context.subscriptions.push(statusBarItem);

  refreshStatusBar(workspaceRoot);

  // Watch for edits to homework.json
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, HOMEWORK_REL)
  );
  context.subscriptions.push(watcher);
  const onChange = () => refreshStatusBar(workspaceRoot);
  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.showHomework', async () => {
      const data = loadHomework(workspaceRoot);
      if (!data) {
        const choice = await vscode.window.showWarningMessage(
          'database/homework.json not found.',
          'Open Strategist'
        );
        if (choice === 'Open Strategist') {
          vscode.commands.executeCommand('workbench.action.chat.openAgent', 'the-strategist');
        }
        return;
      }
      const open = openItems(data);
      if (open.length === 0) {
        vscode.window.showInformationMessage('🎉 All strategic homework done.');
        return;
      }
      const items = open
        .sort((a, b) => {
          const sa = a.step ?? 99;
          const sb = b.step ?? 99;
          if (sa !== sb) return sa - sb;
          const rank = { high: 0, medium: 1, low: 2 } as const;
          return rank[a.priority] - rank[b.priority];
        })
        .map((i) => ({
          label: `${priorityIcon(i.priority)} ${categoryIcon(i.category)} ${aiIcon(i)} ${i.title}`,
          description: `step ${i.step ?? '?'} · ${i.category} · ${i.status}`,
          detail: i.ai_doable
            ? `🤖 ${i.ai_action}`
            : `👤 ${i.owner_action ?? '(owner-only)'}`,
          id: i.id,
          ai_doable: i.ai_doable,
        }));
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Pick a homework item to open, run, or mark done.',
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (!pick) return;

      const actions = pick.ai_doable
        ? ['Open in editor', 'Run AI action', 'Mark done']
        : ['Open in editor', 'Mark done'];
      const action = await vscode.window.showQuickPick(actions, {
        placeHolder: `What to do with "${pick.label}"?`,
      });
      if (!action) return;

      if (action === 'Open in editor') {
        await vscode.commands.executeCommand('brandManager.openHomework', pick.id);
      } else if (action === 'Run AI action') {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Running AI action for ${pick.id}…`,
            cancellable: false,
          },
          async () => {
            const result = await executeItem(workspaceRoot, pick.id);
            const channel = vscode.window.createOutputChannel('Brand Manager Homework');
            channel.appendLine(result.output);
            channel.show();
            if (result.ok) {
              vscode.window.showInformationMessage(
                `AI action ran for ${pick.id}. Review output then mark done.`
              );
            } else {
              vscode.window.showErrorMessage(`AI action failed for ${pick.id}.`);
            }
          }
        );
      } else if (action === 'Mark done') {
        await vscode.commands.executeCommand('brandManager.markHomeworkDone', pick.id);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.openHomework', async (itemId?: string) => {
      const filePath = path.join(workspaceRoot, HOMEWORK_REL);
      const doc = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(doc);
      if (itemId) {
        const text = doc.getText();
        const idx = text.indexOf(`"id": "${itemId}"`);
        if (idx >= 0) {
          const pos = doc.positionAt(idx);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brandManager.markHomeworkDone', async (itemId?: string) => {
      const data = loadHomework(workspaceRoot);
      if (!data) {
        vscode.window.showErrorMessage('database/homework.json not found.');
        return;
      }
      let id = itemId;
      if (!id) {
        const open = openItems(data);
        if (open.length === 0) {
          vscode.window.showInformationMessage('All homework already done. 🎉');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          open.map((i) => ({
            label: `${priorityIcon(i.priority)} ${i.title}`,
            description: `step ${i.step ?? '?'} · ${i.category}`,
            id: i.id,
          })),
          { placeHolder: 'Mark which item as done?' }
        );
        if (!pick) return;
        id = pick.id;
      }
      const item = data.items.find((i) => i.id === id);
      if (!item) {
        vscode.window.showErrorMessage(`No homework item with id "${id}".`);
        return;
      }
      if (item.status === 'done') {
        vscode.window.showInformationMessage(`"${item.title}" is already done.`);
        return;
      }
      item.status = 'done';
      saveHomework(workspaceRoot, data);
      refreshStatusBar(workspaceRoot);
      vscode.window.showInformationMessage(`✅ Marked done: ${item.title}`);
    })
  );

  // Startup reminder (once per day)
  maybeShowStartupReminder(context, workspaceRoot);

  // Optional interval reminder
  startReminderInterval(workspaceRoot);

  context.subscriptions.push({ dispose: stopReminderInterval });
}
