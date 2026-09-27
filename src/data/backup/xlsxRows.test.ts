import { describe, expect, it } from 'vitest';
import {
  filasDeConfiguracion, filasDeMetodos, filasDeMovimientos, filasDeRecurrentes,
} from './xlsxRows';
import type { Backup } from './schema';
import type { Celda } from './xlsxRows';

/** SheetData es una union; en estas hojas todas las celdas son objetos. */
function celda(fila: readonly unknown[] | undefined, i: number): Celda {
  return (fila as Celda[])[i]!;
}

function backup(over: Partial<Backup> = {}): Backup {
  return {
    schemaVersion: 1,
    exportedAt: '2026-09-26T00:00:00.000Z',
    settings: [{
      id: 'singleton', displayName: 'Andrés', currency: 'COP', locale: 'es-CO',
      diasDePago: [10, 25], defaultPaymentMethodId: null, reminderDefaultDaysBefore: 1,
      theme: 'system', onboardedAt: null, updatedAt: '',
    }],
    categories: [{
      id: 'cat-hogar', name: 'Hogar', icon: '🏠', color: '#000', kind: 'expense',
      isArchived: false, sortOrder: 0, updatedAt: '',
    }],
    paymentMethods: [{
      id: 'tc-1', type: 'credit', name: 'Visa', isDefault: false,
      cutoffDay: 15, paymentDay: 2, creditLimit: 5_000_000, updatedAt: '',
    }],
    transactions: [],
    recurringRules: [],
    budgets: [],
    reminders: [],
    ...over,
  } as Backup;
}

function tx(over: Record<string, unknown> = {}) {
  return {
    id: 'a', type: 'expense', concept: 'Mercado', amount: 120_000, date: '2026-09-20',
    categoryId: 'cat-hogar', paymentMethodId: 'tc-1', status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('filasDeMovimientos', () => {
  it('resuelve los ids a nombres, nunca deja el UUID crudo', () => {
    const [, fila] = filasDeMovimientos(backup({ transactions: [tx()] as never }));
    expect(celda(fila, 3).value).toBe('Hogar');
    expect(celda(fila, 4).value).toBe('Visa');
  });

  /* Una categoria borrada deja la celda vacia. Mostrar el id seria ruido
     que nadie puede interpretar al abrir el archivo. */
  it('un id que ya no existe deja la celda vacía', () => {
    const [, fila] = filasDeMovimientos(backup({ transactions: [tx({ categoryId: 'cat-fantasma' })] as never }));
    expect(celda(fila, 3).value).toBeUndefined();
  });

  it('traduce los estados al español', () => {
    const [, fila] = filasDeMovimientos(backup({ transactions: [tx({ status: 'scheduled' })] as never }));
    expect(celda(fila, 5).value).toBe('Programado');
  });

  /* Lo que hace util el archivo: si el monto va como texto, Excel no lo
     suma, que es justo para lo que la gente lo abre. */
  it('el monto va como NÚMERO, no como texto formateado', () => {
    const [, fila] = filasDeMovimientos(backup({ transactions: [tx()] as never }));
    expect(celda(fila, 6).value).toBe(120_000);
    expect(celda(fila, 6).type).toBe(Number);
  });

  it('la fecha va como fecha, sin correrse de día por zona horaria', () => {
    const [, fila] = filasDeMovimientos(backup({ transactions: [tx()] as never }));
    const f = celda(fila, 0).value as Date;
    expect(f.getUTCFullYear()).toBe(2026);
    expect(f.getUTCMonth() + 1).toBe(9);
    expect(f.getUTCDate()).toBe(20);
  });

  it('la cuota va en su columna, no pegada al concepto', () => {
    const [, fila] = filasDeMovimientos(backup({
      transactions: [tx({ installmentNumber: 3, installmentCount: 12 })] as never,
    }));
    expect(celda(fila, 2).value).toBe('Mercado');
    expect(celda(fila, 8).value).toBe('3 de 12');
  });

  it('un movimiento normal no inventa una cuota', () => {
    const [, fila] = filasDeMovimientos(backup({ transactions: [tx()] as never }));
    expect(celda(fila, 8).value).toBeUndefined();
  });

  /* Es un archivo, no un balance: lo cancelado tambien se guarda. */
  it('los cancelados sí se exportan', () => {
    const filas = filasDeMovimientos(backup({ transactions: [tx({ status: 'cancelled' })] as never }));
    expect(filas).toHaveLength(2);
    expect(celda(filas[1], 5).value).toBe('Cancelado');
  });

  it('ordena por fecha', () => {
    const filas = filasDeMovimientos(backup({
      transactions: [tx({ id: 'b', date: '2026-09-25' }), tx({ id: 'a', date: '2026-09-01' })] as never,
    }));
    expect((celda(filas[1], 0).value as Date).getUTCDate()).toBe(1);
    expect((celda(filas[2], 0).value as Date).getUTCDate()).toBe(25);
  });
});

describe('las otras hojas', () => {
  it('métodos de pago trae el cupo como número', () => {
    const [, fila] = filasDeMetodos(backup());
    expect(celda(fila, 0).value).toBe('Visa');
    expect(celda(fila, 4).value).toBe(5_000_000);
  });

  it('configuración vuelca los días de pago legibles', () => {
    const filas = filasDeConfiguracion(backup());
    const fila = filas.find((f) => celda(f, 0).value === 'Días de pago')!;
    expect(celda(fila, 1).value).toBe('10, 25');
  });

  it('las recurrentes traducen frecuencia y tipo', () => {
    const filas = filasDeRecurrentes(backup({
      recurringRules: [{
        id: 'r', name: 'Arriendo', type: 'expense', amount: 1_500_000, categoryId: 'cat-hogar',
        paymentMethodId: null, frequency: 'monthly', dayOfMonth: 1, isActive: true,
        startDate: '2026-01-01', updatedAt: '',
      }] as never,
    }));
    expect(celda(filas[1], 3).value).toBe('Mensual');
    expect(celda(filas[1], 1).value).toBe('Gasto');
  });
});
