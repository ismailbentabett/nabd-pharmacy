// Stop hook: if source files changed and the quick check fails, ask Claude to keep going. Respects stop_hook_active to avoid loops.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let active = false;
  try { active = !!JSON.parse(raw).stop_hook_active; } catch {}
  if (active) process.exit(0);
  const root = process.env.CLAUDE_PROJECT_DIR ?? '.';
  if (!existsSync(`${root}/package.json`)) process.exit(0); // nothing scaffolded yet
  const diff = spawnSync('git', ['status', '--porcelain', '--', 'app', 'src'], { cwd: root, encoding: 'utf8' });
  if (!diff.stdout || !diff.stdout.trim()) process.exit(0);
  const r = spawnSync('bash', ['scripts/check.sh', '--quick'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`Quick check failed. Fix before stopping:\n${(r.stdout + r.stderr).slice(-3000)}`);
    process.exit(2);
  }
  process.exit(0);
});
