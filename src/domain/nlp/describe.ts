/**
 * Returns, in Spanish, what the app understood, so the user can confirm
 * it at a glance before saving.
 *
 * This is text built from templates, not generated: it has to say
 * exactly what's going to be saved. A "natural" reply that doesn't match
 * the saved data is worse than a stiff one that does.
 */
import { formatMoney } from '../money/format';
import type { Category, ISODate, PaymentMethod } from '../types';
import type { Parsed } from './parse';

const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "hoy" (today), "ayer" (yesterday), or "el 15 de septiembre" (15 September). */
export function describeDate(date: ISODate, today: ISODate): string {
  if (date === today) return 'hoy';
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hy, hm, hd] = today.split('-').map(Number) as [number, number, number];
  const payDays = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000,
  );
  if (payDays === -1) return 'ayer';
  if (payDays === -2) return 'anteayer';
  if (payDays === 1) return 'mañana';
  return `el ${d} de ${SPANISH_MONTHS[m - 1]}`;
}

export interface Description {
  /** The main line: what's going to be saved. */
  summary: string;
  /** What's missing before it can be saved, if anything is missing. */
  missing: string | null;
  /** Why it picked that category, when it did. */
  note: string | null;
}

export function describeParsed(
  parsed: Parsed,
  contexto: {
    today: ISODate;
    categoryId: string | null;
    cats: Category[];
    paymentMethodId: string | null;
    methodRows: PaymentMethod[];
    /** true if the category came from the user's history, not from the table. */
    learned: boolean;
  },
): Description {
  const verb = parsed.type === 'income' ? 'Ingreso' : 'Gasto';
  const cat = contexto.cats.find((c) => c.id === contexto.categoryId);
  const met = contexto.methodRows.find((m) => m.id === contexto.paymentMethodId);

  const parts: string[] = [];
  parts.push(parsed.amount != null ? `${verb} de ${formatMoney(parsed.amount)}` : verb);
  if (parsed.concept) parts.push(`en ${parsed.concept}`);
  parts.push(describeDate(parsed.date, contexto.today));
  if (met) parts.push(`con ${met.name}`);

  const summary = `${parts.join(', ')}.`;

  const missing = parsed.amount == null
    ? '¿Cuánto fue?'
    : !parsed.concept
    ? '¿En qué fue?'
    : null;

  const note = cat
    ? contexto.learned
      ? `Lo puse en ${cat.name}, como la última vez.`
      : `Lo puse en ${cat.name}.`
    : parsed.concept
    ? 'No le encontré categoría; elígela y la recuerdo para la próxima.'
    : null;

  return { summary, missing, note };
}
