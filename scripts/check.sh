#!/usr/bin/env bash
# Quality gate. --quick: typecheck + pattern lint (and its self-test) + unit tests. --full: adds eslint, expo-doctor, hygiene.
set -uo pipefail
MODE="${1:---quick}"
fail=0
step() { echo; echo "▶ $1"; shift; if "$@"; then echo "✔ ok"; else echo "✖ FAILED: $*"; fail=1; fi; }
[ -f package.json ] || { echo "No package.json yet (scaffold first: bash scripts/bootstrap.sh)"; exit 0; }
step "typecheck" npx tsc --noEmit
step "pattern lint self-test" node --test scripts/lint-patterns.test.mjs
step "pattern lint" node scripts/lint-patterns.mjs
step "contrast (palette tokens)" node scripts/contrast.mjs --tokens
step "unit tests" npx jest --ci --passWithNoTests --maxWorkers=50%
if [ "$MODE" = "--full" ]; then
  step "eslint" npx expo lint
  step "expo-doctor" npx expo-doctor
  step "repo hygiene" bash scripts/repo-hygiene.sh
fi
echo; [ $fail -eq 0 ] && echo "ALL CHECKS PASSED ($MODE)" || echo "CHECKS FAILED ($MODE)"
exit $fail
