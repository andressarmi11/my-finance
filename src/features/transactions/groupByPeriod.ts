/**
 * Groups transactions by period for the list. Presentation (labels,
 * colors), not business logic — the math lives in domain/periodo/*.
 *
 * It used to only know about two windows per month: the label was
 * "Quincena del {10|25}" and the color came from a ternary over Q1/Q2.
 * Now it depends on how many pay days there are, which is what tells
 * monthly apart from biweekly.
 */
import { compareISO } from '@/domain/dates';
import { calculatePeriodBalance, type PeriodBalance } from '@/domain/period/balance';
import { rangeFromKey, normalizePayDays, DEFAULT_PAY_DAYS, type PayDays } from '@/domain/period/period';
import { withResolvedPeriods } from '@/domain/period/resolve';
import type { PeriodKey, Transaction } from '@/domain/types';
import { monthName } from '@/components/ui/MonthNav';
import { monthFromLabel, payPeriodLabel } from '@/i18n/periodLabels';
import { formatShortDate } from '@/lib/formatShortDate';

export function formatRangeLabel(start: string, end: string): string {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  return s.month === e.month ? `${s.day} - ${e.day} ${s.month}` : `${s.day} ${s.month} - ${e.day} ${e.month}`;
}

/**
 * Period colors. There were two tokens from when the app only knew about
 * biweekly periods; with a single pay day the first one is used, and if
 * there are ever more than two they cycle through instead of running out
 * of color.
 */
const PERIOD_COLORS = ['--q10', '--q25'] as const;
const SOFT = ['--q10-soft', '--q25-soft'] as const;

export interface PeriodGroup {
  key: PeriodKey;
  label: string;
  rangeLabel: string;
  start: string;
  colorVar: (typeof PERIOD_COLORS)[number];
  softVar: (typeof SOFT)[number];
  balance: PeriodBalance;
  transactions: Transaction[];
}

/**
 * What a period is called on screen.
 *
 * With two or more pay days it's still "Quincena del 10" — the word the
 * person already uses. With just one, calling it a "pay period" would be
 * a lie: if the month starts on day 1 it's called by its name
 * ("Septiembre"), and if it starts on the pay day it says since when,
 * because their September isn't the calendar's.
 */
export function periodGroupLabel(payments: PayDays, index: number, key: PeriodKey): string {
  if (payments.length > 1) return `${payPeriodLabel()} ${payments[index - 1]}`;

  const day = payments[0]!;
  if (day === 1) {
    const month = Number(key.slice(5, 7));
    const name = monthName(month);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return `${monthFromLabel()} ${day}`;
}

export function groupByPeriod(
  transactions: Transaction[],
  payDays: PayDays = DEFAULT_PAY_DAYS,
  /**
   * Where each header's remaining amount comes from. By default, the same
   * thing that's listed — but the caller usually passes the WHOLE
   * history, and has to: a September card purchase gets charged in
   * October, so October's remaining amount depends on a transaction that
   * October's list doesn't show. Without this the header said one number
   * and the dashboard another for the same pay period.
   */
  paraBalance: Transaction[] = transactions,
): PeriodGroup[] {
  const payments = normalizePayDays(payDays);
  const resolved = withResolvedPeriods(transactions, payments);
  const resolvedForBalance = paraBalance === transactions
    ? resolved
    : withResolvedPeriods(paraBalance, payments);

  const byKey = new Map<PeriodKey, Transaction[]>();
  for (const tx of resolved) {
    const list = byKey.get(tx.recordPeriodKey) ?? [];
    list.push(tx);
    byKey.set(tx.recordPeriodKey, list);
  }

  const groups: PeriodGroup[] = [];
  for (const key of byKey.keys()) {
    const range = rangeFromKey(key, payments);
    const i = range.index;
    const txs = (byKey.get(key) ?? []).slice().sort((x, y) => compareISO(y.date, x.date));
    groups.push({
      key,
      label: periodGroupLabel(payments, i, key),
      rangeLabel: formatRangeLabel(range.start, range.end),
      start: range.start,
      colorVar: PERIOD_COLORS[(i - 1) % PERIOD_COLORS.length]!,
      softVar: SOFT[(i - 1) % SOFT.length]!,
      balance: calculatePeriodBalance(resolvedForBalance, key),
      transactions: txs,
    });
  }

  // Chronological: the 10th's pay period before the 25th's.
  //
  // It used to go the other way (most recent first), which is right for
  // an infinite feed but not for a month: the list opened on the 25th's
  // pay period and you had to scroll down to see how the month started.
  // With the month window already scoped, reading in order is the
  // natural thing.
  return groups.sort((x, y) => compareISO(x.start, y.start));
}
