/**
 * Time series for the charts (Phase 0, section 5). Each function
 * returns points already ready to plot — the UI component doesn't
 * decide what to sum, it just draws.
 */
import { compareISO } from '../dates';
import type { Transaction } from '../types';

export interface MonthPoint {
  year: number;
  month: number; // 1-12
  income: number;
  expense: number;
}

/** One per calendar month present in the transactions, ordered chronologically. */
export function monthlySeries(transactions: Transaction[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue;
    const key = tx.date.slice(0, 7); // 'YYYY-MM'
    let point = map.get(key);
    if (!point) {
      const [y, m] = key.split('-').map(Number) as [number, number];
      point = { year: y, month: m, income: 0, expense: 0 };
      map.set(key, point);
    }
    if (tx.type === 'income') point.income += tx.amount; else point.expense += tx.amount;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => compareISO(`${a}-01`, `${b}-01`))
    .map(([, point]) => point);
}

export interface FixedVsVariable {
  fixed: number; // has recurringRuleId
  variable: number;
}

export function calculateFixedVsVariable(transactions: Transaction[]): FixedVsVariable {
  let fixed = 0;
  let variable = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    if (tx.recurringRuleId) fixed += tx.amount; else variable += tx.amount;
  }
  return { fixed, variable };
}

export interface DebitVsCredit {
  debit: number;
  credit: number;
}

export function calculateDebitVsCredit(transactions: Transaction[], creditMethodIds: Set<string>): DebitVsCredit {
  let debit = 0;
  let credit = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    if (tx.paymentMethodId && creditMethodIds.has(tx.paymentMethodId)) credit += tx.amount;
    else debit += tx.amount;
  }
  return { debit, credit };
}
