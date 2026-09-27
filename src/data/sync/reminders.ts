/**
 * Que recordatorios se pueden subir.
 *
 * Mas simple que los presupuestos: el id de un recordatorio ES el id de su
 * movimiento, asi que dos dispositivos generan el mismo id para el mismo
 * recordatorio y basta con last-write-wins por id. No hay clave natural
 * que reconciliar.
 *
 * Lo que si hay que vigilar es la FK: en Postgres reminders.transaction_id
 * apunta a transactions(id). Subir el recordatorio de un movimiento que ya
 * no existe no falla solo; tumba el push entero, y con el la subida de
 * todo lo demas que venia detras.
 */
import type { Reminder } from '@/domain/types';
import { masNuevo } from './masNuevo';

export function recordatoriosASubir(
  locales: Reminder[],
  remotos: Reminder[],
  /** Ids de movimientos que existen y no estan borrados. */
  movimientosVivos: Set<string>,
): Reminder[] {
  const remotoPorId = new Map(remotos.map((r) => [r.id, r]));
  return locales.filter((r) => {
    if (!movimientosVivos.has(r.transactionId)) return false;
    const remoto = remotoPorId.get(r.id);
    return !remoto || masNuevo(r.updatedAt, remoto.updatedAt);
  });
}
