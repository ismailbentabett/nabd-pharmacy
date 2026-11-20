# Al-dawaa mobile take-home

A React Native (Expo SDK 58) recreation of four Al-dawaa shopping screens with a bottom tab bar. Android is the
target platform. All data is local: 1,000 products from a fixed seed behind a fake API (pages of 20, 300-800 ms
delay, about 1 in 20 requests fail). English and Arabic; Arabic flips the whole app to RTL, including swipe and
transition directions.

**Try it:** download the APK from [Releases](https://github.com/ismailbentabett/al-dawaa-takehome/releases/latest)
and install it on an arm64 Android phone (allow installs from unknown sources). **Read it:** the
[explainer PDF](docs/presentation/al-dawaa-explainer.pdf) walks through every screen, decision and open item.

- **Home** (H-01..H-04): search header that collapses into a compact bar on scroll, auto-playing banner carousel with a page
  indicator (pauses on touch), category rail, best-sellers rail.
- **Category** (C-01..C-03): two-column virtualised grid of 1,000 products, images fade in once from a colour placeholder, and a
  filter and sort bottom sheet that follows the finger and snaps open or closed.
- **Product** (P-01..P-03): shared-element transition (the tile image grows into the gallery and returns on back, back can be
  driven by a swipe), swipeable gallery with page indicator, add-to-cart feedback that bumps the cart badge.
- **Cart** (K-01..K-04): items animate in and out and the list closes the gap, swipe to delete with undo, quantity stepper,
  subtotal, 15% VAT line and total in SAR.
- **Finish:** launch screen with the brand mark, skeletons for every loading state, designed empty and error states,
  reduce-motion variants, and dark mode that follows the system (G-10 stretch).

## Screenshots

These are captured from the **Expo web preview** at phone size, not from a phone. They show layout, copy and RTL;
they say nothing about motion or performance.

| Home | Category | Filter & sort | Product | Cart |
|---|---|---|---|---|
| ![Home](docs/presentation/img/en-home.jpg) | ![Category](docs/presentation/img/en-category.jpg) | ![Filter and sort sheet](docs/presentation/img/en-filter.jpg) | ![Product](docs/presentation/img/en-product.jpg) | ![Cart](docs/presentation/img/en-cart.jpg) |

| Category (Arabic) | Product (Arabic) | Cart (Arabic) |
|---|---|---|
| ![Category in Arabic](docs/presentation/img/ar-category.jpg) | ![Product in Arabic](docs/presentation/img/ar-product.jpg) | ![Cart in Arabic](docs/presentation/img/ar-cart.jpg) |

## Run it

### Option A: install the prebuilt APK

Download `al-dawaa-v1.0.0-demo-arm64.apk` from the
[latest release](https://github.com/ismailbentabett/al-dawaa-takehome/releases/latest), then:

```bash
adb install -r al-dawaa-v1.0.0-demo-arm64.apk
```

It is a **release** build (Hermes, minified, no dev menu) in demo mode, so about 1 in 20 requests fail and you can
see the error and retry states. It is signed with the debug key and built for arm64-v8a only.

### Option B: build from source

Needs Node 20+, a JDK and the Android SDK, and an Android phone with USB debugging on. Expo Go is not supported
(ADR-001): this is a native build.

```bash
git clone https://github.com/ismailbentabett/al-dawaa-takehome.git aldawaa && cd aldawaa   # 1
npm ci                                                                                       # 2
bash scripts/perf/android-release-build.sh                                                   # 3: builds the release APK and installs it on the USB phone
```

That is 3 commands. The first native build takes several minutes (8 min 23 s on one Windows PC, ADR-040).

- **Windows:** the native build needs a project path of 5 characters or fewer, so clone with
  `git clone https://github.com/ismailbentabett/al-dawaa-takehome.git C:/ad` and run the rest from `C:/ad`.
  The script checks this and prints the exact command if the path is too long (ADR-040).
- **Demo build (for the video):** add `--demo` to command 3 to keep the 1-in-20 failures visible. The default
  build turns failures off so a 10 s fling never stops on an error row.
- **Build without a phone:** `PERF_NO_DEVICE=1 bash scripts/perf/android-release-build.sh` builds the APK and skips the install.
- **Dev build with hot reload:** `npm run android` (runs `expo run:android`, a debug build, then Metro). Debug
  builds are slower and are not used for any number below.
- **Web preview (layout only):** `npx expo start --web`. Useful for a quick look; it is not the target platform.
- **Tests and type check:** `bash scripts/check.sh --quick` (typecheck, pattern linter and its self-test, Jest).
  `--full` adds expo lint, expo-doctor, brief coverage and a repo hygiene check.

## Structure

```
app/                  Expo Router: (tabs)/ index, category, cart, plus product/[id]
src/core/             Seeded catalog generator, image URL sizing, fake API, integer-halala money, seeded RNG
src/state/            Cart store (zustand, MMKV), cart maths (VAT split), TanStack Query client, API wiring
src/motion/           Spring tokens, gesture maths, haptics, reduced-motion; hero/ = shared-element engine
src/ui/               Shared UI: tab bar, bottom sheet, badge, stepper, price block, image, skeleton, states
src/features/home     Header, carousel, rails
src/features/category Grid, tile, filter/sort sheet, paging hook
src/features/product  Gallery, add-to-cart bar and fly-to-cart motion, product body
src/features/cart     Swipe rows, list with layout animations, summary, free-delivery bar
src/i18n/             Typed EN/AR dictionary, plurals, number formatting, direction (the only place that reads I18nManager)
src/design/           Palette, tokens, type scale, fonts, Text, PressableScale, brand mark
tests/                Jest + React Native Testing Library
scripts/              check.sh, pattern linter, brief coverage, perf/ (build, cold start, gfxinfo, memory, Flashlight)
docs/                 ADRs, plan, specs, requirements trace, perf log, AI disclosure
docs/presentation/    Explainer PDF, the script that generates it, web-preview screenshots
brief/                The take-home brief (PDF) and its structured copy with requirement IDs
.claude/              The subagents, skills and commands used to build this (see "Where AI tools were used")
```

## Main decisions

Full list with reasons: [`docs/DECISIONS.md`](docs/DECISIONS.md). Requirement-to-code map: [`docs/REQUIREMENTS_TRACE.md`](docs/REQUIREMENTS_TRACE.md).

- Shared-element transition is a custom measured-rectangle overlay driven by one shared progress value, so a
  swipe can drive it and a touch can interrupt it (ADR-004), with its own spring tuned to settle under 320 ms (ADR-030).
- RTL uses the native layout flip plus an app reload, so Yoga, FlashList order, text alignment and system back all
  mirror together (ADR-005). The language is derived from the native direction, never stored separately (ADR-031).
- The cart is kept in MMKV and read before first render, so it survives the language restart (ADR-031, ADR-003).
- Money is integer halalas everywhere; floats appear only when formatting (`docs/CART_SPEC.md`, `src/core/money.ts`).
  Prices include VAT, so the VAT line is `total × 15 / 115`, rounded once.
- The grid and rails use FlashList v2; grid images are requested at a bucketed display size, not 800 px (ADR-007, ADR-008).
- The cart is a plain ScrollView, because layout animations are only safe in non-recycled lists (ADR-007).
- Gestures use the Gesture Handler 3 hooks API; animation runs on the UI thread with Reanimated shared values and
  worklets, with no per-frame React state (ADR-001, ADR-036).
- A pattern linter fails the build on `runOnJS`, state setters in worklets, layout props in animated styles,
  physical left/right, raw hex and similar (ADR-036).
- Cart swipe rows share one `openRowId` shared value, so only one row is open and no row re-renders (ADR-041).
- Product back is finger-driven two ways, both scrubbing the same hero progress as the Back button: a horizontal
  swipe on the page body and a pull-down on the gallery while the page is at the top. Android Back runs the same
  close. There is no edge strip ([ADR-046](docs/DECISIONS.md)).
- The hero also animates `borderRadius`, an exception to "transform and opacity only", so the image does not show
  sharp corners leaving a rounded tile. Its GPU cost is **NOT MEASURED YET**; the F-04 trace decides whether it
  stays ([ADR-047](docs/DECISIONS.md)).
- Release builds for measurement turn the fake API's failures off by build-time switch; `--demo` turns them on (ADR-040).
- One brand mark serves the launcher icon, splash, favicon and Home header; a launch veil lifts once the first
  page is ready (ADR-051, ADR-052).
- Dark mode follows the system by re-mapping the same tokens (ADR-053).
- The favourite heart is deliberately not on `main` ([ADR-014](docs/DECISIONS.md)).

## Performance

Nothing has been measured on a phone yet. Every cell below is copied from `docs/PERF_LOG.md`, which holds the
raw evidence paths once runs exist. Honest misses will be written down as misses.

| Field | Value |
|---|---|
| Device model | NOT MEASURED YET |
| Android version / build | NOT MEASURED YET |
| Build type | NOT MEASURED YET (planned: release APK from `scripts/perf/android-release-build.sh`) |

| ID | Metric | Target | Result |
|---|---|---|---|
| F-01 | Janky frames, 10 s grid fling (warm cache) | < 1 % | NOT MEASURED YET |
| F-01 | Same, cold (unwarmed) | report | NOT MEASURED YET |
| F-01 | Avg UI FPS (Flashlight) | >= 58 at 60 Hz | NOT MEASURED YET |
| F-04 | Hero transition janky frames / duration | 0 janky, <= 350 ms | NOT MEASURED YET |
| F-07 | Cold start TotalTime (median of 10) | < 2000 ms | NOT MEASURED YET |
| F-07 | Time to first product visible | report | NOT MEASURED YET |
| F-08 | PSS after pass 1 to pass 2 | flat (+-8 %) | NOT MEASURED YET |
| F-03 | Touch feedback latency | <= 100 ms | NOT MEASURED YET |
| F-05 | Tile re-renders on add-to-cart | 0 | NOT MEASURED YET |

How they will be measured: a release build on a real mid-range Android phone, using `scripts/perf/cold-start.sh`,
`gfxinfo-fling.sh`, `transition-gfxinfo.sh`, `memory-scroll.sh` and `flashlight.sh`. Protocol: `docs/PERF_PLAN.md`.
Raw output goes to `docs/evidence/raw/`. Simulators, emulators and debug builds are not used for any figure.

## Tests

Run with `bash scripts/check.sh --quick` (or `npm test` for Jest alone). 652 tests pass. Jest covers:

- Cart quantities, totals and the 15% VAT split against the vectors in `docs/fixtures/cart-vectors.json`, plus the store and undo.
- Catalog determinism (same seed, same 1,000 products) and the fake API (paging, delay, failures).
- i18n: EN/AR key and placeholder parity, plurals, number formatting.
- Gesture and motion maths: sheet snapping, hero geometry, swipe, carousel, header, fly path, spring settle times.
- Screen and component tests for Home, Category (including the sheet), Product, Cart, tab bar and badge.

What Jest cannot cover (for example one swipe row closing another, because Reanimated's mock never runs
`useAnimatedReaction`) is on the device checklist.

## Where AI tools were used

Claude Code wrote nearly all of the code, tests and docs, working from my brief, my hard rules in `CLAUDE.md` and
the ADRs. That covers the core data and cart logic, the design system, the motion layer and hero engine, the four
screens, the linter, the perf scripts, this README and the explainer PDF. Separate AI reviewer passes ran after
each feature, and a `ui-designer` agent reviewed the screens against `docs/DESIGN.md`; the fixes it led to
(spacing, directional icons, discount tag, rating, undo bar, sheet) have not yet been checked by me on a phone.
Library APIs were checked against the installed versions before use. No other AI tool was used. I set the brief,
stack and rules, and kept scope to four screens. I have not yet finished reading every file or tuning on a device;
the open items are listed in `docs/AI_DISCLOSURE.md`, and that file is the full account. Subagents, skills and
commands are committed in `.claude/`.

## What we would do next

- Favourite heart: one animated heart shared by the grid tile and the product page. `main` leaves the seam on
  purpose. The plan ([ADR-014](docs/DECISIONS.md)) is a per-id selector store, like the cart store, read by `ProductTile` and the
  product page so a tap updates only the hearts for that id.
- Run the device measurements, fix what they show, and fill `docs/PERF_LOG.md`, including honest misses.
- Add a Baseline Profile for cold start, then tune the spring tokens on the phone (ADR-006).
- An in-app light/dark override (today the app follows the system).
- TalkBack audit and font-scale 1.3x check on device.
- End-to-end flows in CI (Maestro flows are in `scripts/perf/flows/`).
