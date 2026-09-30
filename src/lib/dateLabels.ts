import { monthName } from '@/components/ui/MonthNav';
import { formatShortDate } from '@/lib/formatShortDate';
import type { TextKey } from '@/i18n/texts';

/** '{n}' style placeholders: the dictionary has no interpolation of its own. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);
}

/**
 * '2026-10-15' as "15 oct" / "Oct 15" or "15 de octubre" / "Oct 15". The word
 * ORDER is what differs between languages, so it lives in the dictionary
 * templates (date.short / date.long) instead of a concatenation here.
 */
export function dateLabel(iso: string, t: (k: TextKey) => string, kind: 'short' | 'long' = 'short'): string {
  const { day, month, monthIndex } = formatShortDate(iso);
  return fill(t(kind === 'short' ? 'date.short' : 'date.long'), {
    day, monthShort: month, monthLong: monthName(monthIndex).toLowerCase(), // Spanish writes months in lowercase
  });
}
