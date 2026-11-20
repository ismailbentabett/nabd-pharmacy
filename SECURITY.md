# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's private vulnerability reporting:
go to the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue or pull
request for a security problem.

Include what you found, the steps to reproduce it, and the impact you expect. You will get a reply on the
advisory thread. Once a fix is ready, the advisory is published with credit to the reporter unless you ask
otherwise.

## Supported versions

Only the latest commit on `master` is supported. There are no maintained release branches.

## How the app handles secrets

- By default the app runs on a local fake backend and needs no keys at all.
- When Supabase is enabled, the app is built with two public values: `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Expo inlines `EXPO_PUBLIC_*` variables into the app bundle, so treat both as
  public. Anyone with the APK can read them.
- The anon key grants nothing by itself. **Row Level Security is the security boundary**: every table has RLS
  enabled and policies decide what a signed-in or anonymous user can read or write (see
  `supabase/migrations/20261120000200_rls.sql`). Writes that must be atomic, such as placing an order, go through
  database functions rather than direct table access.
- The Supabase service-role key must never be put in the app, in `.env` for the app build, or in the repository.
  If it ever ships in a build, rotate it immediately.
- Never commit `.env` or any `.env.*` file except `.env.example`. They are git-ignored; keep it that way.

## Out of scope

The app takes no real payments; orders are placed without a payment step. Reports about the fake backend's deliberate failures
(1 request in 20 fails on purpose in demo builds) are not security issues.
