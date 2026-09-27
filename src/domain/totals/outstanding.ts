/**
 * El desglose de lo que falta pagar, en conjuntos DISJUNTOS.
 *
 * Existe porque el desglose se armaba en el componente con tres filtros
 * independientes, y un gasto pendiente pagado con tarjeta cumplía dos a la
 * vez. Consecuencias que se veían en pantalla:
 *   - el chip decía "7 · $500.000" cuando había 5 movimientos: el conteo
 *     sumaba duplicados al lado de un total que no los sumaba;
 *   - el sheet sumaba la plata TRES veces por separado, así que mostraba
 *     un total mayor que el del hero que lo abrió, y listaba el mismo
 *     movimiento dos veces.
 *
 * La regla de desempate: un gasto con fecha de pago de tarjeta es "en
 * tarjeta" y no cuenta en los otros dos. Es la que le sirve al usuario —
 * lo que importa de una compra con tarjeta es cuándo sale la plata, no en
 * qué estado quedó la fila.
 */
import type { Transaction } from '../types';

export interface PorPagar {
  /** Pendientes SIN tarjeta. */
  pendientes: Transaction[];
  /** Programados SIN tarjeta. */
  programados: Transaction[];
  /** Todo lo que se paga por tarjeta, pendiente o programado. */
  enTarjeta: Transaction[];
  /** Cuántos movimientos en total. Cada uno contado una sola vez. */
  count: number;
  /** Cuánta plata en total. Igual a MonthFlow.porPagar, por construcción. */
  monto: number;
}

export function calculatePorPagar(transactions: Transaction[]): PorPagar {
  const pendientes: Transaction[] = [];
  const programados: Transaction[] = [];
  const enTarjeta: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (tx.status === 'paid' || tx.status === 'cancelled') continue;

    if (tx.cyclePaymentDate) enTarjeta.push(tx);
    else if (tx.status === 'scheduled') programados.push(tx);
    else pendientes.push(tx);
  }

  const todos = [...pendientes, ...programados, ...enTarjeta];
  return {
    pendientes,
    programados,
    enTarjeta,
    count: todos.length,
    monto: todos.reduce((a, t) => a + t.amount, 0),
  };
}
