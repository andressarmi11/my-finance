import { describe, expect, it } from 'vitest';
import { groupByPeriodo } from './groupByPeriodo';
import type { Transaction } from '@/domain/types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('groupByPeriodo', () => {
  it('agrupa por quincena y las ordena cronologicamente: la del 10 antes que la del 25', () => {
    const groups = groupByPeriodo([
      tx({ date: '2026-09-10', amount: 10_000 }),
      tx({ date: '2026-09-25', amount: 20_000 }),
      tx({ date: '2026-08-12', amount: 5_000 }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-08-Q1', '2026-09-Q1', '2026-09-Q2']);
  });

  it('asigna el color y la etiqueta correctos segun Q1/Q2', () => {
    const groups = groupByPeriodo([tx({ date: '2026-09-10' }), tx({ date: '2026-09-25' })]);
    const q1 = groups.find((g) => g.key === '2026-09-Q1')!;
    const q2 = groups.find((g) => g.key === '2026-09-Q2')!;
    expect(q1.label).toBe('Quincena del 10');
    expect(q1.colorVar).toBe('--q10');
    expect(q2.label).toBe('Quincena del 25');
    expect(q2.colorVar).toBe('--q25');
  });

  it('el balance de cada grupo coincide con calcularBalancePeriodo', () => {
    const groups = groupByPeriodo([
      tx({ date: '2026-09-10', type: 'income', amount: 1_000_000 }),
      tx({ date: '2026-09-12', type: 'expense', amount: 300_000 }),
    ]);
    const q1 = groups.find((g) => g.key === '2026-09-Q1')!;
    expect(q1.balance.restante).toBe(700_000);
  });

  it('sin transacciones no hay grupos', () => {
    expect(groupByPeriodo([])).toEqual([]);
  });

  /**
   * El caso que rompia: la compra con tarjeta se LISTA en septiembre pero la
   * plata sale en la quincena del 25 de octubre. Si el encabezado de octubre
   * solo mirara lo que octubre lista, diria un restante distinto al que
   * muestra el dashboard para esa misma quincena.
   */
  it('el restante de una quincena cuenta la compra con TC aunque se liste en otro mes', () => {
    const compraTC = tx({
      date: '2026-09-20', amount: 500_000,
      cycleCutoffDate: '2026-10-15', cyclePaymentDate: '2026-11-02',
    });
    const sueldoOctubre = tx({ date: '2026-10-25', type: 'income', amount: 2_000_000 });
    const todas = [compraTC, sueldoOctubre];

    // Lo que la pantalla de octubre lista: solo el sueldo.
    const groups = groupByPeriodo([sueldoOctubre], [10, 25], todas);
    const q2 = groups.find((g) => g.key === '2026-10-Q2')!;

    expect(q2.transactions).toHaveLength(1);
    expect(q2.balance.expense).toBe(500_000);
    expect(q2.balance.restante).toBe(1_500_000);
  });
});
