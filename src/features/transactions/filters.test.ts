import { describe, expect, it } from 'vitest';
import { applyFilters } from './filters';
import type { Transaction, TransactionStatus, TransactionType } from '@/domain/types';

function tx(type: TransactionType, status: TransactionStatus): Transaction {
  return {
    id: `${type}-${status}`, type, concept: 'x', amount: 1000, date: '2026-09-20',
    categoryId: null, paymentMethodId: null, status, quincenaKey: null, createdAt: '', updatedAt: '',
  };
}

const ALL = [
  tx('expense', 'paid'), tx('expense', 'pending'), tx('expense', 'scheduled'), tx('expense', 'cancelled'),
  tx('income', 'paid'), tx('income', 'pending'),
];

describe('aplicarFiltros', () => {
  it('with no filters returns everything, including cancelled', () => {
    expect(applyFilters(ALL, 'todos', 'todos')).toHaveLength(6);
  });

  it('by type keeps only that type', () => {
    expect(applyFilters(ALL, 'income', 'todos').map((t) => t.type)).toEqual(['income', 'income']);
  });

  /* The decision the code used to have in two versions: porPagar.ts keeps
     them separate, upcoming.ts merges them. The filter chooses to merge. */
  it('"pendientes" includes scheduled ones', () => {
    const ids = applyFilters(ALL, 'todos', 'pendientes').map((t) => t.id);
    expect(ids).toContain('expense-pending');
    expect(ids).toContain('expense-scheduled');
  });

  it('"pagados" is paid only', () => {
    expect(applyFilters(ALL, 'todos', 'pagados').every((t) => t.status === 'paid')).toBe(true);
  });

  it('a cancelled one is neither pending nor paid', () => {
    for (const status of ['pendientes', 'pagados'] as const) {
      expect(applyFilters(ALL, 'todos', status).map((t) => t.id)).not.toContain('expense-cancelled');
    }
  });

  it('type and status combine', () => {
    const r = applyFilters(ALL, 'expense', 'pendientes');
    expect(r.map((t) => t.id).sort()).toEqual(['expense-pending', 'expense-scheduled']);
  });
});
