# Export to Excel (.xlsx)

**Date:** 2026-09-26
**Status:** design approved
**Spec 4 of 4.**

---

## What's wanted

A button that downloads everything in Excel format: **one sheet per
entity**, for archiving the year and for opening it and adding things
up by hand.

---

## Warning that drives the design

**This .xlsx can't be re-imported.**

For it to be useful in Excel, names have to go where the model has
ids: the category "Alimentación" instead of `cat-alimentacion`, "Visa
Bancolombia" instead of a UUID, "Pagado" instead of `paid`. That makes
it readable and makes it irreversible: there's no reliable way to go
back from the name to the id.

The restore path is still **JSON**, which already exists and is
reversible (`importBackup` + `BackupSchema`). The xlsx is for
**reading and analyzing**, and that's stated on the screen, not just
here.

---

## A. The library

`write-excel-file` (4.1.1). Compared before choosing:

| Package | Uncompressed size | Problem |
|---|---|---|
| `exceljs` 4.4.0 | 21.8 MB | Reads and writes; we don't need to read |
| `xlsx` (SheetJS) 0.18.5 | 7.5 MB | The npm version is the old one with CVEs; the fixed ones are only on their CDN |
| **`write-excel-file` 4.1.1** | **1.8 MB** | Only writes — which is exactly the only thing needed |

### Lazy loading, mandatory

The app is an offline-first PWA installed on the iPhone, and the
bundle already has a `chunkSizeWarningLimit: 600` and an Analytics
chunk of ~400 kB. An Excel library can't be part of the initial load
for an action used once a month.

It's loaded with a dynamic `import()` **inside the async function**,
copying `src/data/supabase/client.ts:24-32`, which already does
exactly that with `@supabase/supabase-js`. It's not `React.lazy`: it's
not a screen, it's an on-demand action.

---

## B. `download()` has to accept binary

`src/data/backup/exportImport.ts:5-15` takes `content: string`. An
xlsx is bytes. It's generalized to `BlobPart`, which covers both
string and `Uint8Array` without touching the two existing callers
(JSON and CSV).

---

## C. The seven sheets

One per entity in `BackupSchema` (`src/data/backup/schema.ts:120-130`):

1. **Movimientos** (Transactions) — fecha, tipo, concepto, categoría,
   método, estado, valor, se paga el, cuota, notas (date, type,
   description, category, method, status, amount, payment date,
   installment, notes).
2. **Categorías** (Categories) — nombre, ícono, aplica a, archivada
   (name, icon, applies to, archived).
3. **Métodos de pago** (Payment methods) — nombre, tipo, corte, pago,
   cupo (name, type, cutoff, payment day, credit limit).
4. **Presupuestos** (Budgets) — año, mes, categoría, monto (year,
   month, category, amount).
5. **Recurrentes** (Recurring items) — nombre, tipo, valor,
   frecuencia, día, categoría, método, activa, desde, hasta (name,
   type, amount, frequency, day, category, method, active, from, to).
6. **Recordatorios** (Reminders) — movimiento, cuándo, estado
   (transaction, when, status).
7. **Configuración** (Settings) — nombre, moneda, días de pago, tema
   (name, currency, pay days, theme).

### Formatting rules

- **Amounts: numeric**, not text. With currency formatting, so Excel
  can sum them. Putting them in as `"$ 1.200.000"` would make them
  inert, which is the classic mistake in these exports — and the
  current CSV already makes the opposite mistake, dumping the raw
  unformatted number (`exportImport.ts:44`).
- **Dates: date type**, not text, for the same reason.
- **Statuses in Spanish**: `paid` → "Pagado", `pending` → "Pendiente",
  `scheduled` → "Programado", `cancelled` → "Cancelado".
- **Installments**: "3 de 12" in its own column, not appended to the
  description.
- Ids resolved to names; if the id no longer exists (a deleted card),
  the cell is left empty instead of showing the UUID.

---

## D. Where it's triggered

A third button in Settings → Your data, next to "Export JSON" and
"Export CSV" (`SettingsScreen.tsx:238-242`), with the same `busy`
state. Below it, a note that restoring uses the JSON.

---

## E. Tests

The value is in the **transformation**, not the zip: the library
already guarantees the xlsx is a valid zip, and testing that would be
testing the library.

What does get tested, with `filasDeMovimientos()` and its siblings
extracted as pure functions:

- ids resolve to names, and a deleted category leaves the cell empty
  instead of a UUID;
- statuses come out translated;
- amounts come out as numbers, not text;
- installments come out as "3 de 12";
- cancelled ones **do** get exported (it's a file, not a balance).

An e2e test that triggers the download and verifies the file arrives
with the correct name and type.

---

## Out of scope

- **Importing from xlsx.** Restoring is done via JSON.
- Charts or pivot tables inside the file.
- Choosing which sheets to export: all seven go.
