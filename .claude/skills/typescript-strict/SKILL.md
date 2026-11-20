---
name: typescript-strict
description: TypeScript strictness and domain typing rules (branded money, discriminated unions, typed i18n keys, typed routes). Load when defining types or fixing type errors.
---
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` where practical, `noImplicitOverride`. No `any`, no non-null `!` without a comment; prefer `unknown` + narrowing.
- Domain types in `src/core/types.ts`: `Product`, `CategoryId` (string-literal union), `Locale = 'en'|'ar'`, `Centimes` for integer money (1 DA = 100 centimes) so DA floats can't leak into logic.
- Discriminated unions for async/UI state (`{status:'loading'}|{status:'error',error}|{status:'ok',data}`), not boolean soup.
- Typed i18n keys derived from the English dictionary (`keyof typeof en`), params typed per key where feasible.
- Typed Expo Router routes (`experiments.typedRoutes`); no string-concatenated hrefs.
- Exhaustive `switch` with `assertNever`.
- Export types from the module that owns them; no circular type imports.
- Run `tsc --noEmit` in `check.sh`; zero errors, zero suppressions without justification.
