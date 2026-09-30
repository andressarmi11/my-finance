## [Unreleased] — Redesign v4, phase 9: desktop and tablet

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 9; §9g). The
desktop sign-in (2d, §9h) shipped with phase 8. One component tree for every
width: `useBreakpoint()` picks the arrangement ('phone' < 760, 'tablet'
760–1099, 'desktop' ≥ 1100) and `index.css` media queries do the rest. Below
760px nothing changes.

### Added
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

### Changed
- `Screen` takes its width from the `.screen` class; `wide` lets a screen use
  the desktop width, and inside the Ajustes panel it drops "‹ Ajustes".
- `LanguageSheet` / `ThemeSheet` expose their content (`LanguageOptions`,
  `ThemeOptions`) so the desktop panel reuses it.

### Not done (on purpose)
- The sheets that 2c shows beside the list (nueva categoría, nuevo método,
  cambiar contraseña, cerrar sesión) stay centred dialogs on desktop, and
  Cambiar contraseña opens in the right panel; the plan makes this optional.

### Tests
- New e2e: `46-desktop-layout` (sidebar, two-column Inicio with the table,
  selection bar and confirmation, ⌘K search, the 780px form with the
  calendar, Ajustes in two panels) and `47-tablet-rail` (the rail and the
  centred 480px dialogs at 900px).
- The default Playwright project is Desktop Chrome (1280×720), so the suite
  now runs the desktop layout. Specs about the phone layout (the pill and the
  +, bottom sheets, the Movimientos screen, the grouped Ajustes list) pin a
  390×844 viewport; `switchLanguage` in `fixtures.ts` uses the preferences
  panel on desktop.
