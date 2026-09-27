import { describe, expect, it } from 'vitest';
import {
  settingsRows, paymentMethodRows, transactionRows, recurringRows,
} from './xlsxRows';
import type { Backup } from './schema';
import type { Cell } from './xlsxRows';

/** SheetData is a union; in these sheets every cell is an object. */
function cell(row: readonly unknown[] | undefined, i: number): Cell {
  return (row as Cell[])[i]!;
}

function backup(over: Partial<Backup> = {}): Backup {
  return {
    schemaVersion: 1,
    exportedAt: '2026-09-26T00:00:00.000Z',
    settings: [{
      id: 'singleton', displayName: 'Andrés', currency: 'COP', locale: 'es-CO',
      payDays: [10, 25], defaultPaymentMethodId: null, reminderDefaultDaysBefore: 1,
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
  it('resolves ids to names, never leaves the raw UUID', () => {
    const [, row] = transactionRows(backup({ transactions: [tx()] as never }));
    expect(cell(row, 3).value).toBe('Hogar');
    expect(cell(row, 4).value).toBe('Visa');
  });

  /* A deleted category leaves the cell empty. Showing the id would be
     noise nobody can interpret when opening the file. */
  it('an id that no longer exists leaves the cell empty', () => {
    const [, row] = transactionRows(backup({ transactions: [tx({ categoryId: 'cat-fantasma' })] as never }));
    expect(cell(row, 3).value).toBeUndefined();
  });

  it('translates statuses to Spanish', () => {
    const [, row] = transactionRows(backup({ transactions: [tx({ status: 'scheduled' })] as never }));
    expect(cell(row, 5).value).toBe('Programado');
  });

  /* What makes the file useful: if the amount goes as text, Excel won't
     sum it, which is exactly what people open it for. */
  it('the amount goes as a NUMBER, not as formatted text', () => {
    const [, row] = transactionRows(backup({ transactions: [tx()] as never }));
    expect(cell(row, 6).value).toBe(120_000);
    expect(cell(row, 6).type).toBe(Number);
  });

  it('the date goes as a date, without shifting a day due to timezone', () => {
    const [, row] = transactionRows(backup({ transactions: [tx()] as never }));
    const f = cell(row, 0).value as Date;
    expect(f.getUTCFullYear()).toBe(2026);
    expect(f.getUTCMonth() + 1).toBe(9);
    expect(f.getUTCDate()).toBe(20);
  });

  it('the installment goes in its own column, not glued to the concept', () => {
    const [, row] = transactionRows(backup({
      transactions: [tx({ installmentNumber: 3, installmentCount: 12 })] as never,
    }));
    expect(cell(row, 2).value).toBe('Mercado');
    expect(cell(row, 8).value).toBe('3 de 12');
  });

  it('a normal transaction does not invent an installment', () => {
    const [, row] = transactionRows(backup({ transactions: [tx()] as never }));
    expect(cell(row, 8).value).toBeUndefined();
  });

  /* It's a file, not a balance: cancelled ones are kept too. */
  it('cancelled transactions are exported too', () => {
    const rows = transactionRows(backup({ transactions: [tx({ status: 'cancelled' })] as never }));
    expect(rows).toHaveLength(2);
    expect(cell(rows[1], 5).value).toBe('Cancelado');
  });

  it('sorts by date', () => {
    const rows = transactionRows(backup({
      transactions: [tx({ id: 'b', date: '2026-09-25' }), tx({ id: 'a', date: '2026-09-01' })] as never,
    }));
    expect((cell(rows[1], 0).value as Date).getUTCDate()).toBe(1);
    expect((cell(rows[2], 0).value as Date).getUTCDate()).toBe(25);
  });
});

describe('the other sheets', () => {
  it('payment methods bring the credit limit as a number', () => {
    const [, row] = paymentMethodRows(backup());
    expect(cell(row, 0).value).toBe('Visa');
    expect(cell(row, 4).value).toBe(5_000_000);
  });

  it('settings dumps the pay dates in readable form', () => {
    const rows = settingsRows(backup());
    const row = rows.find((f) => cell(f, 0).value === 'Días de pago')!;
    expect(cell(row, 1).value).toBe('10, 25');
  });

  it('recurring rules translate frequency and type', () => {
    const rows = recurringRows(backup({
      recurringRules: [{
        id: 'r', name: 'Arriendo', type: 'expense', amount: 1_500_000, categoryId: 'cat-hogar',
        paymentMethodId: null, frequency: 'monthly', dayOfMonth: 1, isActive: true,
        startDate: '2026-01-01', updatedAt: '',
      }] as never,
    }));
    expect(cell(rows[1], 3).value).toBe('Mensual');
    expect(cell(rows[1], 1).value).toBe('Gasto');
  });
});
