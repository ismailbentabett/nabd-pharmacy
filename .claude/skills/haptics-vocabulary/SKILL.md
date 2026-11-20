---
name: haptics-vocabulary
description: Single haptics table and wrapper (expo-haptics) so feedback is consistent. Load when adding haptics.
---
`src/motion/haptics.ts` exports `tap()` (selection: tab, stepper, chip), `confirm()` (impact light: add to cart, sheet snap), `warn()` (notification warning: delete threshold crossed), `success()` (notification success: optional on added). All no-op on unsupported devices, never throw, call from JS via `scheduleOnRN` from worklets, rate-limit to 1 per 60 ms. Not tied to reduced motion setting.
