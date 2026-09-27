const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Estado de modulo, igual que setMoneyLocale en domain/money/format.ts.
 * Se hace asi y no pasando el idioma por parametro porque formatShortDate
 * se llama desde decenas de sitios y encadenar el idioma por todos seria
 * ruido en cada firma. Lo fija IdiomaProvider al montar y al cambiar.
 */
let MONTHS = MESES_ES;

export function setMesesLocales(idioma: 'es' | 'en'): void {
  MONTHS = idioma === 'en' ? MESES_EN : MESES_ES;
}

/** '2026-09-17' -> '17 sep'. Solo para UI; nunca usar esto en domain/. */
export function formatShortDate(iso: string): { day: number; month: string; monthIndex: number } {
  const parts = iso.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  if (m === undefined || d === undefined) throw new Error(`Fecha invalida: "${iso}"`);
  const monthName = MONTHS[m - 1];
  if (monthName === undefined) throw new Error(`Mes invalido en fecha: "${iso}"`);
  return { day: d, month: monthName, monthIndex: m };
}
