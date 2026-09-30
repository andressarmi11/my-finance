const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Module state, same as setMoneyLocale in domain/money/format.ts. It's done
 * this way rather than passing the language as a parameter because
 * formatShortDate is called from dozens of places, and threading the
 * language through all of them would be noise in every signature.
 * LanguageProvider sets it on mount and on change.
 */
let MONTHS = MONTHS_ES;
let LANGUAGE: 'es' | 'en' = 'es';

export function setShortMonthNames(language: 'es' | 'en'): void {
  MONTHS = language === 'en' ? MONTHS_EN : MONTHS_ES;
  LANGUAGE = language;
}

/** '2026-09-17' -> '17 Sep' (capitalised, as the prototype writes it). UI only; never use this in domain/. */
export function formatShortDate(iso: string): { day: number; month: string; monthIndex: number } {
  const parts = iso.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  if (m === undefined || d === undefined) throw new Error(`Fecha invalida: "${iso}"`);
  const monthName = MONTHS[m - 1];
  if (monthName === undefined) throw new Error(`Mes invalido en fecha: "${iso}"`);
  return { day: d, month: monthName, monthIndex: m };
}

/** "29 Sep" / "Sep 29": the day and the month in the order each language writes them. */
export function shortDay(iso: string): string {
  const { day, month } = formatShortDate(iso);
  return LANGUAGE === 'en' ? `${month} ${day}` : `${day} ${month}`;
}

/**
 * A span of days: "10 – 24 Sep" / "25 Sep – 9 Oct", and in English
 * "Sep 10 – 24" / "Sep 25 – Oct 9" (the prototype's wording).
 */
export function shortRange(start: string, end: string): string {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  if (LANGUAGE === 'en') return s.month === e.month ? `${s.month} ${s.day} – ${e.day}` : `${s.month} ${s.day} – ${e.month} ${e.day}`;
  return s.month === e.month ? `${s.day} – ${e.day} ${s.month}` : `${s.day} ${s.month} – ${e.day} ${e.month}`;
}
