/**
 * Guarda y borra compras diferidas: N cuotas que son N transacciones.
 *
 * Vive en data/ y no en domain/ porque escribe. El reparto en si —cuanto
 * vale cada cuota y cuando se paga— es puro y vive en
 * domain/credit-card/diferido.ts.
 */
import { expandirDiferido } from '@/domain/credit-card/diferido';
import type { PaymentMethod, Transaction } from '@/domain/types';
import { nowISO } from '@/lib/todayISO';
import { db } from '../db';
import { localRepository } from './localRepository';

/**
 * El id de una cuota ES su identidad: grupo + numero.
 *
 * Determinista y no aleatorio, por la misma razon que occurrenceId en
 * materialize.ts: la lapida de borrado guarda el id de la fila, y con un
 * id aleatorio no habria forma de saber que cuota murio una vez borrada.
 */
export function cuotaId(grupoId: string, numero: number): string {
  return `${grupoId}:cuota-${numero}`;
}

/**
 * Crea las N cuotas de un diferido en un solo lote.
 *
 * `base` es la compra tal como la armo el formulario: concepto, categoria,
 * metodo, y el monto TOTAL. De ahi salen las cuotas.
 */
export async function crearDiferido(
  base: Transaction,
  cuotas: number,
  metodo: PaymentMethod | undefined,
  valorCuota?: number,
): Promise<void> {
  const grupoId = base.installmentGroupId ?? crypto.randomUUID();
  const repartidas = expandirDiferido(
    base.date, base.amount, cuotas, metodo?.cutoffDay, metodo?.paymentDay, valorCuota,
  );
  const now = nowISO();

  const filas: Transaction[] = repartidas.map((c) => ({
    ...base,
    id: cuotaId(grupoId, c.numero),
    amount: c.amount,
    date: c.date,
    // Una compra con tarjeta no esta pagada el dia que la pasas: se debe
    // hasta el extracto. Igual que en la spec 1.
    status: 'pending',
    cycleCutoffDate: c.cycleCutoffDate,
    cyclePaymentDate: c.cyclePaymentDate,
    installmentGroupId: grupoId,
    installmentNumber: c.numero,
    installmentCount: repartidas.length,
    purchaseDate: base.date,
    createdAt: base.createdAt || now,
    updatedAt: now,
  }));

  // saveTransaction y no bulkPut: alimenta el conceptIndex del smart-fill.
  // Solo la primera, o doce cuotas contarian como doce usos del concepto e
  // inflarian su ranking en el autocompletado.
  await localRepository.saveTransaction(filas[0]!);
  if (filas.length > 1) await db.transactions.bulkPut(filas.slice(1));
}

/** Las cuotas hermanas de una, incluida ella. Vacio si no es un diferido. */
export async function cuotasDelGrupo(tx: Transaction): Promise<Transaction[]> {
  if (!tx.installmentGroupId) return [];
  const grupo = tx.installmentGroupId;
  // filter y no where: transactions no indexa installmentGroupId en Dexie.
  return db.transactions.filter((t) => t.installmentGroupId === grupo).toArray();
}

/**
 * Borra el diferido COMPLETO. Un diferido con un hueco en la cuota 7 no
 * significa nada, y borrarlas de a una descuadra el cupo en silencio.
 *
 * Cada cuota se borra por localRepository para que deje su propia lapida y
 * el borrado viaje entre dispositivos.
 */
export async function borrarDiferido(tx: Transaction): Promise<number> {
  const cuotas = await cuotasDelGrupo(tx);
  if (cuotas.length === 0) {
    await localRepository.deleteTransaction(tx.id);
    return 1;
  }
  for (const cuota of cuotas) await localRepository.deleteTransaction(cuota.id);
  return cuotas.length;
}
