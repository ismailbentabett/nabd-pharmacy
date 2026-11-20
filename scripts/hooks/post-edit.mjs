// PostToolUse(Write|Edit): fast feedback. Runs the pattern linter on the edited file (non-blocking unless a P0 pattern is found).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let file = '';
  try { file = JSON.parse(raw).tool_input?.file_path ?? ''; } catch { process.exit(0); }
  if (!/\.(tsx?|jsx?)$/.test(file) || !existsSync(file)) process.exit(0);
  if (/node_modules|\/spikes\//.test(file)) process.exit(0);
  const lint = spawnSync('node', [`${process.env.CLAUDE_PROJECT_DIR ?? '.'}/scripts/lint-patterns.mjs`, file], { encoding: 'utf8' });
  if (lint.status !== 0) {
    process.stderr.write(lint.stdout + lint.stderr);
    process.exit(2); // feeds findings back to Claude to fix immediately
  }
  process.exit(0);
});
