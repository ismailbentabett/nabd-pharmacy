---
name: motion-ux-principles
description: Motion design principles: purpose, timing, easing/spring choices, choreography, staggering, restraint. Load when deciding how something should move.
---
Purpose first: orient (where from/to), confirm (action registered), focus (what's new), delight sparingly. Durations: micro 100–150, standard 200–250, large/hero ≤ 320 ms (budget < 350). Prefer springs for spatial/gesture motion, short ease-out timing for opacity. Entrances decelerate, exits accelerate and are shorter. Choreograph parallel, not sequential (add-to-cart: press → morph → fly → badge bump all ≤ 400 ms total). Stagger ≤ 30 ms × ≤ 6 items, never in recycled lists. One focal motion at a time. Velocity continuity on gesture release. Motion must never delay the task. Provide reduced-motion alternative for each. Tokens in `src/motion/springs.ts` (docs/DESIGN.md §6).
