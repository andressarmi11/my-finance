# Testing

## Unit tests (Vitest)

```bash
npm run test        # runs everything once
npm run test:watch  # modo interactivo
```

123 tests, all over `src/domain/` and the grouping logic in
`src/features/*/` — pure functions, with no need for a browser or a
real database. They cover, among other things:

- The 10 exact credit-card-cycle cases originally requested (Jan
  14/15/16/31, month changes, leap year, year change), plus a property
  test that checks the invariant ("payment is always after the
  cutoff") over 400 consecutive dates.
- Pay periods: exact boundaries (day 9, 10, 24, 25), month and year
  crossings, non-standard configurations.
- Each pay period's remainder and the month's leftover, verified
  against the real figures from the user's original spreadsheet.
- Recurrence: all 4 frequencies, respecting start/end date,
  idempotency, day clamping in short months.
- Supabase mappers (domain ↔ Postgres row), by round-trip.

## E2E tests (Playwright)

```bash
npx playwright install chromium   # once only
npm run test:e2e
```

8 flows, each on Chromium and on emulated iPhone Safari (16 tests
total):

1. Create an expense
2. Edit it
3. Delete it
4. Create a credit-card expense (and see the date preview before
   saving)
5. See the payment date on the Credit Card screen
6. Create a recurring expense and confirm it materializes
7. Create an income
8. View the Dashboard with sample data

They run against a real production build (`npm run build && npm run
preview`), not against the dev server — closer to what actually gets
deployed.

## What's NOT covered (on purpose)

- The notifications Edge Function (`supabase/functions/send-reminders`)
  has no automated tests — it's tested with the `curl` command
  documented in `docs/NOTIFICATIONS.md`. Automating it would require a
  Deno + local Supabase environment running in CI, which isn't worth
  the complexity for a ~100-line function.
- There are no integration tests against a real Supabase — the mappers
  (which is where the real bug risk lives for this kind of code) are
  tested; the repository's network calls aren't simulated with fake
  mocks, following the principle of not faking coverage that doesn't
  exist.

## CI

`.github/workflows/ci.yml` runs, on every push and PR: typecheck (of
`src/` and of `e2e/` separately), lint, unit tests, build, and the full
E2E tests with Chromium.
