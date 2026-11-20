# AI DISCLOSURE (feeds README §"Where AI tools were used")

The brief allows AI tools with disclosure and asks the author to walk through and live-change any part of the code.
This file says plainly what the AI did, what the author did, and what the author still has to check. It is not a
marketing page: if a line below is not true at submission time, change it before you push.

## Tools
- **Claude Code** (Anthropic), run in an autonomous mode from `_prep/PROMPT_AUTONOMOUS.md`, with the project setup
  committed in `.claude/`: `CLAUDE.md` (hard rules), subagents (docs-verifier, motion-engineer, perf-engineer,
  rtl-i18n-engineer, ui-designer, qa-engineer, code-reviewer, readme-writer, interview-coach), skills and commands.
- No other AI tools, image generators or code generators were used. Product photos are picsum placeholders.

## What the AI did
The AI wrote nearly all of the code, tests and docs in this repository, under the author's brief, rules and ADRs:
- **Core**: the seeded catalog generator, the fake API (paging, 300–800 ms delay, 1-in-20 failures), integer-halala
  money and VAT split, the cart reducer and store with undo, and their tests (`src/core/*`, `src/state/*`).
- **Design system**: palette and tokens, type scale with the embedded IBM Plex fonts, `Text`, `PressableScale`,
  skeletons, shared UI (`src/design/*`, `src/ui/*`).
- **Motion**: spring and timing tokens, live reduced-motion, haptics vocabulary, gesture math, the hero transition
  engine, the bottom sheet, swipe-to-delete, the carousel and the collapsing header (`src/motion/*`, features).
- **Screens**: Home, Category, Product and Cart (`src/features/*`, `app/*`).
- **Tooling**: the structure-aware pattern linter and its self-test, `scripts/check.sh`, the brief-coverage gate,
  the perf scripts in `scripts/perf/*`, and the device runbook.
- **Docs**: ADRs (`docs/DECISIONS.md`), the plan, the requirements trace, this file and `README.md`.
- **Review**: separate AI "hostile reviewer" passes after each feature; their P0/P1 findings were fixed before commit.
  Several screens then got a second AI fix pass driven by those findings (for example the filter sheet's content drag,
  ADR-043, and the stale-draft bug, ADR-045, which has an end-to-end test that was checked to fail without the fix).
- **Design review**: a `ui-designer` agent reviewed screenshots and screens against `docs/DESIGN.md` and the AI then
  applied its fixes: spacing, directional icons (`src/ui/DirectionalIcon.tsx`), the discount tag, the rating row,
  the undo bar and the bottom sheet. The review was not run on a real phone, so the author must verify every one of
  these on the device, in English and Arabic, before relying on them.
- **Web preview pass**: the AI walked all four screens on Expo web in English and Arabic, gestures included, and
  fixed what it found: the first request failing on every launch (ADR-048), and the web-only language, direction,
  accessibility-focus and Best sellers issues (ADR-049). Web is not the target platform; none of this replaces the
  phone check.
- **Fonts on web and brand mark**: the AI made the web preview load IBM Plex (ADR-050), designed the Nabd mark (a lime disc
  carrying a pine pulse line, ADR-055), wrote `scripts/brand/make-icons.py` that draws every launcher, splash and favicon bitmap, and the matching
  `src/design/BrandMark.tsx` for the Home header (ADR-051). The author must check the launcher icon and splash on the phone.
- **Launch veil and logo skeletons**: the AI wrote `src/ui/LaunchVeil.tsx` (the splash carried into React and lifted
  with motion when the first screen lays out) and the brand-mark watermark in image skeletons, with their tests (ADR-052). The
  author must check on the phone that the swap from the native splash is invisible.
- **Dark mode**: the AI turned on the existing dark palette so the app follows the system scheme (ADR-053), checked
  all four screens, the filter sheet and the undo bar in dark on the web preview, and measured the dark text contrast.
  The author must check dark mode on the phone.

## Nabd portfolio version (the rebrand and the backend)
The take-home was rebranded into Nabd, a separate project, and extended. The AI did all of this under the
author's request, with a separate hostile-review pass before commit:
- **Rebrand** (ADR-055): name, palette, mark, icons and copy in both languages.
- **Supabase backend** (ADR-056): the optional client, schema, Row Level Security policies, seed generator
  (`scripts/supabase/make-seed.ts`) and migrations in `supabase/migrations/`. No Supabase project was created by the
  AI; the author creates one and runs the migrations.
- **Accounts** (ADR-056): email one-time-code sign-in, the session store and the Account tab.
- **Checkout and order history** (ADR-057): the server-priced `place_order` function and the offline in-memory orders.
- **Favourites** (ADR-058) and **search** (ADR-059), with their SQL mirrors.
- The author must run the migrations against a real Supabase project, sign in with a real email on the phone,
  place an order and check that it appears in the dashboard before claiming any of this works end to end.

## What the author decided
- The brief, the stack and the hard rules in `CLAUDE.md` (no per-frame React state, UI-thread animation,
  integer money, direction-agnostic code, release-build-only numbers, no fabricated numbers).
- Scope discipline: four screens, no extras; dark mode (stretch) only follows the system, no in-app switch.

## What the author must still do and confirm (not done by the AI)
These are open until the author ticks them. The AI could not do them: there was no phone attached.
- [ ] Read every file in `src/` and `app/` and be able to explain it (`_prep/LIVE_SESSION_PREP.md`).
- [ ] Run the release build on a real mid-range Android and feel every gesture, in English and Arabic.
- [ ] Take every performance number in `docs/PERF_LOG.md` personally, with the scripts in `scripts/perf/*`.
- [ ] Check the design-review fixes (spacing, `DirectionalIcon` arrows, discount tag, rating, undo bar, sheet) on the phone in both directions.
- [ ] Tune spring values on the device if anything feels off, and note what changed here.
- [ ] Have a native Arabic speaker proofread the copy (`docs/HUMAN_TODO.md` item 4 lists every key).
- [ ] Check every claim in `README.md` against the code and the phone, replace `<repo-url>`, and do the
      fresh-clone test (`docs/HUMAN_TODO.md` item 5).
- [ ] Rewrite this section in the first person once the above is done, saying what you changed by hand.

## Process safeguards
- Every library API was checked against the **installed** version (Reanimated 4.7, worklets 0.13, Gesture Handler 3.3
  hooks API, FlashList 2.3, expo-router 58) by a docs-verification step before code was written.
- `scripts/lint-patterns.mjs` rejects the known bad patterns (`runOnJS`, the Gesture Handler 2 builder API,
  `.value` on shared values, state setters inside worklets, layout props in animated styles, raw hex, `left/right`).
- `scripts/check.sh` (typecheck, pattern lint, unit tests; `--full` adds expo lint, expo-doctor, brief coverage and
  repo hygiene) must be green on every commit.
- No metric in the README or `docs/PERF_LOG.md` comes from the AI. Unmeasured cells say NOT MEASURED YET.
