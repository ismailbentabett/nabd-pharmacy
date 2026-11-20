// PreToolUse(Bash): block destructive commands the owner forbids. Exit 2 = block with message on stderr.
let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(raw).tool_input?.command ?? ''; } catch { process.exit(0); }
  const rules = [
    [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-r\b|--recursive)/, 'rm -r/-rf is forbidden by the owner. Use `git rm` on specific files or delete single files.'],
    [/\bgit\s+push\b/, 'Do not push; the human pushes when ready.'],
    [/\bgit\s+reset\s+--hard\b/, 'git reset --hard is blocked. Use git restore on specific paths.'],
    [/\bgit\s+clean\s+-[a-z]*f/, 'git clean -f is blocked.'],
    [/\bsudo\b/, 'sudo is not allowed.'],
    [/(curl|wget)[^|]*\|\s*(ba)?sh/, 'Piping downloads to a shell is blocked.'],
  ];
  for (const [re, msg] of rules) {
    if (re.test(cmd)) { process.stderr.write(`BLOCKED: ${msg}\n`); process.exit(2); }
  }
  process.exit(0);
});
