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

/**
 * Starting rates, only for someone whose main currency is COP — the app is
 * local-first and never asks a rates API. They're a starting point the sheet
 * shows and lets you edit; the last rate you used replaces them.
 */
const STARTING_RATES_COP: Record<string, number> = {
  USD: 4000, EUR: 4400, MXN: 220, ARS: 4, CLP: 4, PEN: 1100,
};

const RATES_KEY = 'fx.rates';

function readRates(): Record<string, Record<string, number>> {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Record<string, number>>) : {};
  } catch {
    return {};
  }
}

/** The rate to suggest for `currency` → `main`: the last one used, or a starting one. null = ask. */
export function suggestedRate(currency: string, main: string): number | null {
  if (currency === main) return 1;
  const remembered = readRates()[main]?.[currency];
  if (remembered && remembered > 0) return remembered;
  return main === 'COP' ? STARTING_RATES_COP[currency] ?? null : null;
}

export function rememberRate(currency: string, main: string, rate: number): void {
  if (currency === main || !(rate > 0)) return;
  try {
    const all = readRates();
    all[main] = { ...(all[main] ?? {}), [currency]: rate };
    localStorage.setItem(RATES_KEY, JSON.stringify(all));
  } catch {
    // Private mode: the rate just won't be remembered.
  }
}

/** The amount in the main currency: always an integer, like every amount in the app. */
export function convert(originalAmount: number, fxRate: number): number {
  return Math.round(originalAmount * fxRate);
}

/** "4.000" / "4.350,5" — a rate written the way the app writes numbers. */
export function formatRate(rate: number): string {
  const [int, dec] = String(rate).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${grouped},${dec}` : grouped;
}

/** Accepts "4.000", "4000", "4350,5". Returns null when it isn't a positive number. */
export function parseRate(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}
