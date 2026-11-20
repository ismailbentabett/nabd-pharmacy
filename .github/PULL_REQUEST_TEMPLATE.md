## Summary

<!-- What does this change and why? Link the issue or ADR if there is one. -->

## Screenshots or clip

<!-- For UI or motion changes: before and after, ideally from a release build on a real Android phone. -->

## Checklist

- [ ] `npm run check` passes locally
- [ ] Commits follow Conventional Commits (`feat:`, `fix:`, `perf:`, `test:`, `docs:`)
- [ ] RTL verified in both directions (English and Arabic), gestures and transitions included
- [ ] Reduce-motion setting honoured
- [ ] Accessibility labels and roles on new controls; touch targets at least 48 dp
- [ ] No per-frame JS: no `setState` in gesture or scroll handlers; only `transform` / `opacity` animated
- [ ] Any performance numbers come from a measured release build (device, OS, build type stated)
