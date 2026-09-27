/**
 * Cuando SALE la plata de un movimiento.
 *
 * Para casi todo es su propia fecha. Para una compra con tarjeta es el dia
 * en que se paga el extracto, que puede ser dos meses despues.
 *
 * Vive en domain/ y no en una carpeta de feature porque la respuesta tiene
 * que ser UNA. Nacio dentro de features/dashboard/upcoming.ts, y mientras
 * estuvo ahi Analisis no la uso: filtraba por tx.date crudo y contaba las
 * compras con tarjeta el dia que las pasaste. Es el mismo bug que ya se
 * habia arreglado en el balance (ver domain/periodo/resolve.ts) y que
 * sobrevivio en la otra pantalla justamente por estar duplicada la idea.
 *
 * Distinto de resolverPeriodoDeCargo: aquel devuelve la CLAVE del periodo
 * de pago, que sirve para agrupar por quincena. Esto devuelve la FECHA,
 * que es lo que necesita quien trabaja con rangos de calendario.
 */
import type { ISODate, Transaction } from '../types';

export function fechaDeCargo(tx: Transaction): ISODate {
  return tx.cyclePaymentDate ?? tx.date;
}
