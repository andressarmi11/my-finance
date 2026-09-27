/**
 * Remainder per period, and the month's leftover.
 *
 * Rule (straight from the original spreadsheet): a period's remainder is
 * its income minus its expenses, WITHOUT filtering by whether they're
 * already paid (the "done" checkbox is separate tracking, it doesn't change
 * the arithmetic). "Cancelled" IS excluded: a cancelled expense should
 * never have counted.
 *
 * "Month leftover" = the sum of its periods' remainders. There used to
 * always be two; now there are as many as there are, one if you get paid
 * once a month.
 *
 * It adds up by CHARGE period, not by record period: a card purchase
 * doesn't take your money the day you make it, but the day you pay the
 * statement. They are the same key for everything that isn't a card.
 * See domain/period/resolve.ts.
 */
import { periodsOfMonth, DEFAULT_PAY_DAYS, type PayDays } from './period';
import type { ResolvedPeriods } from './resolve';
import type { PeriodKey, Transaction } from '../types';

export interface PeriodBalance {
  key: PeriodKey;
  income: number;
  expense: number;
  remainder: number;
}

export interface MonthBalance {
  year: number;
  month: number;
  income: number;
  expense: number;
  leftover: number;
  /** One per pay day, in order. */
  periods: PeriodBalance[];
}

/**
 * transactions must already carry both resolved periods (withResolvedPeriods).
 * This file doesn't import calculatePeriod, so that "adding up" isn't coupled
 * to "working out the date" — they're tested separately.
 */
export function calculatePeriodBalance(
  transactionsWithKey: Array<Transaction & ResolvedPeriods>,
  key: PeriodKey,
): PeriodBalance {
  let income = 0;
  let expense = 0;
  for (const tx of transactionsWithKey) {
    if (tx.status === 'cancelled') continue;
    if (tx.chargePeriodKey !== key) continue;
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { key, income, expense, remainder: income - expense };
}

export function calculateMonthBalance(
  transactionsWithKey: Array<Transaction & ResolvedPeriods>,
  year: number,
  month: number,
  payDays: PayDays = DEFAULT_PAY_DAYS,
): MonthBalance {
  const periods = periodsOfMonth(year, month, payDays)
    .map((key) => calculatePeriodBalance(transactionsWithKey, key));

  return {
    year,
    month,
    income: periods.reduce((a, p) => a + p.income, 0),
    expense: periods.reduce((a, p) => a + p.expense, 0),
    leftover: periods.reduce((a, p) => a + p.remainder, 0),
    periods,
  };
}
