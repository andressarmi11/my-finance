# Changelog

## [Unreleased] — Redesign v4, phase 7: reminders v2 (backend)

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 7; §9f
"Recordatorios v2"; pending 3, the schedule and the cron).

> **Deploy note:** run Supabase migration `0015_reminder_v2.sql` before
> deploying this version (the app always sends `settings.reminder`). Redeploy
> the Edge Function: `supabase functions deploy send-reminders --no-verify-jwt`.
> The migration also moves an existing reminder cron from every 15 to every
> 10 minutes; a new project gets that from `supabase/manual/0003_reminder_cron.sql`.

### Added
- `Settings.reminder` (the general reminder: `{ mode: 'days' | 'sameDay',
  days, time, sameDay: { kind: 'hours' | 'minutes' | 'at', value } }`).
  Absent = derived from `reminderDefaultDaysBefore` (N days before at 09:00),
  so nobody's reminders move.
- `domain/reminders/schedule.ts` gains `reminderInstant` (the instant in UTC,
  Colombia time UTC−5 with no DST: N days before at a time; same day N hours
  or minutes before the transaction's `time`, 09:00 if it has none; or at an
  exact clock time; `'none'` = no reminder), `generalReminderRule`,
  `effectiveReminderRule` (the transaction's own rule > the general one) and
  `planReminder` (what to write locally). `calculateReminderTime` is untouched,
  and with the default rule `reminderInstant` returns exactly the same instant
  (tested for 0–7 days across month, leap-year and year boundaries).
- Migration `0015_reminder_v2.sql`: `settings.reminder jsonb` (null or an
  object) and the cron rescheduled to `*/10 * * * *` by copying the existing
  job's command (no URL or secret in the migration; a no-op without pg_cron
  or without the job).
- `ReminderRuleEditor` (not mounted yet; Ajustes → Recordatorios mounts it):
  "Días antes | El mismo día"; days 1–7 and the time in half-hour steps; or
  1 hora antes · Horas antes [− 2 +] · Minutos antes [− 30 +] (steps of 5) ·
  A una hora exacta [8:00 a. m.]; a live notification preview ("GYM vence
  mañana · $ 100.000 · Salud · Débito") with the time it would arrive.
  Texts in ES and EN.

### Changed
- Saving a transaction schedules its reminder with `reminderInstant`, so the
  per-transaction chips from phase 4 now take effect. Choosing "Sin aviso"
  dismisses a still-pending reminder. Saving a transaction without changing
  when its reminder fires no longer re-arms one that was already sent.
- `send-reminders` Edge Function, now every 10 minutes:
  - Sends only reminders due in (now − 24 h, now]; older ones are never sent
    late.
  - Claims each chunk with a conditional update (`scheduled` → `sent`,
    `sent_at`, `updated_at`) and sends only what the update returned, so
    overlapping runs can't send one twice; the ones no device received end
    as `failed`. `updated_at` moves so the server's `sent` wins on sync.
  - Hard caps: 500 reminders per run, chunks of 100 ids, 10 s per push,
    10 pushes in flight, 60 s of claiming per run; it never calls itself —
    whatever is left waits for the next tick. It answers
    `{ sent, failed, deferred }`.
  - Limits and pure helpers live in `supabase/functions/send-reminders/policy.ts`.
- `supabase/manual/0003_reminder_cron.sql` schedules `send-reminders-every-10-min`
  and removes the old 15-minute job. Docs: `DEPLOYMENT.md`,
  `supabase/manual/README.md`, `docs/NOTIFICATIONS.md`, `docs/FINANCIAL_LOGIC.md`.
- Mappers carry `settings.reminder` (always sent, `null` when absent); the
  backup schema accepts it (optional, validated like the per-transaction one).

### Tests
- Unit: `reminderInstant` for every mode, month/leap-year/year boundaries,
  crossing midnight backwards, bad data, override precedence, and identical
  output to `calculateReminderTime` for the default rule; `planReminder`;
  settings mapper round-trips for each rule kind and for rows from before
  0015; backup schema; the editor's stepper/clock/preview helpers; the Edge
  Function's window, chunking, bounded concurrency, time budget and payload
  (`vitest` now also runs `supabase/functions/**/*.test.ts`).
- The reminder function skips a reminder whose transaction was paid or
  cancelled after it was scheduled: marked `dismissed`, no push sent.
## [Unreleased] — Redesign v4, phase 8: sign-in

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 8; §9f "Login y
registro", §9g 2d, §9h).

### Changed
- Sign-in screen (§9f), same auth logic (password sign-in, sign-up,
  `resetPasswordForEmail`, `translateError`, captcha token): left-aligned,
  no card; the 60px 1c logo tile; a big title per mode ("Hola de nuevo",
  "Crea tu cuenta", "Recupera tu contraseña") and a subtitle; the shared
  `Segmented` control for "Ya tengo cuenta | Crear cuenta" (still
  `aria-pressed`; the sign-up submit is now "Crear mi cuenta" so no two
  controls share a name); fields with the label above and a mail/lock icon;
  an eye button to show or hide the password; "¿Olvidaste tu contraseña?"
  right-aligned; the footer "Tus datos viven en tu teléfono y se respaldan
  en tu cuenta. Sin anuncios ni rastreo."
- The primary button stays disabled (grey) until the form is valid: a
  well-formed email, plus a password to sign in, or — to sign up — a
  password of at least 8 characters and the accepted terms.
- Turnstile renders with `appearance: 'interaction-only'`, inside a discreet
  row ("Verificación de seguridad lista · Cloudflare") that shows
  "Verificando…" until the token arrives.
- The recovery-link notice is translated (it was Spanish-only).

### Added
- Sign-up: a 4-segment strength meter and a required "Acepto los Términos y
  la Política de privacidad" checkbox, linking to `/legal/terminos` and
  `/legal/privacidad` (opened in a new tab so the form isn't lost).
- `components/ui/PasswordStrength`: `passwordStrength(pw)` → 0 empty ·
  1 "Muy corta" (< 8) · 2 "Débil" · 3 "Buena" · 4 "Fuerte", scored by length
  ≥ 12 and how many of lowercase/uppercase/digits/symbols it mixes; the
  `<PasswordStrength value>` meter (`role="meter"`).
- Desktop (≥ 1100px) split screen (§9g 2d, §9h): a brand panel with a
  typewriter headline ("Tu plata," + "quincena a quincena." ↔ "mes a mes.";
  "paycheck by paycheck." ↔ "month by month." in English; 80ms per letter,
  2s hold, 40ms deleting, blinking 4px cursor), a preview of Inicio's number
  on **sample data** labelled "Datos de ejemplo" that rotates every 3.4s
  through the four `DEMO_MONTHS` (`features/auth/demo.ts`) with
  `AnimatedNumber` (700ms, ease-out cubic), and three points (offline,
  privacy, no tracking). The form sits on the right at 400px. With
  `prefers-reduced-motion`, the first phrase is shown fixed and the card
  doesn't rotate. Phones and tablets get the form only.

### Tests
- Unit: `passwordStrength` levels.
- E2E updated: 28 (exact "Contraseña" label and "Entrar" button, now that
  the eye button is named "Mostrar contraseña"). New: 45 (tabs switch the
  title and never share a name with the submit button; sign-up disabled
  until email + password + terms; eye toggle; sign-in validity; forgot
  password sends the link with the captcha token; desktop split panel with
  "Datos de ejemplo", rotation and typewriter at 1280px; reduced motion;
  English). It runs in the `cloud-sync` project (the only build with the
  sign-in screen): `CLOUD_SYNC` in `playwright.config.ts` now also matches
  `login-redesign`.

## [Unreleased] — Redesign v4, phase 5: Análisis

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 5; §6, §9c;
pending 9 and 10).

### Changed
- Period selector is the shared segmented control (Quincena · Mes ·
  Trimestre · Año); the centred navigator stays under it.
- Hero: "Balance de {periodo}" at 50px (`+$` green / `−$` red) with
  "Ingresos $X · Gastos $Y" underneath.
- "Gastos por categoría" merges the balance bar and the donut: one stacked
  bar with 3px gaps and a row per category (avatar, amount, 5px bar, %).
  Tapping a row opens the category detail, which is what the donut did.
- "Débito vs. tarjeta" became "Por método de pago" with three slices
  (Débito, Crédito, Efectivo).
- Every card folds from its header, which shows a summary ("$ 2.029.900",
  "89% usado", "87% fijos", "100% débito"); the state is kept in
  `localStorage` (`analytics.collapsed`).
- Budgets as columns (§9c): biggest limit first, 84px wide; the dashed
  border is the limit (height proportional to it), the fill rises with the
  spend in the category's colour and overflows up to 114% in `--danger`;
  tapping a column opens Budgets. With none: a dashed card with "Definir".
- "Organizar gráficos": outline button, rows on `--paper`, a hidden row at
  45%.
- The category detail sheet had hard-coded Spanish (and a literal
  `{t('analytics.percentOfSpend')}` label); it's translated now.

### Removed
- "Ingresos vs. gastos" (the hero already says both) and the donut. Saved
  layouts are migrated: old ids map onto the new cards.

### Tests
- Unit: layout migration and folded cards, spend by method, short amounts.
- E2E updated: 25. New: 42 (balance hero, folding survives a reload, a row
  opens its detail, "Definir" goes to Budgets).

## [Unreleased] — Redesign v4, phase 4: the new-transaction sheet

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 4; §5, §9b;
pending 1 and 2, per-transaction reminder UI).

> **Deploy note:** run Supabase migrations `0013_currency_cash.sql` and
> `0014_transaction_reminder.sql` before deploying this version.

### Changed
- New-transaction sheet (§5, §9b), same fields and validation, new order:
  Cancelar · title · Guardar pill on top; the amount at 48px with its
  currency symbol small and grey; the concept centred; currency chips;
  category chips; Débito | Crédito | Efectivo (the card names show when a
  type has several) with the amber "Corte 15 · se paga el 2 nov" line; the
  date chip; reminder chips; instalments and the paid toggle behind "Más
  opciones". The sheet is as tall as its content (max: screen − 54px).
- "Contarle a la app": 72px mic, example phrases as chips, an "Entendí" card
  with the parser's reading, and the same category, currency and method
  chips to correct it. "Ajustar" opens the full sheet, "Guardar" saves.
- A row entered in another currency shows its original as a note
  ("$20 USD · tasa 4.000").

### Added
- Per-transaction currency (pending 1): COP · USD · EUR chips (from
  `settings.quickCurrencies`) plus "Más" (MXN, ARS, CLP, PEN); the chosen one
  stays as a chip. Outside the main currency, "≈ $ 80.000 COP · tasa de hoy
  4.000". The rate is **fetched, not typed**: today's market rate from
  open.er-api.com (no key, CORS), cached for the day and used offline with
  its date; with no network and no cached table, a foreign amount can't be
  saved. A saved transaction keeps its rate, so editing it never changes
  what it cost.
  `amount` is still the integer in the main currency
  (`Math.round(originalAmount * fxRate)`), so nothing in the domain changes.
- Types: `Transaction`/`RecurringRule` gain `currency`, `originalAmount`,
  `fxRate`; `Transaction` gains `time` and `reminder`; `Settings` gains
  `quickCurrencies`. Mappers (with round-trip tests) and the backup schema
  carry them.
- Migrations `0013_currency_cash.sql` (currency columns, quick currencies,
  `cash` re-asserted in the method type check) and
  `0014_transaction_reminder.sql` (reminder jsonb + time).
- "Efectivo" (pending 2) is seeded with the default methods on a new install.
- `domain/nlp`: "dólares / usd / euros" set the currency ("en efectivo"
  was already the cash method).
- Reminder chips per transaction: General · Sin aviso · 1 día antes · Mismo
  día · 1 h antes · Mismo día · 8:00 a. m. (the schedule itself: phase 7).
- `CurrencyChips`, `MethodPicker`, `ReminderChips`, `lib/currencies`,
  `lib/fxRates` (CSP `connect-src` allows `https://open.er-api.com`).

### Tests
- Unit: mapper round-trips (currency, reminder, quick currencies), currency
  helpers, NLP currency words, rate fetching (inversion, daily cache,
  offline fallback).
- E2E updated: 04, 05, 09, 11, 12, 14, 18, 19, 20. New: 41 (dollars in cash
  at today's rate, no rate field, offline blocks saving, "Más" currencies,
  quick entry with currency and method), with the rates API mocked.

## [Unreleased] — Redesign v4, phase 3: Inicio and Movimientos

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 3; §3, §4;
pending 6, 7 and 8).

### Changed
- Inicio (§3): its own header (logo + "Step up" and a compact month pill)
  replaces the global brand bar. Centred hero with no coloured card: "Hola,
  {name}. Te queda en {mes}", the amount at 56px with the `$` smaller and
  grey, and one line with the active pay period and what's left in it
  (replaces the period cards). The four flows sit in one card; "Falta pagar"
  opens its breakdown (the separate breakdown button and the two "Esperas…"
  cards are gone). "Falta este mes" gets a 19px title and "Ver todos"; a paid
  row shows its amount struck through.
- Movimientos (§4): "‹ Inicio" back link and "Seleccionar" on top, compact
  month pill; filter chips in `--text`/`--paper`; group headers (dot, name,
  range) outside the card, which only holds rows and "Restante".
- Calendar view: selected day in a 34px `--text` circle, today in `--q10`,
  dots for income / expense / card payment, and the day's net next to its
  date.
- `MonthNav` gains a `compact` pill variant; `Screen` a `backAction` slot.

### Added
- Folding period groups (pending 7): the header folds its group to "N mov. ·
  Restante $X", remembered per period key in `localStorage`. Groups read
  10 → 25; with one pay day there is a single month group.
- Selection bar (pending 6): floating above the tab bar with "N
  seleccionados · Todos · Pagado · Eliminar". The delete confirmation lists
  the transactions and their total; deletes keep recording tombstones so
  they sync.
- Date chip with a mini calendar in the new-transaction sheet (pending 8):
  "Hoy / Ayer / Mañana / 3 oct", month navigation, today ringed, the chosen
  day filled; a past date counts as paid, a future one stays pending with
  "Queda pendiente y te avisamos".
- `BigAmount` (one big number with a small grey symbol) and `MiniCalendar`.

### Removed
- The global `BrandBar`.

### Tests
- E2E updated: 08, 10, 12, 18. New: 08 ("Falta pagar" opens the breakdown,
  "Ver todos" → Movimientos → Inicio), 12 ("Todos", folding survives a
  reload), 40 (date chip: tomorrow stays pending).

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
