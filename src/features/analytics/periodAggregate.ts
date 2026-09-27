/**
 * Agrega la serie mensual en trimestres o años. Presentacion, no dominio:
 * toma lo que ya calculo monthlySeries y lo reagrupa para la vista
 * seleccionada (Mes / Trimestre / Año).
 */
import type { MonthPoint } from '@/domain/analytics/series';

export interface PeriodPoint {
  label: string;
  income: number;
  expense: number;
}

const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Corta la serie en el mes actual: el grafico se llama "historico" y estaba
 * mostrando el futuro.
 *
 * No es un caso raro. Las reglas recurrentes se materializan por adelantado
 * (y ahora tambien al navegar a un mes lejano), asi que en la base hay
 * transacciones de 2027 aunque estemos en 2026. Como el grafico tomaba los
 * ULTIMOS seis meses de todo lo que existe, los ultimos seis eran los del
 * futuro: el "historico" mostraba meses que todavia no pasaron, y el mes en
 * curso ni aparecia.
 */
export function hastaHoy(points: MonthPoint[], hoy: string): MonthPoint[] {
  const [y, m] = hoy.split('-').map(Number) as [number, number];
  const tope = y * 12 + m;
  return points.filter((p) => p.year * 12 + p.month <= tope);
}

/**
 * Rellena con ceros los meses sin movimientos que quedan ENTRE dos que si
 * tienen. Sin esto, un mes en blanco simplemente desaparecia y las barras
 * vecinas quedaban pegadas, como si el tiempo no hubiera pasado.
 *
 * A proposito no rellena ANTES del primer mes con datos: inventar ceros
 * previos a que la persona empezara a usar la app diria "no gastaste nada",
 * que es distinto de "todavia no estabas".
 */
export function rellenarHuecos(points: MonthPoint[]): MonthPoint[] {
  if (points.length < 2) return points;
  const ordenados = [...points].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  const porClave = new Map(ordenados.map((p) => [p.year * 12 + p.month, p]));

  const primero = ordenados[0]!;
  const ultimo = ordenados[ordenados.length - 1]!;
  const salida: MonthPoint[] = [];
  for (let n = primero.year * 12 + primero.month; n <= ultimo.year * 12 + ultimo.month; n++) {
    const existente = porClave.get(n);
    if (existente) {
      salida.push(existente);
    } else {
      const year = Math.floor((n - 1) / 12);
      salida.push({ year, month: n - year * 12, income: 0, expense: 0 });
    }
  }
  return salida;
}

export function toMonthlyPoints(points: MonthPoint[]): PeriodPoint[] {
  return points.map((p) => ({
    label: `${MONTH_ABBR[p.month - 1]} ${String(p.year).slice(2)}`,
    income: p.income,
    expense: p.expense,
  }));
}

export function toQuarterlyPoints(points: MonthPoint[]): PeriodPoint[] {
  const map = new Map<string, PeriodPoint>();
  for (const p of points) {
    const q = Math.floor((p.month - 1) / 3) + 1;
    const key = `${p.year}-Q${q}`;
    const existing = map.get(key) ?? { label: `T${q} ${String(p.year).slice(2)}`, income: 0, expense: 0 };
    existing.income += p.income;
    existing.expense += p.expense;
    map.set(key, existing);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
}

export function toYearlyPoints(points: MonthPoint[]): PeriodPoint[] {
  const map = new Map<number, PeriodPoint>();
  for (const p of points) {
    const existing = map.get(p.year) ?? { label: String(p.year), income: 0, expense: 0 };
    existing.income += p.income;
    existing.expense += p.expense;
    map.set(p.year, existing);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b).map(([, v]) => v);
}

/* ---------------------------------------------------------------------
   Ventana del selector Mes / Trimestre / Año.

   Bug que arregla: el filtro anterior era solo `t.date >= inicio`, sin
   tope superior. Como materialize.ts crea recurrentes hasta 95 dias
   adelante, las tres opciones terminaban incluyendo el mismo futuro y
   las tarjetas (balance por categoria, distribucion de gastos, fijos vs
   variables) mostraban exactamente lo mismo en Mes, Trimestre y Año.
   Con `to` acotado, cada rango cubre solo su periodo.
--------------------------------------------------------------------- */
import { daysInMonth } from '@/domain/dates';
import { fechaDeCargo } from '@/domain/periodo/fechaDeCargo';
import { calcularPeriodo, DIAS_DE_PAGO_POR_DEFECTO, type DiasDePago } from '@/domain/periodo/periodo';
import type { Transaction } from '@/domain/types';

export type Range = 'quincena' | 'mes' | 'trimestre' | 'año';

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Limites inclusivos [from, to] del rango que contiene a `today`.
 *
 * Tres de los cuatro son CALENDARIO puro. 'quincena' no: sale de los dias
 * de pago del usuario, asi que la ventana del 25 se estira hasta el 9 del
 * mes siguiente. Son dos ejes distintos y conviene que se vea — no existe
 * un "trimestre de quincenas" y no se inventa uno.
 */
export function rangeBounds(
  range: Range,
  today: string,
  dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO,
): { from: string; to: string } {
  if (range === 'quincena') {
    const p = calcularPeriodo(today, dias);
    return { from: p.start, to: p.end };
  }
  const [y, m] = today.split('-').map(Number) as [number, number];
  if (range === 'mes') {
    return { from: iso(y, m, 1), to: iso(y, m, daysInMonth(y, m)) };
  }
  if (range === 'trimestre') {
    const first = m - ((m - 1) % 3);
    const last = first + 2;
    return { from: iso(y, first, 1), to: iso(y, last, daysInMonth(y, last)) };
  }
  return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
}

/**
 * Por la fecha de CARGO, no la de registro.
 *
 * Antes filtraba por t.date crudo, asi que una compra con tarjeta del 20
 * de septiembre que se paga el 2 de noviembre contaba como gasto de
 * septiembre. Es el mismo bug que se arreglo en el balance (95e91ce) y que
 * sobrevivio aca porque la funcion vivia en features/dashboard.
 */
export function filterByRange(
  transactions: Transaction[],
  range: Range,
  today: string,
  dias: DiasDePago = DIAS_DE_PAGO_POR_DEFECTO,
): Transaction[] {
  const { from, to } = rangeBounds(range, today, dias);
  return transactions.filter((t) => {
    const cargo = fechaDeCargo(t);
    return cargo >= from && cargo <= to;
  });
}
