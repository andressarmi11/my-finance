# Financial logic — how every number is calculated

Everything here lives in `src/domain/`, as pure TypeScript functions
with no dependency on React or the database. Each one has its tests
next to the file (`*.test.ts`). This document explains the **why**
behind each rule; the code explains the how.

## The date kernel (`domain/dates.ts`)

Everything else depends on this, so start here. Two hard rules:

1. **Money is always an integer.** Never a `float`. In Colombian pesos
   there are no cents in practice, so an `amount: number` is always
   whole pesos.
2. **Business dates are `'YYYY-MM-DD'` strings, never a `Date` with a
   time component.** Colombia is UTC-5 with no daylight saving; if we
   stored a `Date` with a time, a purchase made at 11pm on the 15th
   could, depending on which time zone the code that processes it runs
   in, get calculated as if it were the 16th. We avoid the whole
   problem by always working with the "calendar" date, with no time.

All month arithmetic (`shiftMonth`, `daysInMonth`, `clampDay`) uses
`Date.UTC(...)` internally — never `Date` methods tied to the local
time zone — so the result doesn't depend on which server or browser
runs it.

## Credit card cycles (`domain/credit-card/cycle.ts`)

The rule, in the user's own words: if you buy from the 1st to the
15th, you pay on the 2nd of the month after the cutoff. If you buy
from the 16th to the 31st (or the last day of the month), you pay a
month after that.

**Why it's generic instead of a fixed date table:** `cutoffDay` and
`paymentDay` are parameters, not constants. The algorithm:

1. If the purchase's day is `<= cutoffDay` (clamped to the month's
   actual last day — so `cutoffDay=31` doesn't blow up in February),
   the cutoff is this month. Otherwise, it's next month.
2. Payment falls on `paymentDay` of the month **after the cutoff**
   (also clamped).

This resolves, on its own, with no special cases, year changes (a
purchase on December 31st correctly calculates a cutoff in January of
the *next* year) and leap years (February 29th).

**Why it's persisted (`cycleCutoffDate`, `cyclePaymentDate`) instead of
being calculated on the fly every time:** if you later change the
cutoff day in Settings, purchases you already made shouldn't have
their payment date change retroactively — you already paid it (or
you're going to pay it) when the bank told you to, not whenever you
changed a setting months later.

## Pay periods (`domain/quincena/quincena.ts`)

Pay periods (quincenas — the two paydays most Colombian salaries run
on) aren't halves of the month. By default, the pay period starting
on the 10th runs from day 10 to day 24; the pay period starting on the
25th runs from day 25 to **the 9th of the following month** — it
crosses the month boundary. This was confirmed against a real case:
Rent, paid on October 1st, shows up accounting-wise in the pay period
that starts on September 25th, not in a new pay period for October.

`quincenaKey` on each transaction is `null` by default (it's
calculated from the date) but can have an explicit value if the user
decides to move a transaction by hand into the other pay period — so
the app doesn't fight how someone organizes their money in edge cases.

## Remainders and leftover (`domain/quincena/balance.ts`)

`restante = ingresos de la quincena − gastos de la quincena` (the
remainder is the pay period's income minus the pay period's
expenses). It doesn't filter by whether they're already paid — the
"paid/pending" status is separate tracking, it doesn't change the
math (same as in a spreadsheet, where the "Ready" checkbox doesn't
affect the subtraction). Canceled transactions are excluded though: a
canceled one should never have counted.

`sobrante del mes = restante quincena 1 + restante quincena 2` (the
month's leftover is the sum of both pay periods' remainders).

## Available / Committed / Real free (`domain/totals/available.ts`)

The Dashboard's three numbers:

- **Available** (Disponible) = income already paid − expenses already
  paid. What has actually already gone through your account.
- **Committed** (Comprometido) = pending + scheduled expenses. Money
  that's no longer yours even though it's technically still in the
  bank.
- **Real free** (Libre real) = Available − Committed. This is the
  Dashboard's big number — not the bank balance, which can be
  misleading if you have commitments still to pay.

## Recurring items: rule vs. instance (`domain/recurring/expansion.ts`)

A `RecurringRule` ("Rent, $2,500,000, monthly, day 1") is a template.
`expandRecurringRule` turns it into concrete dates within a range — it's
a pure function, it writes nothing.

The one that actually writes is `data/local/materialize.ts`, which
before creating an instance checks whether one already exists for
that `(recurringRuleId, periodKey)` combination. The real protection
against duplicates isn't that check — it's the **unique** index in the
database (`&[recurringRuleId+periodKey]` in Dexie; `unique(user_id,
recurring_rule_id, period_key)` in Postgres). Even if the materializer
ran ten times by mistake, the database would reject the duplicates.

`periodKey` changes depending on the frequency: `'YYYY-MM'` for
monthly, `'YYYY'` for yearly, the exact date for weekly/biweekly
(where there's no natural wider "period" that groups a single
occurrence).

## Budgets (`domain/budget/status.ts`)

They only inform. `state` is `'ok'` below 80%, `'warning'` from 80%
up, `'exceeded'` once you go over — but there's never an `if
(exceeded) block the expense`. That was an explicit requirement: the
app warns, it doesn't decide for the user.

## Series for charts (`domain/analytics/series.ts`)

`monthlySeries` groups by the date's `'YYYY-MM'` prefix — a month with
no transactions at all simply doesn't produce a point (not a point at
zero), so as not to clutter the charts' X axis with empty months
nobody asked to see.

## Reminders (`domain/reminders/schedule.ts`)

`calculateReminderTime` subtracts the configured number of days and
sets the time to 9:00am Colombia time (14:00 UTC, with no daylight
saving to complicate the subtraction). See `docs/NOTIFICATIONS.md` for
how it gets triggered from there on.
