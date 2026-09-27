/**
 * Convierte el backup en filas legibles para Excel.
 *
 * Separado de quien escribe el archivo a proposito: esto es la parte que
 * puede equivocarse (resolver ids a nombres, traducir estados, decidir que
 * va como numero y que como texto) y se prueba sin generar un zip. Que el
 * .xlsx sea un zip valido lo garantiza la libreria; probarlo seria probar
 * la libreria.
 *
 * REGLA CENTRAL: los montos van como NUMERO y las fechas como FECHA, nunca
 * como texto. Un "$ 1.200.000" en una celda es inerte — Excel no lo suma —
 * y sumar es exactamente para lo que la gente abre esto.
 */
// import TYPE: se borra al compilar, asi que no arrastra la libreria al
// bundle. Usar sus tipos y no unos propios garantiza que las celdas que
// armamos aca sean exactamente las que la libreria acepta.
import type { CellObject, SheetData } from 'write-excel-file/browser';
import type { Backup } from './schema';
import type { Transaction } from '@/domain/types';

export const ESTADOS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  scheduled: 'Programado',
  cancelled: 'Cancelado',
};

const TIPOS_METODO: Record<string, string> = {
  debit: 'Débito', credit: 'Crédito', cash: 'Efectivo', transfer: 'Transferencia',
};

/** 'YYYY-MM-DD' -> Date, en UTC para que no se corra un dia por zona horaria. */
function comoFecha(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d));
}

export type Celda = CellObject;

const FORMATO_MONEDA = '#,##0';
const FORMATO_FECHA = 'dd/mm/yyyy';

// Celda vacia es `undefined`, no `null`: es lo que la libreria entiende.
function texto(value: string | null | undefined): Celda {
  return { value: value ?? undefined, type: String };
}
function numero(value: number | null | undefined): Celda {
  return { value: value ?? undefined, type: Number, format: FORMATO_MONEDA };
}
function fecha(iso: string | undefined): Celda {
  return { value: comoFecha(iso), type: Date, format: FORMATO_FECHA };
}
function entero(value: number | null | undefined): Celda {
  return { value: value ?? undefined, type: Number };
}

/** El nombre, o vacio si el id ya no existe. Nunca el UUID crudo. */
function nombreDe(mapa: Map<string, string>, id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return mapa.get(id);
}

export function filasDeMovimientos(backup: Backup): SheetData {
  const categorias = new Map(backup.categories.map((c) => [c.id, c.name]));
  const metodos = new Map(backup.paymentMethods.map((m) => [m.id, m.name]));

  const cabecera = [
    'Fecha', 'Tipo', 'Concepto', 'Categoría', 'Método', 'Estado', 'Valor',
    'Se paga el', 'Cuota', 'Notas',
  ].map(texto);

  const filas = backup.transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t: Transaction) => [
      fecha(t.date),
      texto(t.type === 'income' ? 'Ingreso' : 'Gasto'),
      texto(t.concept),
      texto(nombreDe(categorias, t.categoryId)),
      texto(nombreDe(metodos, t.paymentMethodId)),
      texto(ESTADOS[t.status] ?? t.status),
      numero(t.amount),
      fecha(t.cyclePaymentDate),
      // El numero de cuota va en su columna, no pegado al concepto.
      texto(t.installmentCount && t.installmentCount > 1
        ? `${t.installmentNumber} de ${t.installmentCount}`
        : undefined),
      texto(t.notes),
    ]);

  return [cabecera, ...filas];
}

export function filasDeCategorias(backup: Backup): SheetData {
  const aplica: Record<string, string> = { expense: 'Gastos', income: 'Ingresos', both: 'Ambos' };
  return [
    ['Nombre', 'Ícono', 'Aplica a', 'Archivada'].map(texto),
    ...backup.categories.map((c) => [
      texto(c.name), texto(c.icon), texto(aplica[c.kind] ?? c.kind),
      texto(c.isArchived ? 'Sí' : 'No'),
    ]),
  ];
}

export function filasDeMetodos(backup: Backup): SheetData {
  return [
    ['Nombre', 'Tipo', 'Día de corte', 'Día de pago', 'Cupo'].map(texto),
    ...backup.paymentMethods.map((m) => [
      texto(m.name), texto(TIPOS_METODO[m.type] ?? m.type),
      entero(m.cutoffDay),
      entero(m.paymentDay),
      numero(m.creditLimit),
    ]),
  ];
}

export function filasDePresupuestos(backup: Backup): SheetData {
  const categorias = new Map(backup.categories.map((c) => [c.id, c.name]));
  return [
    ['Año', 'Mes', 'Categoría', 'Monto'].map(texto),
    ...backup.budgets.map((b) => [
      entero(b.year),
      entero(b.month),
      texto(nombreDe(categorias, b.categoryId)),
      numero(b.amount),
    ]),
  ];
}

export function filasDeRecurrentes(backup: Backup): SheetData {
  const categorias = new Map(backup.categories.map((c) => [c.id, c.name]));
  const metodos = new Map(backup.paymentMethods.map((m) => [m.id, m.name]));
  const frecuencias: Record<string, string> = {
    monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal', yearly: 'Anual',
  };
  return [
    ['Nombre', 'Tipo', 'Valor', 'Frecuencia', 'Día', 'Categoría', 'Método', 'Activa', 'Desde', 'Hasta'].map(texto),
    ...backup.recurringRules.map((r) => [
      texto(r.name),
      texto(r.type === 'income' ? 'Ingreso' : 'Gasto'),
      numero(r.amount),
      texto(frecuencias[r.frequency] ?? r.frequency),
      entero(r.dayOfMonth),
      texto(nombreDe(categorias, r.categoryId)),
      texto(nombreDe(metodos, r.paymentMethodId)),
      texto(r.isActive ? 'Sí' : 'No'),
      fecha(r.startDate),
      fecha(r.endDate),
    ]),
  ];
}

export function filasDeRecordatorios(backup: Backup): SheetData {
  const conceptos = new Map(backup.transactions.map((t) => [t.id, t.concept]));
  return [
    ['Movimiento', 'Cuándo', 'Estado'].map(texto),
    ...backup.reminders.map((r) => [
      texto(nombreDe(conceptos, r.transactionId)),
      texto(r.remindAt),
      texto(r.status),
    ]),
  ];
}

export function filasDeConfiguracion(backup: Backup): SheetData {
  const s = backup.settings[0];
  return [
    ['Ajuste', 'Valor'].map(texto),
    [texto('Nombre'), texto(s?.displayName ?? '')],
    [texto('Moneda'), texto(s?.currency ?? '')],
    [texto('Días de pago'), texto((s?.diasDePago ?? []).join(', '))],
    [texto('Tema'), texto(s?.theme ?? '')],
    [texto('Exportado'), texto(backup.exportedAt)],
  ];
}

export const HOJAS = [
  { nombre: 'Movimientos', filas: filasDeMovimientos },
  { nombre: 'Categorías', filas: filasDeCategorias },
  { nombre: 'Métodos de pago', filas: filasDeMetodos },
  { nombre: 'Presupuestos', filas: filasDePresupuestos },
  { nombre: 'Recurrentes', filas: filasDeRecurrentes },
  { nombre: 'Recordatorios', filas: filasDeRecordatorios },
  { nombre: 'Configuración', filas: filasDeConfiguracion },
] as const;
