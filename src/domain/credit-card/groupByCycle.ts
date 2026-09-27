/**
 * Agrupa compras de TC por su fecha de pago (el ciclo al que pertenecen).
 * Es la mitad "agregada" de la vista hibrida que pediste: cada compra se
 * ve individual, pero tambien como parte de un total por ciclo — el
 * equivalente calculado de la fila "Pago compras TC" de tu Excel.
 */
import { compareISO } from '../dates';
import { calcularDisponible, type Disponible } from './disponible';
import type { ISODate, PaymentMethod, Transaction } from '../types';

export interface CreditCycleGroup {
  paymentDate: string;
  total: number;
  count: number;
  transactions: Transaction[];
}

export function groupByCycle(creditTransactions: Transaction[]): CreditCycleGroup[] {
  const byDate = new Map<string, Transaction[]>();
  for (const tx of creditTransactions) {
    if (tx.status === 'cancelled' || !tx.cyclePaymentDate) continue;
    const list = byDate.get(tx.cyclePaymentDate) ?? [];
    list.push(tx);
    byDate.set(tx.cyclePaymentDate, list);
  }

  const groups: CreditCycleGroup[] = [];
  for (const [paymentDate, txs] of byDate) {
    const sorted = txs.slice().sort((a, b) => compareISO(a.date, b.date));
    groups.push({
      paymentDate,
      total: sorted.reduce((acc, t) => acc + t.amount, 0),
      count: sorted.length,
      transactions: sorted,
    });
  }
  return groups.sort((a, b) => compareISO(a.paymentDate, b.paymentDate));
}

export interface CardCycles {
  tarjeta: PaymentMethod;
  /** null si la tarjeta no tiene cupo configurado. */
  disponible: Disponible | null;
  cycles: CreditCycleGroup[];
}

/**
 * Lo mismo, pero partido POR TARJETA primero y ciclo adentro.
 *
 * groupByCycle solo agrupa por fecha de pago, que alcanzaba cuando habia
 * una sola tarjeta. Con dos, dos compras distintas pueden caer el mismo
 * dia de pago y quedaban sumadas en una fila que no significa nada: cada
 * tarjeta se paga aparte.
 *
 * Se devuelven TODAS las tarjetas, incluso sin compras, porque su cupo
 * disponible sigue siendo informacion que el usuario quiere ver.
 */
export function groupByCard(
  tarjetas: PaymentMethod[],
  transacciones: Transaction[],
  hoy: ISODate,
): CardCycles[] {
  const credito = tarjetas.filter((t) => t.type === 'credit');
  const porTarjeta = new Map<string, Transaction[]>(credito.map((t) => [t.id, []]));

  for (const tx of transacciones) {
    if (!tx.paymentMethodId) continue;
    porTarjeta.get(tx.paymentMethodId)?.push(tx);
  }

  return credito.map((tarjeta) => {
    const suyas = porTarjeta.get(tarjeta.id) ?? [];
    return {
      tarjeta,
      disponible: calcularDisponible(tarjeta, suyas, hoy),
      cycles: groupByCycle(suyas),
    };
  });
}
