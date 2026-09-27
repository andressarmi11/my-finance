const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Module state, same as setMoneyLocale in domain/money/format.ts. It's done
 * this way rather than passing the language as a parameter because
 * formatShortDate is called from dozens of places, and threading the
 * language through all of them would be noise in every signature.
 * LanguageProvider sets it on mount and on change.
 */
let MONTHS = MONTHS_ES;

export function setShortMonthNames(language: 'es' | 'en'): void {
  MONTHS = language === 'en' ? MONTHS_EN : MONTHS_ES;
}

/** '2026-09-17' -> '17 sep'. UI only; never use this in domain/. */
export function formatShortDate(iso: string): { day: number; month: string; monthIndex: number } {
  const parts = iso.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  if (m === undefined || d === undefined) throw new Error(`Fecha invalida: "${iso}"`);
  const monthName = MONTHS[m - 1];
  if (monthName === undefined) throw new Error(`Mes invalido en fecha: "${iso}"`);
  return { day: d, month: monthName, monthIndex: m };
}
