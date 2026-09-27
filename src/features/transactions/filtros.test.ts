import { describe, expect, it } from 'vitest';
import { aplicarFiltros } from './filtros';
import type { Transaction, TransactionStatus, TransactionType } from '@/domain/types';

function tx(type: TransactionType, status: TransactionStatus): Transaction {
  return {
    id: `${type}-${status}`, type, concept: 'x', amount: 1000, date: '2026-09-20',
    categoryId: null, paymentMethodId: null, status, quincenaKey: null, createdAt: '', updatedAt: '',
  };
}

const TODOS = [
  tx('expense', 'paid'), tx('expense', 'pending'), tx('expense', 'scheduled'), tx('expense', 'cancelled'),
  tx('income', 'paid'), tx('income', 'pending'),
];

describe('aplicarFiltros', () => {
  it('sin filtros devuelve todo, incluidos los cancelados', () => {
    expect(aplicarFiltros(TODOS, 'todos', 'todos')).toHaveLength(6);
  });

  it('por tipo deja solo ese tipo', () => {
    expect(aplicarFiltros(TODOS, 'income', 'todos').map((t) => t.type)).toEqual(['income', 'income']);
  });

  /* La decision que el codigo tenia en dos versiones: porPagar.ts los
     separa, upcoming.ts los funde. El filtro elige fundirlos. */
  it('"pendientes" incluye los programados', () => {
    const ids = aplicarFiltros(TODOS, 'todos', 'pendientes').map((t) => t.id);
    expect(ids).toContain('expense-pending');
    expect(ids).toContain('expense-scheduled');
  });

  it('"pagados" es solo paid', () => {
    expect(aplicarFiltros(TODOS, 'todos', 'pagados').every((t) => t.status === 'paid')).toBe(true);
  });

  it('un cancelado no es ni pendiente ni pagado', () => {
    for (const estado of ['pendientes', 'pagados'] as const) {
      expect(aplicarFiltros(TODOS, 'todos', estado).map((t) => t.id)).not.toContain('expense-cancelled');
    }
  });

  it('tipo y estado se combinan', () => {
    const r = aplicarFiltros(TODOS, 'expense', 'pendientes');
    expect(r.map((t) => t.id).sort()).toEqual(['expense-pending', 'expense-scheduled']);
  });
});
