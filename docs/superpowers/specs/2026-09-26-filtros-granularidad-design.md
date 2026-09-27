# Filters by type and status, and granularity in Analytics

**Date:** 2026-09-26
**Status:** design approved
**Spec 3 of 4.**

---

## What's wanted

Being able to filter transactions by type (expense/income) and by
status (pending/paid), and see the aggregates with a different time
window: by pay period (quincenal), monthly, quarterly, or yearly.

**User decision that sets the scope:** quarterly and yearly live in
**Analytics**, not in the list. The list keeps navigating by month,
which is the reality of payments; Analytics is where you ask "how much
did I spend this quarter?"

---

## A. The bug this spec inherits

`src/features/analytics/periodAggregate.ts:127`:

```ts
return transactions.filter((t) => t.date >= from && t.date <= to);
```

It filters by the **entry** date. A card purchase from September 20th
that's paid on November 2nd counts as a September expense, just like
before the dashboard fix (commit `95e91ce`). The bug was fixed in the
balance and survived here.

It's more noticeable with installments: a fridge's twelve installments
show up by their entry date, not their charge date.

### The function already exists

`src/features/dashboard/upcoming.ts:15-17`:

```ts
/** La fecha que importa: la de pago de la TC si existe, si no la del movimiento. */
export function relevantDate(tx: Transaction): string {
  return tx.cyclePaymentDate ?? tx.date;
}
```

(That comment translates to: "The date that matters: the card's payment date if there is one, otherwise the transaction's date.")

There's nothing to invent: it just needs **a single home**. It moves
up to `src/domain/periodo/fechaDeCargo.ts` and gets used by both
Analytics and the dashboard.

Watch out for the distinction already written in
`domain/periodo/resolve.ts`:

- **entry** (`tx.date`) → where it's listed.
- **charge** (`cyclePaymentDate ?? date`) → where the money actually
  comes out.

Analytics measures money, so it goes by charge date.
`resolverPeriodoDeCargo` doesn't work here because it returns a pay
period key, and Analytics works with calendar ranges: what's needed
is the **date**, not the key.

---

## B. Granularity

`Range` goes from `'mes' | 'trimestre' | 'año'` (month | quarter |
year) to also including `'quincena'` (pay period).

`rangeBounds()` gains a branch: month, quarter, and year stay **pure
calendar**; pay period comes out of `calcularPeriodo(hoy, diasDePago)`
(calculate period from today and pay days), meaning the user's actual
pay period.

These are two different axes and the spec deliberately treats them
that way instead of papering over it: there's no such thing as "a
quarter of pay periods," and none gets invented. The function only
receives `diasDePago` for the pay-period branch.

`rangeBounds` now needs `diasDePago`, so `AnalyticsScreen` has to read
`settings` — today it doesn't.

---

## C. Type and status filters

These go in `TransactionsScreen`, on top of the list already scoped to
the month.

- **Type**: All / Expenses / Income.
- **Status**: All / Pending / Paid.

### "Pending" includes scheduled ones

`TransactionStatus` has `paid | pending | scheduled | cancelled`, and
today the code treats `pending` and `scheduled` two different ways
depending on the file:

- `domain/totals/porPagar.ts:43-44` splits them into two groups, but
  adds them together in the total.
- `features/dashboard/upcoming.ts:20` merges them: `pending ||
  scheduled`.
- `domain/totals/available.ts:36` only checks whether it's `paid` or
  not.

A filter forces a choice. The choice is **"Pending" = `pending` +
`scheduled`**, which is what two of the three already do and what it
means to the user ("what's still owed"). `cancelled` never shows up
under any filter: a cancelled transaction is neither pending nor paid.

The filter is **presentation**, not domain: it narrows what's listed
and doesn't touch the header's balance. A pay period's remainder is
the pay period's, not whatever you left visible — if the filter
changed that number, "Expenses" would show a false negative remainder.

---

## D. Tests

- `rangeBounds`: all four ranges; that the pay-period one follows
  `diasDePago` and not the calendar; that in monthly mode (a single
  pay day) it doesn't return half a pay period.
- `filterByRange`: a card purchase falls in the range of its
  **payment** date, not its purchase date (the bug from section A).
- List filters: that "Pending" includes `scheduled` and that
  `cancelled` doesn't show up in any of them.
- E2E: filtering by Income leaves only income, and the header's
  remainder doesn't move.

---

## Out of scope

- Filtering by category or by card (the search box already covers
  text).
- Filters in Analytics: that screen already visually separates income
  from expenses.
- Quarter or year in the transaction list.
