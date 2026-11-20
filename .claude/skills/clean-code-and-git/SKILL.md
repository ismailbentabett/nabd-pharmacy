---
name: clean-code-and-git
description: Code quality (naming, size, cohesion, comments) and git hygiene (conventional commits, small commits, clean history). Load when writing/reviewing code or committing.
---
- Names say intent (`selectCartCount`, `useDirection`, `snapToNearest`). Functions ≤ ~40 lines, files ≤ ~250, one responsibility. No magic numbers: named constants or tokens. Comments explain *why* (and "how it works" headers on gesture files), never what.
- Dead code, TODOs, console logs, commented code: none at ship. Consistent file naming (`PascalCase.tsx` components, `camelCase.ts` modules, `*.test.ts`).
- Module boundaries per `docs/ARCHITECTURE.md`; no feature→feature imports; no cycles (`madge` optional).
- Errors typed and mapped to friendly copy; never show raw error text.
- Git: conventional commits (`feat(cart): …`), each commit builds + passes `check.sh --quick`; no giant "initial commit"; no secrets; no `rm -rf`; never push without being asked; final history readable by a stranger (rebase/squash noise only with the human's OK).
- Commit trailers per the environment's attribution reminder.
