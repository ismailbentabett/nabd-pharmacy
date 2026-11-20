---
name: maestro-e2e
description: Maestro flows for smoke and perf runs (scroll grid, add to cart, RTL toggle). Load when authoring flows in scripts/perf/flows.
---
Flows are YAML: `appId`, `launchApp`, `tapOn` by text/id, `scroll`, `swipe`, `assertVisible`, `repeat`. Use `testID`s defined in one `src/testIds.ts`. `scroll-grid.yaml` performs repeated down/up swipes for the Flashlight run; `smoke.yaml` covers tabs → category → product → add → cart totals; `rtl.yaml` toggles Arabic and asserts mirrored elements. Keep flows deterministic (fake API test mode off; wait for visible).
