/**
 * Agrupa transacciones por periodo para la lista. Presentacion (etiquetas,
 * colores), no logica de negocio — la matematica vive en domain/periodo/*.
 *
 * Antes solo sabia de dos ventanas al mes: la etiqueta era
 * "Quincena del {10|25}" y el color salia de un ternario sobre Q1/Q2. Ahora
 * depende de cuantos dias de pago haya, que es lo que distingue mensual de
 * quincenal.
 */
import { compareISO } from '@/domain/dates';
import { calcularBalancePeriodo, type PeriodoBalance } from '@/domain/periodo/balance';
import { rangoDeClave, normalizar, DIAS_DE_PAGO_POR_DEFECTO, type DiasDePago } from '@/domain/periodo/periodo';
import { conPeriodoResuelto } from '@/domain/periodo/resolve';
import type { QuincenaKey, Transaction } from '@/domain/types';
import { monthName } from '@/components/ui/MonthNav';
import { formatShortDate } from '@/lib/formatShortDate';

function formatRangeLabel(start: string, end: string): string {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  return s.month === e.month ? `${s.day} - ${e.day} ${s.month}` : `${s.day} ${s.month} - ${e.day} ${e.month}`;
}

/**
 * Los colores de periodo. Habia dos tokens desde que la app solo sabia de
 * quincenas; con un solo dia de pago se usa el primero, y si algun dia hay
 * mas de dos se reparten en ciclo en vez de quedarse sin color.
 */
const COLORES = ['--q10', '--q25'] as const;
const SUAVES = ['--q10-soft', '--q25-soft'] as const;

export interface PeriodoGroup {
  key: QuincenaKey;
  label: string;
  rangeLabel: string;
  start: string;
  colorVar: (typeof COLORES)[number];
  softVar: (typeof SUAVES)[number];
  balance: PeriodoBalance;
  transactions: Transaction[];
}

/**
 * Como se llama un periodo en pantalla.
 *
 * Con dos o mas dias de pago sigue siendo "Quincena del 10" — la palabra
 * que la persona ya usa. Con uno solo, decir "quincena" seria mentira: si
 * el mes empieza el dia 1 se llama por su nombre ("Septiembre"), y si
 * empieza el dia de pago se dice desde cuando, porque su septiembre no es
 * el del calendario.
 */
function etiqueta(pagos: DiasDePago, indice: number, key: QuincenaKey): string {
  if (pagos.length > 1) return `Quincena del ${pagos[indice - 1]}`;

  const dia = pagos[0]!;
  if (dia === 1) {
    const mes = Number(key.slice(5, 7));
    const nombre = monthName(mes);
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }
  return `Mes desde el ${dia}`;
}

export function groupByPeriodo(
  transactions: Transaction[],
  dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO,
  /**
   * De donde sale el restante de cada encabezado. Por defecto, lo mismo que
   * se lista — pero quien llama suele pasar el historial COMPLETO, y tiene
   * que hacerlo: una compra con tarjeta de septiembre se carga en octubre,
   * asi que el restante de octubre depende de un movimiento que la lista de
   * octubre no muestra. Sin esto el encabezado decia un numero y el
   * dashboard otro para la misma quincena.
   */
  paraBalance: Transaction[] = transactions,
): PeriodoGroup[] {
  const pagos = normalizar(dias);
  const resolved = conPeriodoResuelto(transactions, pagos);
  const resueltasParaBalance = paraBalance === transactions
    ? resolved
    : conPeriodoResuelto(paraBalance, pagos);

  const byKey = new Map<QuincenaKey, Transaction[]>();
  for (const tx of resolved) {
    const list = byKey.get(tx.resolvedQuincenaKey) ?? [];
    list.push(tx);
    byKey.set(tx.resolvedQuincenaKey, list);
  }

  const groups: PeriodoGroup[] = [];
  for (const key of byKey.keys()) {
    const rango = rangoDeClave(key, pagos);
    const i = rango.indice;
    const txs = (byKey.get(key) ?? []).slice().sort((x, y) => compareISO(y.date, x.date));
    groups.push({
      key,
      label: etiqueta(pagos, i, key),
      rangeLabel: formatRangeLabel(rango.start, rango.end),
      start: rango.start,
      colorVar: COLORES[(i - 1) % COLORES.length]!,
      softVar: SUAVES[(i - 1) % SUAVES.length]!,
      balance: calcularBalancePeriodo(resueltasParaBalance, key),
      transactions: txs,
    });
  }

  // Cronologico: la quincena del 10 antes que la del 25.
  //
  // Antes iba al reves (mas reciente primero), que es lo correcto para un
  // feed infinito pero no para un mes: la lista se abria en la quincena del
  // 25 y habia que bajar para ver como empezo el mes. Con la ventana de mes
  // ya acotada, leer en orden es lo natural.
  return groups.sort((x, y) => compareISO(x.start, y.start));
}
