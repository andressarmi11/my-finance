# Changelog

Versions follow [Semantic Versioning](https://semver.org): MAJOR for a
change that breaks existing data or flows, MINOR for new features, PATCH
for fixes only. `package.json` holds the version; the app shows it in
Ajustes and the legal pages. Each change goes under `[Unreleased]` and,
when released, moves to its version with the date.

## [Unreleased]

## [1.7.1] — 2026-10-03

### Fixed
- Phone tab bar: fixed practically at the bottom edge (into the home
  indicator area) instead of 12px above it, and every phone screen now
  scrolls at least 1px, so iOS no longer leaves the bar floating above the
  bottom on a short Inicio.

## [1.7.0] — 2026-10-03

Ready for App Store and Google Play review: both require deleting the
account from inside the app, and a privacy policy that matches what the
app does.

### Added
- **Eliminar cuenta** (Ajustes → Perfil): lists what gets deleted, offers
  "Exportar mis datos antes", asks for the password again (and the
  captcha), then deletes the account and every row it owns, wipes this
  phone and returns to the login with "Tu cuenta y sus datos fueron
  eliminados." Needs migration `0021_delete_account.sql` (the
  `delete_account()` RPC; every table already cascades from `auth.users`).

### Fixed
- Privacy policy: it said "No hay más terceros", but sign-in uses
  Cloudflare Turnstile and today's rates can come from ExchangeRate-API.
  Both are listed now, with what they receive.
- Privacy policy and terms: they said the app works in full without an
  account; the published app requires one. They now say so, and explain
  how to delete the account (in the app, or by email).
- Cookie policy: notes that the Cloudflare check runs from Cloudflare's
  domain under its own policy.

## [1.6.2] — 2026-10-03

### Fixed
- Por revisar: the concept takes spaces again ("Transferencia de…"); it was
  trimmed on every keystroke. It's trimmed only when it's saved.
- Por revisar: after Anotar, the "Deshacer" toast no longer covers
  Descartar and Anotar on the next entry; the sheet makes room for it.
- Inicio (iPhone): marking the last "Falta este mes" while scrolled down
  could leave the tab bar floating above the bottom. The scroll is re-set
  when the page gets shorter so iOS places it again.

## [1.6.1] — 2026-10-01

### Fixed
- Ayúdame a ahorrar: the pace note no longer says "la línea blanca" (in
  light mode the mark is dark): "La marca vertical muestra dónde deberías
  ir hoy". Amounts in the plan keep "$" and the figure on the same line.

## [1.6.0] — 2026-10-01

Ayúdame a ahorrar. Plan: `docs/presupuestos/PRESUPUESTOS-Y-AHORRO.md`
(part B, checklist and decisions there). Prototype:
`docs/presupuestos/Step Up Rediseno.dc.html` (1a, 3a).

### Added
- **Ayúdame a ahorrar**: from Análisis (a card under the balance) or
  Ajustes → Presupuestos (the dashed green button). On the phone a full
  screen from the right, over the tab bar, in three steps:
  - **Tu plan**: "Puedes ahorrar $X más al mes", the start pill, "Cómo
    quedaría tu plata" (Fijos, Día a día, Ya ahorras, Plan, Libre),
    "Dónde recortar" with "Promedio A → tope B" and, on tap, the why from
    the user's own data (deliveries, rides, above average, a one-off,
    the priciest subscription, the biggest spends), and "No se tocan".
  - **Personalizar**, live: a monthly amount (±50 mil, "Lo máximo sensato
    hoy") or a goal (name, ±500 mil, "la cumples en N meses");
    Suave/Equilibrado/Intenso (10/20/30 %); ¿Cuándo empieza? (este mes,
    próxima quincena, próximo mes, otro hasta 14 meses); duration in days,
    weeks (limits also per week), months or a year, or "Hasta cumplir la
    meta"; each category "Se puede ajustar" / "No tocar" (Hogar is Fijo,
    Salud starts as No tocar).
  - **Listo**: the limits and the goal created.
- Desktop: a page inside Análisis, the plan on the left (whys always
  visible, as a table) and Personalizar as a sticky panel on the right.
  Análisis in two columns: the plan card beside Presupuestos.
- With a plan: "Plan de ahorro · Quincena/Mes/Trimestre/Año" in Análisis,
  the period's goal, what's saved with a white pace line, each category
  against its limit (ahead of pace in --q25, named in the note), the
  quarter's coverage or the projection to December; before the start or
  after the end, it says so.
- Eliminar plan (with confirmation): budgets back to how they were
  before the plan (snapshot), movements untouched, toast "Plan eliminado".
  At the end date: "¿Renovar o terminar?" in Análisis and one local
  notification.
- Engine `src/domain/savings/plan.ts` (pure): 3-month averages without
  outliers, fixed categories and "No tocar" never cut, floors (groceries
  without deliveries, bus without rides…), cap by intensity × weight,
  rounded to 10.000 COP / 10 USD, the warning when asking for more than
  is sensible, and no cut without data behind it. `progress.ts` reads a
  plan against a period; `apply.ts` writes and restores its budgets.
- `SavingsPlan` in Dexie (v5) and Supabase: migration
  `0020_savings_plans.sql`. Until it runs, the plan stays on the device.
- A generic toast for one-line confirmations.

### Tests
- Unit: `plan.ts` (fixed/locked, floors, over, goal months, outliers,
  reasons, rounding), `progress.ts`, `apply.ts` (snapshot, update,
  restore).
- E2E 50-help-me-save: phone flow (Entretenimiento No tocar, Intenso, a
  3M goal → Crear → Presupuestos → Análisis → Año → Eliminar restores),
  the "too much" warning, no history, desktop page, English. E2E 48 also
  sweeps /analisis/ahorrar.

## [1.5.0] — 2026-10-01

Presupuestos: Tope y Meta. Plan: `docs/presupuestos/PRESUPUESTOS-Y-AHORRO.md`
(part A). Prototype: `docs/presupuestos/Step Up Rediseno.dc.html`.

### Added
- A budget is a **Tope** (limit: the most you want to spend) or a **Meta**
  (goal: what you want to save up). `Budget.kind`, default `limit`; budgets
  of savings categories (the savings icon, like "Ahorro") are born goals.
- Goal columns: a green gradient fill under a faint green dashed border,
  with a "Meta" tag on top; at 100 % the border turns solid and the tag
  reads "✓ Meta". The % is green and going over is never red.
- Budget stats over the columns, Gastos and Ahorro (each only if it
  exists), in Análisis, Ajustes → Presupuestos and the desktop Inicio
  card (now with "Editar"). The Análisis card header reads
  "Gastos 89% · Ahorro 86%"; Presupuestos, "Gastaste … · Ahorraste …".
- Ajustes → Presupuestos: a mini **Tope | Meta** under each budgeted
  category (the viewed month and the later ones that have a budget; past
  months keep theirs). Goals read "Ahorrado $X de $Y · faltan $Z" or
  "· meta cumplida". The intro explains both.
- Zero amounts in the columns read "$ 0".
- Supabase migration `0019_budget_kind.sql`: `kind`, plus `plan_id`,
  `goal_name`, `goal_amount` for the savings plan (part B). Until it runs,
  sync uploads budgets without those columns instead of failing.

### Tests
- Unit: `budget/kind.ts` (kind, savings categories, summary), Tope/Meta
  kept across edits in `planBudgetSet`, mapper round-trip and fallback.
- E2E 49-budget-goals (ES and EN).

## [1.4.1] — 2026-10-01

### Fixed
- Inicio and Movimientos open on the month of today's pay period, not the
  calendar month. Paid on the 10th and the 25th, the 1st–9th belong to the
  period of the 25th of the previous month, so an expense recorded on
  October 1st showed up nowhere: October's view only holds its own periods.
  "Hoy" (back to the current month) follows the same rule.

### Tests
- Unit: `periodMonthOf`. E2E 42 and 10 no longer assume the date: they
  hard-coded "Hogar" having spending this month, "Septiembre" and
  "Quincena del 5", and failed on October 1st.

## [1.4.0] — 2026-09-30

Redesign v4, inbox v2, tab-bar transparency, cost audit and bank-SMS
reading. Each part below lists its own changes.

### Bank SMS amounts and the sign-up email link

#### Fixed
- Bank SMS: the amount is the figure right after "$" ("$300,000.00",
  "$17.686,00", "$72,000"), never "una transferencia" (read as 1) nor a
  card or account number (*7145). New `bankSms.ts` reads the verb
  (compraste / pagaste / enviaste / retiraste… → gasto; recibiste / te
  consignaron / abono… → ingreso) and the counterpart: "Rappi Colombia",
  "Didi" (DLO*Didi), "Pago QR", "Consignación", the sender's name. Messages
  can be longer or shorter; only "$" + a verb are required. The push text
  (ingest) uses the same parser (`pushText.gen.js` regenerated).
- Sign-up and password-reset emails now link back to the app
  (`emailRedirectTo` = origin + /step-up/) instead of the bare domain,
  which gave a 404. An expired or used link (`#error_code=otp_expired`)
  lands on the sign-in screen with an explanation, and the hash is cleared.

#### Tests
- Unit: `bankSms.test.ts` with the real messages; parse expectations updated.
- E2E 45: an expired confirmation link shows the explanation.

### Tab bar transparency

Plan and checklist: `docs/BARRA.md`. Prototype: `docs/barra/Step Up Barra.dc.html`.

#### Changed
- Ajustes → "Tema y barra" (was "Tema"), now its own screen on the phone.
  Under the three themes, "Barra de navegación": a live preview, Sólida /
  Translúcida / Cristal (100 / 88 / 40 %), an opacity slider (15–100 %),
  "Botón + también transparente" and a note per mode. The Ajustes row
  reads e.g. "Oscuro · Cristal".
- The tab bar and the + read `--nav-*` / `--fab-*`, written on <html>
  before the first paint from localStorage (per device, not synced).
  Glass adds a stronger blur, a light edge and a top highlight.
  `prefers-reduced-transparency` forces Sólida. The desktop sidebar is
  untouched.

#### Tests
- Unit: `navBarVars` (100 / 88 / 40 / reduced transparency), presets,
  slider range, persistence.
- E2E 42-navbar-transparency (Cristal → blur → reload → still Cristal;
  Sólida; a value between presets); 43 and 38 follow the new screen; 27
  also checks Ajustes → Theme & bar in English.

### Inbox v2, part 2: web and moving between entries

Plan and checklist: `docs/BANDEJA-WEB.md`. Prototype: `docs/bandeja/Step Up Bandeja.dc.html` (3b, 4a, 4b).

#### Changed
- Move between what arrived on its own without deciding: `‹ N de M ›`,
  tappable progress segments (resolved in --q10, missing something in
  red) and a swipe on the card. What was typed in an entry survives
  moving away and back.
- Desktop: "Por revisar" in the sidebar (any screen, amber count), a
  40 px inbox button between the search and "Nuevo movimiento", and a
  480 px side panel instead of the dialog — the whole queue on top,
  the same editable card with the original message always open, a fixed
  foot with ⌫ / ⏎. Keys: ⏎ ⌫ ↑↓ ←→ Esc.
- The Movimientos table puts what was just recorded from the inbox first
  in its group, with a faint amber wash for a few seconds.
- One hook, `useInboxReview()`, behind both the sheet and the panel.

#### Tests
- Unit: moving stays in range, edits are kept per entry, queue colours.
- E2E 41-inbox-navigate (phone: ›, swipe, segments; desktop: ↓, queue
  click, ↑/←, Esc) and 27-english-has-no-spanish-inbox (sheet and panel
  in English). E2E 40 follows the panel on desktop.

### Inbox v2: what arrives on its own

Plan and checklist: `docs/BANDEJA.md`. Prototype: `docs/bandeja/Step Up Bandeja.dc.html`.

#### Changed
- The inbox banner is gone. Inicio has an inbox button beside the month
  (amber count) and a "N por revisar" card between the flow grid and
  "Falta este mes", only while something waits.
- Review one at a time: progress bar, and everything editable in place
  (expense/income, amount, concept, category, method, date, currency).
  A coloured hint says how sure it is (green learned/complete, blue
  scheduled, red missing) and "Anotar" stays off while the amount or the
  concept is missing. "Anotar los N completos" records the complete ones
  only. Every action leaves a 5 s "Deshacer"; discarding no longer asks.
- Desktop: a 520 px dialog; ⏎ records, ⌫ discards, Esc closes.
- What arrived on its own carries an amber bolt in every list and
  "Origen: SMS Bancolombia" in its detail (`Transaction.source`,
  `sourceLabel`).
- The ingest Edge Function sends a push saying what it understood ("Gasto
  de $ 500.000 en Restaurante El Cielo"), grouped per user; tapping it opens
  the review on that entry (`/?revisar=<id>`).

#### Database
- `0018_inbox_v2.sql`: `transactions.source` / `source_label` and
  `push_subscriptions.language`. Run it before recording from the inbox.

#### Tests
- Unit: review logic (drafts, hints, bulk, conversion), the sheet's
  "Anotar" button, the push text and its bundle, source round-trip.
- E2E 40-inbox-review-one-by-one: type the missing amount, record, undo;
  the deep link; desktop shortcuts.

### Cost audit: C1, C2, C3

Audit: `docs/auditoria/COSTOS.md`.

#### Changed
- C1, sync egress: the push reuses the lists the pull just downloaded
  instead of asking for them again, and the remote transaction versions are
  kept on the device: each incremental sync only asks for the ones changed
  since the cursor, instead of id + updated_at of the whole history.
- C3, exchange rate: with Supabase configured, the day's table is read from
  `public.fx_rates`, which the new `fx-rates` Edge Function fills once a day
  for everyone. A missing or old row (more than 2 days) falls back to
  open.er-api, as before.

#### Fixed
- "Sync now" always said "3 uploaded, 14 downloaded" even with nothing
  changed. A budget with the same timestamp on both sides was re-uploaded on
  every sync, and every reminder in the cloud was counted (and rewritten) as
  downloaded. Now only what actually changed travels and is counted.

#### Database
- `0016_rls_select_auth_uid.sql` (C2): re-runnable; rewrites any RLS policy
  still using `auth.uid()` as `(select auth.uid())`, as 0009 did.
- `0017_fx_rates.sql` (C3): the `fx_rates` table (public read, written only
  by the service role) and the daily `fx-rates-daily` cron job.

#### Tests
- Unit: known remote versions (merge, reuse), the shared rate table (any base
  from the USD row, freshness, fallback to the API).
### Redesign v4: visual polish against the prototype

The phases implemented `REDISENO.md`; this pass compares every screen with
the prototype (`Step Up Rediseno.dc.html`, rendered locally) at 390px and
1440px, in Spanish and English, and closes the gaps: sizes, weights,
colours, spacing, labels and element order.

#### Changed
- Home: month pill with grey arrows (34px phone, 40px desktop), hero line at
  400, "$" top-aligned like a superscript, flow cells at 12/17px with zeros
  in grey, 19px "Falta este mes", 38px avatars and 26px checks.
- Transactions: the month beside the title, search with its icon, 14px
  filter chips (and a new "Tarjeta" chip: credit-card purchases only), the
  count and totals on one line, pay-period headers with the range underneath
  and the remainder when folded, rows at 11px/14px with dividers.
- Months and dates written as in the prototype: "Sep", "1 Oct",
  "29 de Septiembre", "10 – 24 Sep"; in English "Sep 29", "Sep 10 – 24".
- Calendar in its own card; out-of-month days dimmed; the day's list with
  category subtitles and a dashed "Nada este día".
- Every sheet: 28px corners and a 36×5 handle. The + menu with coloured
  icon tiles. New expense: the sheet's own keypad (the amount stays a real
  input), the concept as centred text, category chips with coloured icons,
  method and date on one row, and a bell before the reminder chips.
  "Contarle a la app": mic label, the reading as the row it will become.
  "Falta pagar": the total, three counters and the list.
- New recurring: the same sheet as a new expense (Gasto | Ingreso, "Cada
  mes, el día", keypad); frequency, schedule, dates and "active" in "Más
  opciones".
- Analytics: the period navigator beside the title, "+$" in colour with the
  figure in white, "Ingresos $X  Gastos $Y", foldable cards at 16/13px,
  "Presupuestos" with "Llevas 4,2M de 4,7M", split-bar legends as in the
  prototype, "Orden original".
- Settings: text chevrons, values in 14px, the prototype's icons, Legal as a
  pushed sub-screen on the phone. Sub-screens: currencies in the prototype's
  order, reminders with "Cuándo", compact steppers and the "Así te llega"
  notification, payment methods with "sale al instante" / "corte 15, paga
  el 2" / "sin fechas", budgets with the month beside the title.
- Desktop: header aligned to the title, 13px chips and tabs, pending in
  grey, Ajustes as a plain list of 40px rows with each sub-screen in a card,
  the profile as cards, the new-transaction dialog with "Moneda /
  Categoría / Método de pago / Aviso" labels and the prototype's mini
  calendar; the sign-in panel with the legal links at its foot.
- Sign-in: blue logo tile, inset tabs, a drawn checkbox, "Crear cuenta" on
  the button (its accessible name stays "Crear mi cuenta").
- English labels aligned with the prototype's ("To pay", "Pay period 25",
  "Analytics", "Pending", "Remaining", "Left for September"…), US spelling.

#### Tests
- Updated the E2E whose labels or layout changed on purpose (placeholders,
  "Nuevo método", "Orden original", the analytics navigator beside the
  title, export rows named "JSON / CSV / Excel", the reminder "A las",
  English strings); none removed.

### Redesign v4, phase 10: language

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 10; §11 item 12).

#### Fixed
- Hard-coded Spanish that English users saw, now in the dictionary: the
  "Still to pay" breakdown sheet (title, statuses, rows), the empty state of
  Transactions, the "Cancelled" status, the new-transaction dialog names,
  the new-password placeholders, the onboarding name field and its buttons,
  and the lazy-screen "Loading…".
- The Spanish text of the Shortcut instructions was in English.

#### Tests
- New E2E 48: walks every screen AND the main sheets (+ menu, new expense
  and income with "More options", new recurring, "Tell the app", the "Still
  to pay" breakdown) in English, at phone and desktop widths. The
  Spanish-only word list is derived from the dictionary itself (Spanish
  words that never appear in the English texts), so any hard-coded label
  reusing app vocabulary fails it; a control test proves the detector
  flags the Spanish interface.
- The dictionary has no key missing in English.

### Redesign v4, phase 9: desktop and tablet

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 9; §9g). The
desktop sign-in (2d, §9h) shipped with phase 8. One component tree for every
width: `useBreakpoint()` picks the arrangement ('phone' < 760, 'tablet'
760–1099, 'desktop' ≥ 1100) and `index.css` media queries do the rest. Below
760px nothing changes.

#### Added
- Tablet (760–1099px): the tab bar becomes a 72px rail down the left edge
  (icon + small label) with the + on top of it; screens keep their centred
  560px column.
- Every sheet (`role="dialog"`) opens as a centred 480px dialog with 24px
  corners and no drag handle from 760px up. Done once in `index.css` over the
  sheets' shared structure (backdrop → panel → handle); a dialog laid out for
  wide screens opts out with `.dialog-wide`.
- Desktop (≥1100px):
  - `AppLayout` is a `248px 1fr` grid. The sidebar (`app/Sidebar.tsx`) has
    the logo, Inicio / Análisis / Ajustes (the same `TABS`), a card with the
    pay period you're in and its progress ("25 sep - 9 oct · día 6 de 15",
    from `calculatePeriod`), and the account with its sync state.
  - Inicio in two columns. Header: greeting and date, `MonthNav`, a search
    box and "Nuevo movimiento" (opens the same quick-action menu as the +,
    now exported from `TabBar` as `QuickActions`). Left column (410px): the
    hero card with the four flows, "Falta este mes" and the budget columns.
    Right: Movimientos embedded as a table (`32px 1fr 90px 100px 96px 140px`:
    check, concept + category, date, method, status, amount) with the
    foldable period groups, the filters and Lista | Calendario in its header.
  - ⌘K / Ctrl+K focuses the search from any screen (it lives on Inicio); it
    searches the whole history like the phone's box. Esc clears it.
  - Selecting in the table: "Seleccionar" turns the checks into selectors
    and a bar on top of the card shows "N seleccionados · Todos · Marcar
    pagado · Eliminar"; Eliminar asks with the list and the total, as on the
    phone.
  - Calendario in the card: the whole month in 88px cells, each with up to
    two transactions (category dot + concept) and "+N más", and the selected
    day's detail below.
  - `/movimientos` redirects to `/` keeping the query, so `?nuevo=1`,
    `?tipo=ingreso`, `?texto=` (iOS Shortcuts, the + menu) and
    `?vista=calendario` still work.
  - New transaction (2d): the same `TransactionForm`, laid out as a centred
    780px dialog: Gasto | Ingreso | Recurrente on top (Recurrente hands over
    to the recurring form), the amount in a large input typed with the
    keyboard, concept, currencies, categories (wrapping), method, reminder
    and "Más opciones" on the left; the mini calendar always visible on the
    right; Cancelar / Guardar bottom right; Esc closes. Same fields and
    validation.
  - Análisis: the controls keep a phone's width, centred; the cards sit in a
    `repeat(auto-fill, minmax(420px, 1fr))` grid.
  - Ajustes (2c): two columns. On the left, a 250px navigation with the same
    groups and rows as the phone (the current one marked); on the right, the
    `/ajustes/*` screen, rendered in place instead of pushed (the routes are
    now children of `SettingsLayout`; `/ajustes` opens Perfil). Idioma and
    Tema share `/ajustes/preferencias`; Moneda lists the currencies in two
    columns; Legal (`/ajustes/legal/:slug`) shows the documents on the left
    and the chosen one on the right. On a phone those two routes send you to
    the sheets and to `/legal`, as before.
  - Hover on rows and navigation (`--surface` → `--hover`, pointer cursor),
    only on pointer devices; nothing depends on it.
- Texts in ES and EN (`// Fase 9 — Escritorio`).

#### Changed
- `Screen` takes its width from the `.screen` class; `wide` lets a screen use
  the desktop width, and inside the Ajustes panel it drops "‹ Ajustes".
- `LanguageSheet` / `ThemeSheet` expose their content (`LanguageOptions`,
  `ThemeOptions`) so the desktop panel reuses it.

#### Not done (on purpose)
- The sheets that 2c shows beside the list (nueva categoría, nuevo método,
  cambiar contraseña, cerrar sesión) stay centred dialogs on desktop, and
  Cambiar contraseña opens in the right panel; the plan makes this optional.

#### Tests
- New e2e: `46-desktop-layout` (sidebar, two-column Inicio with the table,
  selection bar and confirmation, ⌘K search, the 780px form with the
  calendar, Ajustes in two panels) and `47-tablet-rail` (the rail and the
  centred 480px dialogs at 900px).
- The default Playwright project is Desktop Chrome (1280×720), so the suite
  now runs the desktop layout. Specs about the phone layout (the pill and the
  +, bottom sheets, the Movimientos screen, the grouped Ajustes list) pin a
  390×844 viewport; `switchLanguage` in `fixtures.ts` uses the preferences
  panel on desktop.

#### Also in this release
- The + is always visible (it used to hide on scroll down).
- The + now really steps aside while a sheet is open, in every language:
  the CSS rule matched the Spanish aria-label and lost to the button's
  inline `display`, so since phase 2 it stayed on top of open sheets.

### Cost and security audit

Reports: `docs/auditoria/COSTOS.md` and `docs/auditoria/SEGURIDAD.md`.
No critical or high findings. Only changes that users can't see were applied;
everything that changes behaviour, data or infrastructure waits for approval.

#### Changed
- Exchange-rate request gives up after 8 s and falls back to the cached table.
- `ingest` Edge Function refuses bodies over 16 KB (413) before parsing them.
- `send-reminders` logs only the push status code, not the error object
  (which carried the device's push endpoint).
- The backup code and `zod` load only when exporting or importing (−27 KB
  gzip on the first load).
- The manual cron template reads the secret from Vault instead of a
  plain-text placeholder.

#### Removed
- `recharts` dependency (unused since the Analytics redesign).

### Redesign v4, phase 6: Settings

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 6; §7, §9d, §9e,
§9f; pending 4 and 5).

#### Changed
- Settings (§7) is an iOS-style grouped list instead of one long page: a
  profile card (initial, name, email, "Sincronizado"), then Preferencias
  (Idioma, Tema, Moneda), Tu plata (Cómo te pagan, Recordatorios), Organizar
  (Categorías, Métodos de pago, Recurrentes, Presupuestos, with counts),
  Avanzado (Atajos de iOS, Tus datos, Legal), "Cerrar sesión" in red (only
  with an account) and "Step up v1.3.0 · © 2026". 52px rows, a tinted 30px
  icon square, the value in `--text-faint` and a chevron. Each row opens its
  own screen (`ajustes/cuenta`, `ajustes/cuenta/contrasena`, `ajustes/moneda`,
  `ajustes/pagos`, `ajustes/recordatorios`, `ajustes/atajos`, `ajustes/datos`,
  plus the existing ones) with "‹ Ajustes" on top; Idioma and Tema are sheets.
- Cómo te pagan (§9d): "Dos veces al mes | Una vez al mes", steppers for the
  pay days (first + 2 ≤ second) and a 30-day preview strip coloured by pay
  period (`periodsOfMonth`), with each period's range.
- Categorías: avatar, name and all-time total, dashed "+ Nueva categoría".
  The category sheet (§9f) is new: big avatar preview, the name under it,
  Gasto | Ingreso, the 12 `--cat-*` colours in a grid of 6 and 10 icons in a
  grid of 5 ("Más íconos" opens the rest). Same saved fields.
- Métodos de pago (§9f): type icon, "Por defecto" tag, "Crédito · corte 15,
  paga 2" and a usage bar for cards with a limit ("Usado $ … · Cupo $ …").
  The method sheet: Débito | Crédito | Efectivo, name, cutoff/payment
  steppers, an amber line computed with `cycle.ts` ("Compras del 1 al 15 se
  pagan el 2 de noviembre. Del 16 en adelante, el 2 de diciembre.") and a
  "Usar por defecto" switch (writes `settings.defaultPaymentMethodId`).
- Recurrentes: "Entran al mes / Salen al mes" summary (monthly equivalent of
  every active rule), Ingresos and Gastos groups sorted by day. A rule can be
  entered in another currency (CurrencyChips + today's fetched rate); it keeps
  `currency`/`originalAmount`/`fxRate`, `amount` stays converted.
- Presupuestos: the §9c columns on top and one row per category with "spent
  of limit" (red "· te pasaste" when over) and a ±$50.000 stepper, or a
  dashed "Definir". Tapping the amount still opens the full sheet.
- Atajos de iOS: "Clave activa · Solo puede enviar" card with the key masked
  and "Copiar", "Generar una clave nueva" with its warning, "Cómo armarlo" in
  3 steps and a link to `docs/ATAJOS_IOS.md`.
- Perfil (§9e): 84px avatar, editable name (the greeting on Inicio), the
  account's sync state ("Sincronizado · hace 2 min") with "Sincronizar
  ahora", "Cambiar contraseña" and "Cerrar sesión".
- Idioma sheet (two rows with a check and the note) and Tema sheet (three
  thumbnails). The theme applies at once, cross-fading background, text and
  border colours over 350ms. The light theme gets the §9e values
  (`--paper #F2F4F7`, `--line-strong #D5DAE2`, `--q25 #B7650F`, …).
- Moneda: the main currency with flag, name, code and sample, and "Monedas
  rápidas" chips (max 3, `settings.quickCurrencies`) that the new-transaction
  sheet shows before "Más".
- Recordatorios: "Avisarme en este dispositivo" switch (push), "Días de aviso
  antes" stepper 0–7, the fixed 9:00 a. m. and a preview of the notification
  with the 1c icon. (Reminder modes v2 come with phase 7.)
- Tus datos: Exportar (JSON, CSV, Excel, each with what it's for) and
  Restaurar (import a JSON backup, confirmed as before). The import sheet is
  translated.

#### Added
- Change the password in the app (pending 5): current, new (with a 4-segment
  strength meter) and repeat, with a live "Coinciden / No coinciden". It
  re-authenticates with the current password (`signInWithPassword`, with the
  Turnstile token when the captcha is on) and then `auth.updateUser`. "¿No la
  recuerdas?" sends the recovery link. Errors go through `translateError`.
- Sign-out sheet (pending 4): "Tus datos siguen en tu cuenta…" and an
  optional "Borrar también de este teléfono": after signing out it deletes and
  reopens the local database and clears the device preferences in
  localStorage, then reloads to a blank login.
- `PasswordStrength` (`passwordStrength(pw): 0–4` and the meter), shared with
  the new login (phase 8).
- Shared Settings building blocks (`features/settings/ui.tsx`): group card,
  row, stepper, switch and bottom sheet.
- `data/sync/lastSynced.ts`: when this device last finished a sync.

#### Removed
- `BudgetBar` (the budget rows are steppers now; the columns show the fill).

#### Tests
- Unit: `passwordStrength`, the pay-days preview, the recurring monthly
  equivalents.
- E2E updated: 10 (Cómo te pagan is its own screen), 13 (new case: the wipe
  leaves no data and no preferences), 19 and 20 (card steppers, usage bar),
  22 (exports in Tus datos), 25, 26 and 27 (language from the Idioma sheet;
  27 walks the new screens), 33 (budget stepper), 38 (the new screens and
  sheets in English). New: 43 (grouped list, theme, profile name, pay days,
  quick currencies, reminders, data, new category, new method, recurring in
  dollars) and 44 (change password and sign out with/without wiping, on the
  fake-Supabase build).

#### Integration (with phases 7 and 8)
- Ajustes → Recordatorios mounts the v2 editor (days before at a time, or the
  same day: 1 h / N hours / N minutes before, or at an exact time) with its
  live preview; the Settings row shows the mode. The legacy days field is
  kept in step.
- Signing out returns to the login with the email already typed and a green
  notice ("Cerraste sesión…"), also after "Borrar también de este teléfono".
- The password meter is the one from phase 8 (same API).

### Redesign v4, phase 7: reminders v2 (backend)

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 7; §9f
"Recordatorios v2"; pending 3, the schedule and the cron).

> **Deploy note:** run Supabase migration `0015_reminder_v2.sql` before
> deploying this version (the app always sends `settings.reminder`). Redeploy
> the Edge Function: `supabase functions deploy send-reminders --no-verify-jwt`.
> The migration also moves an existing reminder cron from every 15 to every
> 10 minutes; a new project gets that from `supabase/manual/0003_reminder_cron.sql`.

#### Added
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

#### Changed
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

#### Tests
- Unit: `reminderInstant` for every mode, month/leap-year/year boundaries,
  crossing midnight backwards, bad data, override precedence, and identical
  output to `calculateReminderTime` for the default rule; `planReminder`;
  settings mapper round-trips for each rule kind and for rows from before
  0015; backup schema; the editor's stepper/clock/preview helpers; the Edge
  Function's window, chunking, bounded concurrency, time budget and payload
  (`vitest` now also runs `supabase/functions/**/*.test.ts`).
- The reminder function skips a reminder whose transaction was paid or
  cancelled after it was scheduled: marked `dismissed`, no push sent.
### Redesign v4, phase 8: sign-in

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 8; §9f "Login y
registro", §9g 2d, §9h).

#### Changed
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

#### Added
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

#### Tests
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

### Redesign v4, phase 5: Análisis

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 5; §6, §9c;
pending 9 and 10).

#### Changed
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

#### Removed
- "Ingresos vs. gastos" (the hero already says both) and the donut. Saved
  layouts are migrated: old ids map onto the new cards.

#### Tests
- Unit: layout migration and folded cards, spend by method, short amounts.
- E2E updated: 25. New: 42 (balance hero, folding survives a reload, a row
  opens its detail, "Definir" goes to Budgets).

### Redesign v4, phase 4: the new-transaction sheet

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 4; §5, §9b;
pending 1 and 2, per-transaction reminder UI).

> **Deploy note:** run Supabase migrations `0013_currency_cash.sql` and
> `0014_transaction_reminder.sql` before deploying this version.

#### Changed
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

#### Added
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

#### Tests
- Unit: mapper round-trips (currency, reminder, quick currencies), currency
  helpers, NLP currency words, rate fetching (inversion, daily cache,
  offline fallback).
- E2E updated: 04, 05, 09, 11, 12, 14, 18, 19, 20. New: 41 (dollars in cash
  at today's rate, no rate field, offline blocks saving, "Más" currencies,
  quick entry with currency and method), with the rates API mocked.

### Redesign v4, phase 3: Inicio and Movimientos

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 3; §3, §4;
pending 6, 7 and 8).

#### Changed
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

#### Added
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

#### Removed
- The global `BrandBar`.

#### Tests
- E2E updated: 08, 10, 12, 18. New: 08 ("Falta pagar" opens the breakdown,
  "Ver todos" → Movimientos → Inicio), 12 ("Todos", folding survives a
  reload), 40 (date chip: tomorrow stays pending).

### Redesign v4, phase 2: navigation

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 2).

#### Changed
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

#### Added
- `Segmented`: the single segmented control of the redesign (§0).

#### Removed
- The floating refresh button over the +. Pull-to-refresh (home-screen app)
  and Ajustes → "Sincronizar ahora" remain.

#### Tests
- E2E updated: 24 (plus: `/calendario` redirects), 25, 29 (no floating
  refresh; pull-to-refresh proves a real reload), 31, 32.
- New E2E 39: three tabs, Inicio lit on Movimientos, + beside the pill.

### Redesign v4, phase 1: foundations

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 1).

#### Changed
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

#### Added
- Tokens `--radius-card`, `--tabbar-h`, `--hover`, `--on-accent`, `--knob`,
  `--brand-tile`, `--on-brand-tile`.
- `useBreakpoint()` (`phone` < 760 ≤ `tablet` < 1100 ≤ `desktop`) with tests.
- `docs/rediseno/`: the redesign plan and the prototype.

#### Fixed
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
