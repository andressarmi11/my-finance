# User manual

## Home (Dashboard)

The first thing you see. Four things, top to bottom:

- **Real free** — the big number. It's what you actually have left,
  subtracting what's already committed (pending + scheduled), not
  just what you see in your bank balance.
- **The two pay periods** — how much you have left in the one
  starting on the 10th and the one starting on the 25th (pay periods,
  or quincenas — the two paydays most Colombian salaries run on).
- **Month's leftover** — the sum of the two.
- **Upcoming payments** — what's coming up, ordered by date (for
  credit card, by the date it's actually paid, not by when you bought
  it).

## Adding a transaction

Tap the **+** button (always visible, at the bottom center) from any
screen. Four fields:

1. **Description** — what it is.
2. **Amount** — how much. You can type it with or without thousands
   separators (`85000` or `85.000`, either works).
3. **Category** — tap an icon.
4. **Payment method** — Debit or Credit card. If you choose card, the
   app immediately shows you "Paid on [date]" before you save.

The date defaults to today (you can change it). There's a toggle
"Already paid" — if you leave it off, the transaction stays pending
(that's how almost all of them started in the original spreadsheet).

## Transactions

The full list, grouped by pay period — just like you organized it in
Excel. Each pay period shows its remainder at the end. Tap the
checkmark on the left of any row to mark it paid or pending without
opening anything. Tap the whole row to edit, duplicate, or delete it.

## Credit card

Accessible from the "On card" chip on the Dashboard. Each purchase
shows up individually, with its own payment date — and grouped, you
see the total paid on each cycle (the calculated equivalent of what
you used to write by hand as "Pago compras TC" / credit card purchase
payment).

## Calendar

Every day with something shows a dot: green for income, gray for an
expense, ochre if something on the credit card is paid that day. Tap
any day to see the detail below.

## Recurring items

From Settings → Recurring. Set it up once ("Rent, $2,500,000, monthly,
day 1") and the app generates the instances for each month on its
own — no need to type it again, and no risk of duplicates.

## Budgets

From Settings → Budgets. Set a monthly cap on a category and you'll
see a progress bar. It turns ochre near the limit and red if you go
over — but it never blocks you from continuing to log expenses.

## Analytics

Charts of income vs. expenses (month/quarter/year), spending by
category, fixed vs. variable, and debit vs. credit card.

## Settings

- **Theme** — light, dark, or match your system.
- **Currency and pay periods** — change the days your pay periods
  start on if they're not the 10th and the 25th.
- **Credit card** — cutoff day and payment day. Only affects new
  purchases; ones you already made keep their original date.
- **Categories** — create, edit, or archive yours.
- **Your data** — export everything as JSON (for a full backup) or
  your transactions as CSV (to open in Excel). Importing replaces
  *all* your current data — it confirms with you before doing it, and
  it can't be undone.
- **Cloud** (if Supabase is configured) — upload or download your
  data as a backup, or sign out.
- **Reminders** (if Supabase + notifications are configured) — turn on
  alerts for your pending payments. Only works if you installed the
  app on your home screen, not in a regular Safari tab.

## Installing on your iPhone

Safari → Share button → "Add to Home Screen". See
`docs/DEPLOYMENT.md` for the full detail if you're deploying the app
for the first time.
