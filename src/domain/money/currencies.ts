/**
 * Currencies offered during onboarding. Each one carries its own locale
 * because the format depends on the pair: 'es-CO' + COP gives "$ 2,500,000",
 * 'en-US' + COP would give "COP 2,500,000".
 *
 * The list is deliberately short: these are the ones for the region where
 * the app is used. Adding one is a single line; a picker for all 180 of
 * ISO 4217 is not.
 */
import { formatMoney } from './format';

export interface CurrencyOption {
  code: string;
  locale: string;
  label: string;
  /** Sample amount, to show how it will look before choosing. */
  sampleAmount: number;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'COP', locale: 'es-CO', label: 'Peso colombiano', sampleAmount: 2_500_000 },
  { code: 'MXN', locale: 'es-MX', label: 'Peso mexicano', sampleAmount: 2_500 },
  { code: 'ARS', locale: 'es-AR', label: 'Peso argentino', sampleAmount: 2_500 },
  { code: 'CLP', locale: 'es-CL', label: 'Peso chileno', sampleAmount: 2_500 },
  { code: 'PEN', locale: 'es-PE', label: 'Sol peruano', sampleAmount: 2_500 },
  { code: 'USD', locale: 'en-US', label: 'Dólar estadounidense', sampleAmount: 2_500 },
  { code: 'EUR', locale: 'es-ES', label: 'Euro', sampleAmount: 2_500 },
];

/**
 * The example is computed, not written by hand. When these were hardcoded,
 * one of them was wrong ("2.500 €" when the real format was different) and
 * nobody noticed: onboarding promised the user a format the app didn't
 * actually use afterwards.
 */
export function currencySample(c: CurrencyOption): string {
  return formatMoney(c.sampleAmount, c.code);
}

export function currencyByCode(code: string): CurrencyOption | undefined {
  return CURRENCIES.find((c) => c.code === code);
}
