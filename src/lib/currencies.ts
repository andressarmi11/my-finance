import { formatMoney } from '@/domain/money/format';

/**
 * The currencies a single transaction can be entered in (redesign §9b). The
 * list is the one domain/money/format.ts knows how to write, so any amount
 * shown in its original currency is formatted the same way as the main one.
 */
export interface CurrencyInfo {
  code: string;
  flag: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'COP', flag: '🇨🇴' },
  { code: 'USD', flag: '🇺🇸' },
  { code: 'EUR', flag: '🇪🇺' },
  { code: 'MXN', flag: '🇲🇽' },
  { code: 'ARS', flag: '🇦🇷' },
  { code: 'CLP', flag: '🇨🇱' },
  { code: 'PEN', flag: '🇵🇪' },
];

export const DEFAULT_QUICK_CURRENCIES = ['COP', 'USD', 'EUR'];

export function flagOf(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.flag ?? '💱';
}

/**
 * The chips shown before "Más": the user's quick currencies (max 3), with the
 * main currency always among them — it's the one most entries use.
 */
export function quickCurrencyList(main: string, quick: string[] | undefined): string[] {
  const base = (quick?.length ? quick : DEFAULT_QUICK_CURRENCIES).filter((c) => CURRENCIES.some((x) => x.code === c));
  const list = base.includes(main) ? base : [main, ...base];
  return list.slice(0, Math.max(3, list.indexOf(main) + 1));
}

/** An amount written in its own currency ("$20", "20 €"). */
export function formatMoneyIn(amount: number, code: string): string {
  return formatMoney(amount, code);
}

/** The amount in the main currency: always an integer, like every amount in the app. */
export function convert(originalAmount: number, fxRate: number): number {
  return Math.round(originalAmount * fxRate);
}

/** "4.000" / "4.016,06" — a rate written the way the app writes numbers (2 decimals max). */
export function formatRate(rate: number): string {
  const rounded = Math.round(rate * 100) / 100;
  const [int, dec] = String(rounded).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${grouped},${dec}` : grouped;
}
