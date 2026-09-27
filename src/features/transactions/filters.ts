/**
 * List filters: type and status.
 *
 * They are PRESENTATION, not domain: they narrow what gets listed and
 * don't touch the header's balance. If the filter changed that number,
 * choosing "Expenses" would show a remaining amount that doesn't exist —
 * a period's remaining amount is the period's, not whatever you left
 * visible.
 */
import type { Transaction } from '@/domain/types';

export type TypeFilter = 'todos' | 'expense' | 'income';
export type StatusFilter = 'todos' | 'pendientes' | 'pagados';

/**
 * "Pendientes" includes SCHEDULED ones.
 *
 * TransactionStatus has four values and the code grouped them two
 * different ways depending on the file: porPagar.ts keeps pending
 * separate from scheduled but adds them together, upcoming.ts merges
 * them, available.ts only looks at whether it's paid. A filter forces
 * picking one, and the one picked is what two of the three already use
 * and what it means to the user: "what's left".
 *
 * `cancelled` doesn't appear under ANY filter: a cancelled transaction is
 * neither pending nor paid.
 */
export function applyFilters<T extends Transaction>(
  transacciones: T[],
  type: TypeFilter,
  status: StatusFilter,
): T[] {
  if (type === 'todos' && status === 'todos') return transacciones;

  return transacciones.filter((tx) => {
    if (type !== 'todos' && tx.type !== type) return false;
    if (status === 'pagados') return tx.status === 'paid';
    if (status === 'pendientes') return tx.status === 'pending' || tx.status === 'scheduled';
    return true;
  });
}
