/**
 * The bridge between what the parser understands ("con la tarjeta") and
 * what the user actually has set up.
 *
 * It lives apart from the parser because the parser is pure and knows
 * nothing about the database: it returns a method TYPE, and here we look up
 * which of the user's real methods that corresponds to.
 */
import type { Id, PaymentMethod, PaymentMethodType } from '../types';

/** The user's first method of that type, or null if they have none. */
export function methodByType(
  methodRows: PaymentMethod[],
  type: PaymentMethodType | null,
): Id | null {
  if (!type) return null;
  const exact = methodRows.find((m) => m.type === type);
  return exact?.id ?? null;
}

/**
 * The category to propose, giving priority to what's been learned.
 *
 * The keyword table is the floor: if the user has saved that concept under
 * another category before, that one wins. It's what makes the app get
 * better with use instead of being stuck with what someone guessed once.
 */
export function finalCategory(
  learned: Id | null,
  sugerida: Id | null,
  categoriasExistentes: Id[],
): Id | null {
  const exists = (id: Id | null) => id !== null && categoriasExistentes.includes(id);
  if (exists(learned)) return learned;
  if (exists(sugerida)) return sugerida;
  return null;
}
