---
description: Phase 3–5 — build one task from docs/PLAN.md end to end with gates. Usage: /build <task-id>
argument-hint: task id from docs/PLAN.md
---
For task `$ARGUMENTS`: (1) re-read the relevant `docs/PLAN.md` task and skills; (2) `docs-verifier` for APIs; (3) implement with the right specialist agent(s) (parallel where independent); (4) tests (`qa-engineer`); (5) run `scripts/check.sh --quick` and paste output; (6) `code-reviewer` on the diff, fix all P0/P1; (7) `ui-designer` review from a screenshot in LTR + RTL; (8) update `docs/PLAN.md` status and `docs/AI_DISCLOSURE.md`; (9) conventional commit. Report: what changed, evidence, next task.
