---
description: Phase 2 — run one time-boxed spike (hero | rtl | grid). Usage: /spike hero
argument-hint: hero | rtl | grid
---
Run spike `$ARGUMENTS` with its acceptance criteria from `docs/DECISIONS.md` (ADR-004 hero, ADR-005 rtl) or `docs/PERF_PLAN.md` (grid baseline: 1,000 tiles, sized images, release build, gfxinfo). Use `docs-verifier` first, then `motion-engineer`/`rtl-i18n-engineer`/`perf-engineer`. Time-box strictly (hero 3 h, rtl 1.5 h, grid 1 h). Throwaway code lives in `spikes/<name>/` (deleted before ship via `git rm`). Output: verdict (pass/fail per criterion with evidence), decision, and update the ADR status. Ask the human to verify on the real phone when needed.
