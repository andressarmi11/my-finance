# Changelog

## [Unreleased] — Redesign v4, phase 2: navigation

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 2).

### Changed
- Tab bar (§2): three tabs — Inicio, Análisis, Ajustes — in a floating pill,
  with the + as a 62px circle beside it (same line, never over the list).
  Inicio stays active on `/movimientos`. The + still hides on scroll down and
  while a dialog is open.
- Calendar is no longer a screen: its body moved to `CalendarView`, shown by
  Movimientos behind a Lista | Calendario control that lives in the URL
  (`?vista=calendario`). `/calendario` redirects there.
- The legal footer left the app screens; it stays in the legal pages and in
  Ajustes → Legal.
- Main content, the selection toolbar and the sync indicator are spaced for
  the floating bar.

### Added
- `Segmented`: the single segmented control of the redesign (§0).

### Removed
- The floating refresh button over the +. Pull-to-refresh (home-screen app)
  and Ajustes → "Sincronizar ahora" remain.

### Tests
- E2E updated: 24 (plus: `/calendario` redirects), 25, 29 (no floating
  refresh; pull-to-refresh proves a real reload), 31, 32.
- New E2E 39: three tabs, Inicio lit on Movimientos, + beside the pill.

## [Unreleased] — Redesign v4, phase 1: foundations

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 1).

### Changed
- Dark theme tokens (§1): blacker paper (`#0B0D12`), new surfaces, lines and
  text greys. Accents and category colors unchanged.
- Logo 1c "S escalonada" (§9): five right-angled blocks with the amber accent.
  The tile is solid (`--brand-tile`), no gradient. `public/icons/*` and
  `apple-touch-icon.png` regenerated; manifest and `theme-color` follow the
  new dark paper.
- `Screen`: optional `back` link (`‹ label`) above a 32px title.
- Buttons filled with an accent use `--on-accent` (white in light, `--paper`
  in dark) instead of a hard-coded white; switch knobs use `--knob`.
- The category color picker offers the twelve `--cat-*` colors (stored as
  their portable hex, painted with the token). Analytics' fallback chart
  colors became the "no category" grey.

### Added
- Tokens `--radius-card`, `--tabbar-h`, `--hover`, `--on-accent`, `--knob`,
  `--brand-tile`, `--on-brand-tile`.
- `useBreakpoint()` (`phone` < 760 ≤ `tablet` < 1100 ≤ `desktop`) with tests.
- `docs/rediseno/`: the redesign plan and the prototype.

### Fixed
- E2E setup fixture: waited for the "Tu nombre" field to disappear, which
  raced with the Settings field of the same name on tests that start on
  `/ajustes`.

## [1.3.0] — Scheduling by voice, flexible budgets and recurring items

### Added
- Voice/Shortcut entries understand the future: "Pagaré 200 mil el 15 de
  noviembre", "Recibiré 300 mil el 15" are scheduled as pending on that date
  (the inbox shows "Programado · 15 nov" and a "Programar" button). "Recibiré"
  used to be classified as an expense.
- Budgets for several months at once (this month, 3 months, whole year or
  chosen months, amount per month), month navigation on the Budgets screen,
  and editing/removing a budget with a confirmation. Removing = amount 0, which
  syncs between devices by (category, year, month).
- Recurring items: advanced schedule behind "Más opciones" — every N months or
  weeks ("mes y medio" = 6 semanas) or specific months, with a preview of the
  next dates. Editing a recurring item now updates its pending future copies
  (paid and past ones keep their history; hand-edited values are kept).
  Deleting a recurring item asks for confirmation and removes its pending
  future copies.
- Supabase migration 0012: `custom` frequency and the interval/months columns.

### Fixed
- The + and refresh buttons now hide on scroll on every screen, Calendar
  included.
- Hard-coded Spanish in Calendar, Budgets, Recurring and the inbox moved to the
  dictionary (English everywhere).

### Known limitation
- Switching a recurring item's pattern back and forth doesn't regenerate the
  pending months removed in between; add them by hand. Planned for 1.3.1.

## [0.2.0] — Phase 2: financial logic + tests

### Added
- `domain/dates.ts`: a pure date kernel over the UTC epoch (never a local
  `Date`). Everything else in the domain goes through here to add/subtract
  months and days without time-zone bugs.
- `calculateCreditCardCycle(purchaseDate, cutoffDay, paymentDay)`: credit-card
  cutoff and payment, generic (not hard-wired to 2026 or to day 15/2). 15
  tests, including the 10 exact cases from the brief, the year boundary and
  the clamps.
- `calculateQuincena(date, startDays)`: the 10th and 25th pay periods (not
  halves of the month), with Q2 crossing the month boundary. 12 tests,
  including the "Rent" case (paid on October 1st, falls in September's 25th
  pay period).
- `calculateQuincenaBalance` / `calculateMonthBalance`: remainder per pay
  period and the month's leftover. **Checked against the real numbers from
  your spreadsheet**: Q1 remainder = $1,215,000, Q2 remainder = $1,167,006,
  leftover = $2,382,006.
- `calculateAvailableBalance`: available / committed / really free.
- `expandRecurringRule`: separates rule from instance for recurring expenses
  (monthly, weekly, biweekly, yearly), with an idempotent `periodKey`.
- `calculateBudgetStatus`: informs (ok / warning / exceeded), never blocks.

### Verified in this environment
- `npm test` → 64/64 tests passing.
- `npm run typecheck` → no errors.
- `npm run lint` → no errors.
- `npm run build` → production build successful.

### Fixed
- A bug in the TEST for `calculateCreditCardCycle` (not in the logic): the
  expectation assumed the payment lands in the same month as the cutoff; it
  actually lands the following month. Caught by running the suite for real.
- A type error in `parseISO` under `noUncheckedIndexedAccess`.

## [0.3.0] — Phases 3 to 12: complete local-first MVP

### Phase 3 — Transactions
- Full CRUD over IndexedDB (create/edit/delete/duplicate).
- A quick 4-field form (concept, amount, category, payment method;
  date=today by default), with a "paid on X" preview when a credit card is
  chosen, before saving.
- List grouped by pay period (`groupByQuincena`), with a one-tap
  paid/pending toggle.
- Sample data loadable from the empty state (made-up amounts, never the
  user's real ones).

### Phase 4 — Dashboard
- Really free / Available / Committed, both pay periods, the month's
  leftover, chips for pending/scheduled/card, and upcoming payments — all
  from `domain/`, with no calculations in the components.

### Phase 5 — Categories
- CRUD with icon and colour, and the visible month's spend per category in
  the list.

### Phase 6 — Income
- Covered by the Expense/Income toggle on the Phase 3 form; recurring income
  is handled in Phase 7.

### Phase 7 — Recurring
- CRUD for rules (fixed expenses and recurring income) kept separate from
  their instances. `materializeRecurringRules` generates the future
  instances when the app opens and when a rule is saved, never duplicating
  (protected by the unique index from Phase 1).

### Phase 8 — Hybrid credit card
- Each individual purchase, with its own payment day, and the total
  aggregated per cycle (`groupByCycle`) — the computed equivalent of "card
  purchase payment".

### Phase 9 — Calendar
- Monthly grid with per-day income/expense/card-payment indicators, and the
  selected day's detail.

### Phase 10 — Budgets
- Per category and month. It only informs (ok/warning/exceeded), never
  blocks.

### Phase 11 — Analytics
- Income vs. expenses (month/quarter/year), spend per category, fixed vs.
  variable, debit vs. card. Recharts split into its own chunk
  (`React.lazy`) so it doesn't inflate the initial load.

### Phase 12 — PWA + iPhone + data
- Manifest, service worker (`vite-plugin-pwa`), generated icons (192, 512,
  maskable, apple-touch-icon), iOS meta tags.
- A banner that detects Safari/iOS without the app installed and explains
  how to add it to the home screen (needed for the Phase 14 notifications to
  work at all).
- Export the full JSON and a CSV of transactions. Import a backup with Zod
  validation and a confirmation screen before replacing data.
- Fully editable Settings: currency, format, pay periods, card
  cutoff/payment, reminder days.

### Verified in this environment
- 91/91 tests, clean typecheck, clean lint, production build successful
  (with code-splitting: initial bundle ~150kB gzip, Analytics separate).

## [0.4.0] — Phases 15 to 17: E2E, deployment and final documentation

### Phase 15 — E2E testing
- 8 flows with Playwright (create/edit/delete an expense, a card expense +
  seeing its payment date, a recurring expense, income, the dashboard),
  running on Chromium and on iPhone Safari emulation — 16 tests in total.
- Its own `tsconfig.e2e.json`: `playwright test --list` doesn't really
  typecheck, and without this file `e2e/` never went through TypeScript in
  strict mode.
- Wired into CI (`.github/workflows/ci.yml`): it installs Chromium and runs
  the E2E suite against a real production build on every push.
- **An honest limitation of this development environment:** I couldn't run
  these tests myself — the Chromium binary downloads from
  `cdn.playwright.dev`, outside the sandbox's network allowlist. They were
  verified by a real typecheck and by `--list`, and will run for real on
  GitHub Actions.

### Phase 16 — Deployment
- `DEPLOYMENT.md`: a complete guide from zero — clone, push to GitHub,
  enable Pages, configure Supabase (optional), install on an iPhone, update,
  and troubleshoot the common problems.

### Phase 17 — Final documentation
- `docs/USER_MANUAL.md`, `docs/FINANCIAL_LOGIC.md`, `docs/NOTIFICATIONS.md`,
  `docs/TESTING.md`, `CONTRIBUTING.md` — all new. `docs/ARCHITECTURE.md` and
  `README.md` rewritten with the project's final state.
- The VAPID key generation command (`npx web-push generate-vapid-keys`)
  verified by actually running it in this environment, not just documented
  from memory.

### Verified in this environment (final state)
- 104/104 unit tests, clean typecheck (`src/` and `e2e/` separately), clean
  lint, production build successful.
- Initial bundle for a fully local user: ~59kB gzip (Recharts and
  Supabase-js code-split, loaded only if used).
