/**
 * Proximos movimientos: lo que todavia no se ejecuto, gastos E ingresos.
 *
 * NO filtra por fecha: recibe la lista ya acotada al mes visible por quien
 * llama. Antes barria todas las transacciones sin tope, y como
 * materialize.ts crea recurrentes hasta 95 dias adelante, el dashboard
 * mostraba pagos de dentro de tres meses. Se acota afuera, con el mismo
 * criterio de quincena que usa el resto del dashboard, para que "falta
 * pagar" del hero y "esperas gastar" de aca nunca digan cosas distintas.
 */
import { compareISO } from '@/domain/dates';
import { fechaDeCargo } from '@/domain/periodo/fechaDeCargo';
import type { Transaction } from '@/domain/types';

/**
 * La fecha que importa: la de pago de la TC si existe, si no la del
 * movimiento. Vivia aca, y por estar en una carpeta de feature Analisis
 * nunca la uso — ver domain/periodo/fechaDeCargo.ts. Se conserva el nombre
 * para no tocar los call sites de esta pantalla.
 */
export const relevantDate = fechaDeCargo;

function isUpcoming(tx: Transaction): boolean {
  return tx.status === 'pending' || tx.status === 'scheduled';
}

/** Los `limit` mas cercanos a la fecha, primero lo que vence antes. */
export function selectUpcoming(monthTransactions: Transaction[], limit = 8): Transaction[] {
  return monthTransactions
    .filter(isUpcoming)
    .slice()
    .sort((a, b) => compareISO(relevantDate(a), relevantDate(b)))
    .slice(0, limit);
}

/** Lo que esperas recibir y lo que esperas gastar en el mes. */
export function upcomingTotals(monthTransactions: Transaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of monthTransactions) {
    if (!isUpcoming(t)) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense };
}
