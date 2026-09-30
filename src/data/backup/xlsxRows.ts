/**
 * Turns the backup into rows readable by Excel.
 *
 * Kept separate from whoever writes the file, on purpose: this is the
 * part that can go wrong (resolving ids to names, translating statuses,
 * deciding what goes as a number vs. as text) and it's tested without
 * generating a zip. That the .xlsx is a valid zip is the library's job to
 * guarantee; testing that would be testing the library.
 *
 * CENTRAL RULE: amounts go as NUMBER and dates as DATE, never as text. A
 * "$ 1,200,000" in a cell is inert — Excel won't sum it — and summing is
 * exactly what people open this for.
 */
// import TYPE: erased at compile time, so it doesn't drag the library into
// the bundle. Using its types instead of our own guarantees that the
// cells we build here are exactly what the library accepts.
import type { CellObject, SheetData } from 'write-excel-file/browser';
import type { Backup } from './schema';
import type { Transaction } from '@/domain/types';

export const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  scheduled: 'Programado',
  cancelled: 'Cancelado',
};

const METHOD_TYPE_LABELS: Record<string, string> = {
  debit: 'Débito', credit: 'Crédito', cash: 'Efectivo', transfer: 'Transferencia',
};

/** 'YYYY-MM-DD' -> Date, in UTC so it doesn't shift a day due to timezone. */
function asDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d));
}

export type Cell = CellObject;

const MONEY_FORMAT = '#,##0';
const DATE_FORMAT = 'dd/mm/yyyy';

// An empty cell is `undefined`, not `null`: that's what the library understands.
function text(value: string | null | undefined): Cell {
  return { value: value ?? undefined, type: String };
}
function toNumber(value: number | null | undefined): Cell {
  return { value: value ?? undefined, type: Number, format: MONEY_FORMAT };
}
function date(iso: string | undefined): Cell {
  return { value: asDate(iso), type: Date, format: DATE_FORMAT };
}
function integer(value: number | null | undefined): Cell {
  return { value: value ?? undefined, type: Number };
}

/** The name, or empty if the id no longer exists. Never the raw UUID. */
function nameOf(mapa: Map<string, string>, id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return mapa.get(id);
}

export function transactionRows(backup: Backup): SheetData {
  const cats = new Map(backup.categories.map((c) => [c.id, c.name]));
  const methodRows = new Map(backup.paymentMethods.map((m) => [m.id, m.name]));

  const header = [
    'Fecha', 'Tipo', 'Concepto', 'Categoría', 'Método', 'Estado', 'Valor',
    'Se paga el', 'Cuota', 'Notas',
  ].map(text);

  const rows = backup.transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t: Transaction) => [
      date(t.date),
      text(t.type === 'income' ? 'Ingreso' : 'Gasto'),
      text(t.concept),
      text(nameOf(cats, t.categoryId)),
      text(nameOf(methodRows, t.paymentMethodId)),
      text(STATUS_LABELS[t.status] ?? t.status),
      toNumber(t.amount),
      date(t.cyclePaymentDate),
      // The installment number goes in its own column, not glued to the concept.
      text(t.installmentCount && t.installmentCount > 1
        ? `${t.installmentNumber} de ${t.installmentCount}`
        : undefined),
      text(t.notes),
    ]);

  return [header, ...rows];
}

export function categoryRows(backup: Backup): SheetData {
  const applies: Record<string, string> = { expense: 'Gastos', income: 'Ingresos', both: 'Ambos' };
  return [
    ['Nombre', 'Ícono', 'Aplica a', 'Archivada'].map(text),
    ...backup.categories.map((c) => [
      text(c.name), text(c.icon), text(applies[c.kind] ?? c.kind),
      text(c.isArchived ? 'Sí' : 'No'),
    ]),
  ];
}

export function paymentMethodRows(backup: Backup): SheetData {
  return [
    ['Nombre', 'Tipo', 'Día de corte', 'Día de pago', 'Cupo'].map(text),
    ...backup.paymentMethods.map((m) => [
      text(m.name), text(METHOD_TYPE_LABELS[m.type] ?? m.type),
      integer(m.cutoffDay),
      integer(m.paymentDay),
      toNumber(m.creditLimit),
    ]),
  ];
}

export function budgetRows(backup: Backup): SheetData {
  const cats = new Map(backup.categories.map((c) => [c.id, c.name]));
  return [
    ['Año', 'Mes', 'Categoría', 'Monto'].map(text),
    ...backup.budgets.filter((b) => b.amount > 0).map((b) => [
      integer(b.year),
      integer(b.month),
      text(nameOf(cats, b.categoryId)),
      toNumber(b.amount),
    ]),
  ];
}

/** Machine-readable so the sheet round-trips the custom pattern: '3m', '2w' or 'm:1,4,7'. */
function patternLabel(r: Backup['recurringRules'][number]): string {
  if (r.interval) return `${r.interval.every}${r.interval.unit === 'months' ? 'm' : 'w'}`;
  if (r.months) return `m:${r.months.join(',')}`;
  return '';
}

export function recurringRows(backup: Backup): SheetData {
  const cats = new Map(backup.categories.map((c) => [c.id, c.name]));
  const methodRows = new Map(backup.paymentMethods.map((m) => [m.id, m.name]));
  const frequencies: Record<string, string> = {
    monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal', yearly: 'Anual', custom: 'Personalizada',
  };
  return [
    ['Nombre', 'Tipo', 'Valor', 'Frecuencia', 'Día', 'Categoría', 'Método', 'Activa', 'Desde', 'Hasta', 'Patrón'].map(text),
    ...backup.recurringRules.map((r) => [
      text(r.name),
      text(r.type === 'income' ? 'Ingreso' : 'Gasto'),
      toNumber(r.amount),
      text(frequencies[r.frequency] ?? r.frequency),
      integer(r.dayOfMonth),
      text(nameOf(cats, r.categoryId)),
      text(nameOf(methodRows, r.paymentMethodId)),
      text(r.isActive ? 'Sí' : 'No'),
      date(r.startDate),
      date(r.endDate),
      text(patternLabel(r)),
    ]),
  ];
}

export function reminderRows(backup: Backup): SheetData {
  const concepts = new Map(backup.transactions.map((t) => [t.id, t.concept]));
  return [
    ['Movimiento', 'Cuándo', 'Estado'].map(text),
    ...backup.reminders.map((r) => [
      text(nameOf(concepts, r.transactionId)),
      text(r.remindAt),
      text(r.status),
    ]),
  ];
}

export function settingsRows(backup: Backup): SheetData {
  const s = backup.settings[0];
  return [
    ['Ajuste', 'Valor'].map(text),
    [text('Nombre'), text(s?.displayName ?? '')],
    [text('Moneda'), text(s?.currency ?? '')],
    [text('Días de pago'), text((s?.payDays ?? []).join(', '))],
    [text('Tema'), text(s?.theme ?? '')],
    [text('Exportado'), text(backup.exportedAt)],
  ];
}

export const SHEETS = [
  { name: 'Movimientos', rows: transactionRows },
  { name: 'Categorías', rows: categoryRows },
  { name: 'Métodos de pago', rows: paymentMethodRows },
  { name: 'Presupuestos', rows: budgetRows },
  { name: 'Recurrentes', rows: recurringRows },
  { name: 'Recordatorios', rows: reminderRows },
  { name: 'Configuración', rows: settingsRows },
] as const;
