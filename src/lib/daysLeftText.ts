import type { TextKey } from '@/i18n/texts';
import { fill } from './dateLabels';

/** "faltan 5 días", "falta 1 día", "último día": what's left of the period running now. */
export function daysLeftText(t: (key: TextKey) => string, n: number): string {
  if (n <= 0) return t('period.lastDay');
  if (n === 1) return t('period.oneDayLeft');
  return fill(t('period.daysLeft'), { n });
}
