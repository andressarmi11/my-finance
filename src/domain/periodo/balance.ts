/**
 * Restante por periodo y sobrante del mes.
 *
 * Regla (viene directo del Excel original): el restante de un periodo es
 * ingresos - gastos de ese periodo, SIN filtrar por si ya estan pagados
 * (el "listo" es seguimiento aparte, no cambia la matematica).
 * "Cancelado" si se excluye: un gasto cancelado nunca debio contar.
 *
 * "Sobrante del mes" = la suma de los restantes de sus periodos. Antes eran
 * siempre dos; ahora son los que haya, uno si te pagan una vez al mes.
 *
 * Se suma por el periodo de CARGO, no por el de registro: una compra con
 * tarjeta no te quita la plata el dia que la haces, sino el dia que pagas
 * el extracto. Son la misma clave para todo lo que no es tarjeta.
 * Ver domain/periodo/resolve.ts.
 */
import { periodosDelMes, DIAS_DE_PAGO_POR_DEFECTO, type DiasDePago } from './periodo';
import type { PeriodosResueltos } from './resolve';
import type { QuincenaKey, Transaction } from '../types';

export interface PeriodoBalance {
  key: QuincenaKey;
  income: number;
  expense: number;
  restante: number;
}

export interface MonthBalance {
  year: number;
  month: number;
  income: number;
  expense: number;
  sobrante: number;
  /** Uno por dia de pago, en orden. */
  periodos: PeriodoBalance[];
}

/**
 * transactions ya debe traer los dos periodos resueltos (conPeriodoResuelto).
 * Este archivo no importa calcularPeriodo para no acoplar "sumar" con
 * "calcular fecha" — se prueban por separado.
 */
export function calcularBalancePeriodo(
  transactionsWithKey: Array<Transaction & PeriodosResueltos>,
  key: QuincenaKey,
): PeriodoBalance {
  let income = 0;
  let expense = 0;
  for (const tx of transactionsWithKey) {
    if (tx.status === 'cancelled') continue;
    if (tx.resolvedCargoKey !== key) continue;
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { key, income, expense, restante: income - expense };
}

export function calcularBalanceMes(
  transactionsWithKey: Array<Transaction & PeriodosResueltos>,
  year: number,
  month: number,
  dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO,
): MonthBalance {
  const periodos = periodosDelMes(year, month, dias)
    .map((key) => calcularBalancePeriodo(transactionsWithKey, key));

  return {
    year,
    month,
    income: periodos.reduce((a, p) => a + p.income, 0),
    expense: periodos.reduce((a, p) => a + p.expense, 0),
    sobrante: periodos.reduce((a, p) => a + p.restante, 0),
    periodos,
  };
}
