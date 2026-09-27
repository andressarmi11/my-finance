# Project context

> This file is read at the **start of each phase**. It's the memory between sessions.

## What it is
A personal finance app for Colombia (COP). Replaces a spreadsheet
organized by pay periods (quincenas — the two paydays most Colombian
salaries run on, the 1st–15th and the 16th–end of month). Complete
local-first MVP (Phases 1-12); Supabase, notifications, E2E, and final
documentation are left for Phases 13-17.

## Non-negotiable business rules

1. **Pay periods starting on the 10th and the 25th**, configurable.
   The pay period starting on the 25th crosses the month boundary and
   ends on the 9th of the following month (confirmed and tested
   against the user's real spreadsheet).
2. **Hybrid credit card**: each purchase is shown individually with
   its own payment date, and also aggregated by cycle
   (`groupByCycle`) — the calculated equivalent of "Pago compras TC"
   ("credit card purchase payment") from the spreadsheet.
3. **Configurable card cutoff and payment day**, editable from
   Settings. Changing the value doesn't rewrite purchases already
   made (they keep their original payment date in
   `cyclePaymentDate`).
4. **Three visible remainders**: the pay period starting on the 10th,
   the one starting on the 25th, and the month's leftover (= the sum
   of the two remainders).
5. **Money = integer. Business dates = 'YYYY-MM-DD' string.** Never a
   `Date` with a time component in `domain/` — everything goes through
   `domain/dates.ts` (a kernel over the UTC epoch).
6. **Zero calculations in JSX.** Everything lives in `src/domain/`,
   with no React or Dexie.
7. **Budgets inform, never block.**
8. **A recurring rule is never duplicated**: protected by the unique
   index `[recurringRuleId+periodKey]` in Dexie, not only by the logic
   in `expandRecurringRule`.

## Architecture (reminder)
```
UI (React)  ->  hooks  ->  domain (TS puro)  ->  Repository (interfaz)
                                                   |- LocalRepository (Dexie) — Fases 1-12
                                                   |- SupabaseRepository — Fase 13
```

## Decisions made
- Local-first (IndexedDB) in phases 1-12. Supabase comes in Phase 13,
  and with the repo public on GitHub Pages, **Auth stops being
  optional**: without login, the public `anon key` would expose a
  table readable by anyone.
- GitHub Pages with a public repo. `base: '/step-up/'` in vite.config.ts.
- Notifications: there are no scheduled local notifications on Safari
  iOS. The scheduler lives on the server (pg_cron -> Edge Function ->
  Web Push), pending implementation in Phase 14.
- Recharts (for Analytics) was split into its own chunk with
  `React.lazy`: it weighs ~115kB gzipped and must not be part of the
  app's initial load.

## Status
Phases 1-12 finished and verified in this environment: 91/91 tests,
clean typecheck, clean lint, successful production build, installable
PWA (manifest + service worker generated). Next: Phase 13 (Supabase).

Infrastructure note: in this working environment, `node_modules` has
to live on local disk (not on the network mount at
`/mnt/user-data/outputs`), or `npm install` hangs or corrupts packages.
The project is developed at `/home/claude/work/step-up` and copied to
outputs without `node_modules` at the end of each batch of phases.
This doesn't affect the user: on their machine or on GitHub Actions,
`node_modules` runs on normal disk with no such problem.
