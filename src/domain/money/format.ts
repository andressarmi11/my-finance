/**
 * Money formatting. Defaults to Colombian ($ 2.500.000, dot as thousands
 * separator, no decimals), but the currency and locale are chosen by the
 * user during onboarding.
 *
 * The default is a module-level variable, not a required parameter, on
 * purpose: there are ~40 call sites of formatMoney() in the UI and none
 * of them should have to carry Settings around. The app sets it once on
 * startup (see useMoneyFormat) and every format follows from that.
 *
 * Does NOT use Intl.NumberFormat with style:'currency'. Reason: the
 * native app (mobile/) formats the same money for the same user, and the
 * CLDR data Dart ships isn't the same as the browser's — es-PE groups
 * with a comma here and a dot there, and es-ES doesn't group 4-digit
 * numbers ("2500 €") while Dart does. The table below is duplicated,
 * identically, in mobile/lib/domain/money/format.dart, and both test
 * suites verify it: it's the only way both apps write the same figure
 * the same way.
 */

interface CurrencyFormat {
  simbolo: string;
  /** true = the symbol goes after the number ("2.500 €"). */
  sufijo?: boolean;
  /** Space between symbol and number? */
  espacio?: boolean;
  /** Thousands separator. */
  miles: string;
}

const FORMATS: Record<string, CurrencyFormat> = {
  COP: { simbolo: '$', miles: '.' },
  MXN: { simbolo: '$', miles: ',', espacio: false },
  ARS: { simbolo: '$', miles: '.' },
  CLP: { simbolo: '$', miles: '.', espacio: false },
  PEN: { simbolo: 'S/', miles: ',' },
  USD: { simbolo: '$', miles: ',', espacio: false },
  EUR: { simbolo: '€', miles: '.', sufijo: true },
};

let current = { locale: 'es-CO', currency: 'COP' };

/** Set by the app when Settings load. Without calling it, stays on COP. */
export function setMoneyLocale(locale: string, currency: string): void {
  current = { locale, currency };
}

function formatFor(currency: string): CurrencyFormat {
  return FORMATS[currency] ?? { simbolo: currency, miles: '.' };
}

/** Groups in threes from the right. Deterministic, doesn't depend on CLDR. */
function group(n: number, separador: string): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separador);
}

/**
 * The locale is not a parameter: with the table above, the currency
 * alone decides the format. It's still kept in Settings because the
 * dates use it.
 */
export function formatMoney(amount: number, currency = current.currency): string {
  const f = formatFor(currency);
  const sign = amount < 0 ? '-' : '';
  const body = group(Math.abs(Math.round(amount)), f.miles);
  const sep = f.espacio === false ? '' : ' ';
  return f.sufijo ? `${sign}${body}${sep}${f.simbolo}` : `${sign}${f.simbolo}${sep}${body}`;
}

/** Just the active currency's symbol ('$', '€'...), for axes and short labels. */
export function currencySymbol(): string {
  return formatFor(current.currency).simbolo;
}

/** Compact version for charts: $ 2,5 M */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const sym = currencySymbol();
  if (abs >= 1_000_000) {
    return `${sign}${sym} ${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1_000) return `${sign}${sym} ${Math.round(abs / 1_000)} k`;
  return `${sign}${sym} ${abs}`;
}

/**
 * Accepts whatever the user types: '85000', '85.000', '$ 85.000', '85,000'.
 * Returns null if there's no valid number.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
