#!/usr/bin/env bash
# Repo hygiene gate before tagging a release.
set -u
bad=0
if [ -d .git ]; then
  leaked=$(git ls-files | grep -E '^_prep/' || true)
  [ -n "$leaked" ] && { echo "✖ private prep files tracked:"; echo "$leaked"; bad=1; }
  big=$(git ls-files | xargs -I{} du -k {} 2>/dev/null | awk '$1>1500{print}' || true)
  [ -n "$big" ] && { echo "⚠ large tracked files (>1.5MB):"; echo "$big"; }
fi
grep -rInE "\b(TODO|FIXME)\b|console\.log" app src 2>/dev/null | grep -v "lint-ignore" && { echo "✖ TODO/FIXME/console.log present"; bad=1; }
grep -rIlE "(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH) PRIVATE KEY)" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null && { echo "✖ possible secret"; bad=1; }
[ -f README.md ] || { echo "✖ README.md missing"; bad=1; }
# Numbers come only from the phone (CLAUDE.md). While PERF_LOG has unmeasured rows, the README must say so too:
# that is a warning (not ready to submit), not a failure. Once PERF_LOG is complete, a README that still says
# NOT MEASURED YET was not updated from it, and that fails.
if [ -f docs/PERF_LOG.md ] && grep -q "NOT MEASURED YET" docs/PERF_LOG.md; then
  echo "⚠ docs/PERF_LOG.md still has unmeasured rows: measure on a device before quoting numbers"
elif grep -q "NOT MEASURED YET" README.md 2>/dev/null; then
  echo "✖ PERF_LOG is complete but README still has NOT MEASURED YET: copy the numbers across"; bad=1
fi
[ $bad -eq 0 ] && echo "hygiene ok"
exit $bad
