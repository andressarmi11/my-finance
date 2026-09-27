/**
 * Puente entre "a que periodo pertenece esta transaccion" y "sumar por
 * periodo". Vive separado de balance.ts para que aquel se pueda probar con
 * datos de fixture sin depender del calculo de fechas.
 *
 * Una transaccion cae en DOS periodos distintos, y confundirlos era el bug:
 *
 *   REGISTRO — cuando la hiciste. Es lo que ordena la lista y el calendario.
 *              Sale de tx.date.
 *   CARGO    — cuando sale la plata. Es lo que descuenta del restante.
 *              Para una compra con tarjeta de credito es el dia en que se
 *              paga el extracto, que puede ser dos meses despues.
 *
 * Para todo lo que no es tarjeta los dos coinciden, que es por lo que la
 * distincion no hacia falta hasta ahora.
 */
import { calcularPeriodo, DIAS_DE_PAGO_POR_DEFECTO, type DiasDePago } from './periodo';
import type { QuincenaKey, Transaction } from '../types';

/**
 * Donde se REGISTRA: la quincena o el mes en que la hiciste.
 *
 * tx.quincenaKey manda si esta puesta a mano; si no, se calcula.
 *
 * El nombre del campo sigue siendo quincenaKey porque asi se llama la
 * columna en Postgres y renombrarla pediria una migracion sin ganar nada:
 * el contenido es, y siempre fue, la clave del periodo.
 */
export function resolverPeriodo(tx: Transaction, dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO): QuincenaKey {
  return tx.quincenaKey ?? calcularPeriodo(tx.date, dias).key;
}

/**
 * Donde se CARGA: el periodo del que sale la plata.
 *
 * Una compra con tarjeta no toca tu bolsillo el dia que la haces, sino el
 * dia que pagas el extracto — por eso se resuelve sobre cyclePaymentDate,
 * que ya viene calculado y guardado en la transaccion desde que se crea
 * (ver domain/credit-card/cycle.ts). El periodo sale del MISMO
 * calcularPeriodo de siempre, asi que la regla de bordes ya estaba bien:
 * un pago el 2 de noviembre cae en la quincena del 25 de octubre, que va
 * del 25 al 9; si te pagan una vez al mes, cae en noviembre completo.
 *
 * quincenaKey sigue mandando: si moviste el movimiento a mano, esa decision
 * pesa mas que el ciclo de la tarjeta — y es la valvula de escape para
 * cualquier caso raro (un diferido, una compra que acordaste pagar aparte).
 */
export function resolverPeriodoDeCargo(tx: Transaction, dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO): QuincenaKey {
  return tx.quincenaKey ?? calcularPeriodo(tx.cyclePaymentDate ?? tx.date, dias).key;
}

export interface PeriodosResueltos {
  /** Donde se lista. */
  resolvedQuincenaKey: QuincenaKey;
  /** De donde sale la plata. Distinto del anterior solo en compras con TC. */
  resolvedCargoKey: QuincenaKey;
}

export function conPeriodoResuelto<T extends Transaction>(
  transactions: T[],
  dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO,
): Array<T & PeriodosResueltos> {
  return transactions.map((tx) => ({
    ...tx,
    resolvedQuincenaKey: resolverPeriodo(tx, dias),
    resolvedCargoKey: resolverPeriodoDeCargo(tx, dias),
  }));
}
