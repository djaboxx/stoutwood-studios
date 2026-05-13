import { build, context } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

/** Copy the vendored Python scripts into out/scripts/ so they ship with the extension. */
function copyScripts() {
  const src = join(__dirname, 'scripts');
  const dst = join(__dirname, 'out', 'scripts');
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('[scripts] copied to out/scripts/');
}

const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  copyScripts();
} else {
  await build(options);
  copyScripts();
}
