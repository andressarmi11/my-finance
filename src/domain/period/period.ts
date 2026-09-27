/**
 * Los PERIODOS en los que la app organiza la plata.
 *
 * Generaliza lo que antes era "quincena". La idea de fondo no cambia: un
 * periodo es la ventana que va de un dia de pago al siguiente, no una
 * division del calendario. Lo que cambia es cuantos dias de pago hay.
 *
 *   diasDePago = [10, 25]  ->  dos periodos al mes (quincenal)
 *        10 -> 24  y  25 -> 9 del mes siguiente
 *   diasDePago = [1]       ->  uno al mes, el mes calendario
 *        1 -> fin de mes
 *   diasDePago = [30]      ->  uno al mes, empezando el dia de pago
 *        30 -> 29 del mes siguiente
 *
 * EL NUMERO DE DIAS DE PAGO ES EL MODO. No hay un campo aparte que diga
 * "quincenal" o "mensual" y pueda contradecir a la lista: si te pagan una
 * vez al mes, hay un dia; si te pagan dos, hay dos. Eso tambien evita una
 * migracion —la columna ya es un arreglo de largo variable— y deja la
 * puerta abierta a semanal sin volver a tocar el modelo.
 *
 * El ultimo periodo del mes SIEMPRE cruza al mes siguiente, igual que antes
 * la quincena del 25. Por eso "Arriendo", pagado el 1 de octubre, cae en el
 * periodo de septiembre: es la plata de septiembre.
 *
 * La clave conserva el formato 'YYYY-MM-Qn' que ya esta guardado en las
 * transacciones, asi que nada de lo viejo deja de leerse.
 */
import { addDays, clampDay, parseISO, shiftMonth, toISO } from '../dates';
import type { ISODate, QuincenaKey } from '../types';

/** Los dias del mes en que entra plata. Uno = mensual, dos = quincenal. */
export type DiasDePago = number[];

export const DIAS_DE_PAGO_POR_DEFECTO: DiasDePago = [10, 25];

export interface Periodo {
  key: QuincenaKey;
  start: ISODate;
  end: ISODate;
  /** Cual de los periodos del mes es, empezando en 1. */
  indice: number;
}

/** Te pagan una sola vez al mes. */
export function esMensual(dias: DiasDePago): boolean {
  return normalizar(dias).length === 1;
}

/**
 * Ordenados, sin repetidos y dentro de 1..31. Una lista vacia no tiene
 * sentido —siempre hay al menos un dia de pago— y cae en el por defecto
 * en vez de reventar mas adelante con un indice fuera de rango.
 */
export function normalizar(dias: DiasDePago): DiasDePago {
  const limpios = [...new Set(dias.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31))]
    .sort((a, b) => a - b);
  return limpios.length > 0 ? limpios : [...DIAS_DE_PAGO_POR_DEFECTO];
}

export function periodoKey(y: number, m: number, n: number): QuincenaKey {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-Q${n}`;
}

export function calcularPeriodo(date: ISODate, dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO): Periodo {
  const pagos = normalizar(dias);
  const { y, m, d } = parseISO(date);

  // clampDay por los meses cortos: un dia de pago 31 es el 28 en febrero.
  const anclas = pagos.map((dia) => clampDay(y, m, dia));

  // Antes del primer dia de pago del mes: todavia estamos en el ULTIMO
  // periodo del mes pasado, el que cruzo el cambio de mes.
  if (d < anclas[0]!) {
    const prev = shiftMonth(y, m, -1);
    const ultimoPrev = clampDay(prev.y, prev.m, pagos[pagos.length - 1]!);
    return {
      key: periodoKey(prev.y, prev.m, pagos.length),
      start: toISO({ ...prev, d: ultimoPrev }),
      end: toISO(addDays({ y, m, d: anclas[0]! }, -1)),
      indice: pagos.length,
    };
  }

  // El ultimo dia de pago que ya paso.
  let i = 0;
  for (let k = 0; k < anclas.length; k++) {
    if (d >= anclas[k]!) i = k;
  }

  // El ultimo del mes cruza hacia el siguiente; los demas terminan donde
  // empieza el que sigue.
  if (i === pagos.length - 1) {
    const next = shiftMonth(y, m, 1);
    const primeroNext = clampDay(next.y, next.m, pagos[0]!);
    return {
      key: periodoKey(y, m, pagos.length),
      start: toISO({ y, m, d: anclas[i]! }),
      end: toISO(addDays({ ...next, d: primeroNext }, -1)),
      indice: pagos.length,
    };
  }

  return {
    key: periodoKey(y, m, i + 1),
    start: toISO({ y, m, d: anclas[i]! }),
    end: toISO(addDays({ y, m, d: anclas[i + 1]! }, -1)),
    indice: i + 1,
  };
}

/** Las claves de los periodos de un mes, en orden. */
export function periodosDelMes(year: number, month: number, dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO): QuincenaKey[] {
  return normalizar(dias).map((_, i) => periodoKey(year, month, i + 1));
}

/**
 * Reconstruye el rango a partir de una clave, sin necesitar una transaccion
 * en la mano. Lo usan los encabezados de la lista y el calendario.
 *
 * Una clave guardada cuando habia dos periodos al mes puede pedir el Q2 de
 * alguien que ahora cobra una vez: en ese caso se devuelve el ultimo que
 * exista, para no reventar la pantalla por un cambio de configuracion.
 */
export function rangoDeClave(key: QuincenaKey, dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO): Periodo {
  const match = /^(\d{4})-(\d{2})-Q(\d+)$/.exec(key);
  if (!match) throw new Error(`Clave de periodo invalida: "${key}"`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const pagos = normalizar(dias);
  const n = Math.min(Number(match[3]), pagos.length);
  const ancla = toISO({ y, m, d: clampDay(y, m, pagos[n - 1]!) });
  return calcularPeriodo(ancla, pagos);
}
