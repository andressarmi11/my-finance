/**
 * Reparte una compra diferida en N cuotas.
 *
 * A diferencia de una regla recurrente, un diferido es FINITO y se conoce
 * entero el dia de la compra: las N cuotas se calculan de una sola vez y
 * nunca hay que volver. Por eso esto no necesita el aparato de
 * data/local/materialize.ts (ventana, re-expansion, indice unico).
 *
 * Funcion pura: no escribe nada. Quien llama arma las transacciones.
 */
import { clampDay, parseISO, shiftMonth, toISO } from '../dates';
import { calculateCreditCardCycle } from './cycle';
import type { ISODate } from '../types';

export interface Cuota {
  /** 1..N */
  numero: number;
  amount: number;
  date: ISODate;
  cycleCutoffDate: ISODate;
  cyclePaymentDate: ISODate;
}

export function expandirDiferido(
  purchaseDate: ISODate,
  total: number,
  cuotas: number,
  cutoffDay?: number,
  paymentDay?: number,
  /**
   * Lo que de verdad cobra el banco por cuota, cuando hay interes. Si
   * viene, manda sobre el reparto y la suma de las cuotas supera al total
   * — esa diferencia ES el interes. La app no calcula tasas.
   */
  valorCuota?: number,
): Cuota[] {
  // 1 o menos no es un diferido. Se tolera 0 y negativos en vez de
  // reventar: quien llama ya decide no guardar los campos de cuotas.
  const n = Number.isInteger(cuotas) && cuotas > 1 ? cuotas : 1;
  const { y, m, d } = parseISO(purchaseDate);

  const montos = valorCuota && valorCuota > 0
    ? Array.from({ length: n }, () => valorCuota)
    : repartir(total, n);

  return montos.map((amount, i) => {
    // La cuota i+1 es la compra corrida i meses. clampDay por los meses
    // cortos: comprar un 31 de enero pone la segunda cuota el 28 de feb.
    const ym = shiftMonth(y, m, i);
    const date = toISO({ ...ym, d: clampDay(ym.y, ym.m, d) });

    // El ciclo sale de la fecha de CADA cuota. No hace falta aritmetica
    // especial: compra el 20 sep con corte 15 y pago 2 da cuotas que pagan
    // el 2 nov, 2 dic y 2 ene — consecutivas, solas.
    const ciclo = calculateCreditCardCycle(date, cutoffDay, paymentDay);

    return {
      numero: i + 1,
      amount,
      date,
      cycleCutoffDate: ciclo.cycleCutoff,
      cyclePaymentDate: ciclo.paymentDate,
    };
  });
}

/**
 * El resto va entero a la PRIMERA cuota.
 *
 * La invariante que importa es que la suma sea exactamente el total: si se
 * repartiera "como caiga", la suma de las cuotas dejaria de ser la compra
 * y el cupo quedaria descuadrado por unos pesos que nadie sabria de donde
 * salieron. El dinero es entero en toda la app; aca es donde eso importa.
 */
function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base));
}
