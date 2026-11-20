---
description: Full quality audit across code, design, RTL, a11y, perf patterns, and requirements. Read-only report.
---
Run in parallel: `code-reviewer` (diff vs rubric), `ui-designer` (screens LTR+RTL, anti-slop), `rtl-i18n-engineer` (matrix), `perf-engineer` (static audit + patterns), `qa-engineer` (coverage). Also run `node scripts/lint-patterns.mjs`, `scripts/check.sh --full`. Merge into one ranked P0/P1/P2 list with file:line and owner agent. Do not fix in this command.
