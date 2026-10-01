import { monthName } from '@/components/ui/MonthNav';
import type { Reason } from '@/domain/savings/types';
import { formatMoney } from '@/domain/money/format';
import { shortAmount } from '@/features/analytics/shortAmount';
import type { TextKey } from '@/i18n/texts';
import { fill } from '@/lib/dateLabels';
import type { SavingsPlanUnit } from '@/domain/types';

type T = (k: TextKey) => string;

/** formatMoney with a no-break space: "$" never ends a line alone. */
export function money(n: number): string {
  return formatMoney(n).replace(' ', '\u00a0');
}

/** "780K", "$ 0" for zero: the plan's compact amounts. */
export function short(n: number): string {
  return Math.round(n) === 0 ? '$\u00a00' : shortAmount(n);
}

/** The why of a cut, in the user's language, from their own data. */
export function reasonText(t: T, r: Reason): string {
  switch (r.kind) {
    case 'deliveries':
      return fill(t('save.whyDeliveries'), { n: r.perMonth, amount: money(r.amountPerMonth) });
    case 'rides':
      return fill(t('save.whyRides'), { n: r.perMonth, amount: money(r.amountPerMonth) });
    case 'aboveAverage':
      return fill(t('save.whyAbove'), { month: monthName(r.month), pct: r.pct });
    case 'oneOff':
      return fill(t('save.whyOneOff'), { concept: r.concept, amount: money(r.amount) });
    case 'topSubscription':
      return fill(t(r.count > 1 ? 'save.whySubs' : 'save.whySubs1'), { n: r.count, concept: r.concept, amount: money(r.amountPerMonth) });
    case 'topConcepts':
      return fill(t('save.whyTop'), { list: r.concepts.join(t('save.and')) });
  }
}

/** "1 sep 2026" / "Sep 1, 2026". */
export function fullDate(iso: string, language: 'es' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const mon = monthName(m).slice(0, 3);
  return language === 'en' ? `${mon} ${d}, ${y}` : `${d} ${mon.toLowerCase()} ${y}`;
}

/** "nov 2026" / "Nov 2026". */
export function monthYear(iso: string, language: 'es' | 'en'): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const mon = monthName(m).slice(0, 3);
  return `${language === 'en' ? mon : mon.toLowerCase()} ${y}`;
}

/** "3 meses", "1 semana". */
export function durationText(t: T, unit: SavingsPlanUnit, n: number): string {
  const one: Record<SavingsPlanUnit, TextKey> = { days: 'save.oneDay', weeks: 'save.oneWeek', months: 'save.oneMonth', year: 'save.oneYear' };
  const many: Record<SavingsPlanUnit, TextKey> = { days: 'save.nDays', weeks: 'save.nWeeks', months: 'save.nMonths', year: 'save.nYears' };
  return n === 1 ? t(one[unit]) : fill(t(many[unit]), { n });
}
