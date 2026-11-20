---
name: security-and-hygiene
description: Repo and app hygiene: no secrets, no private prep material in the repo, dependency sanity, licenses, Supabase key handling. Load before commits and ship.
---
`_prep/` and `.env` are gitignored and must never appear in `git ls-files`; only `.env.example` is committed. `.claude/` and CLAUDE.md are committed deliberately (AI transparency) — check they contain no personal data, emails, tokens. Only the Supabase **anon** key ever ships in the app (it is public by design; RLS is the security boundary). The service-role key never leaves `supabase/` tooling and is never in `EXPO_PUBLIC_*`. No real pharmacy trademarks or logos; Nabd and all product brands are fictional. `npm ls` clean, no unused deps (`npx depcheck`). Lockfile committed. LICENSE not required. Android: no debug flags in release, `usesCleartextTraffic` false (picsum is https).
