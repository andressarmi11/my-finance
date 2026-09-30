import { describe, expect, it } from 'vitest';
import type { PaymentMethod, Transaction } from '@/domain/types';
import { spendByMethod } from './byMethod';

const methods: PaymentMethod[] = [
  { id: 'd', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '' },
  { id: 'c', type: 'credit', name: 'TC', isDefault: false, updatedAt: '' },
  { id: 'e', type: 'cash', name: 'Efectivo', isDefault: false, updatedAt: '' },
  { id: 't', type: 'transfer', name: 'Nequi', isDefault: false, updatedAt: '' },
];

const tx = (amount: number, paymentMethodId: string | null, extra: Partial<Transaction> = {}): Transaction => ({
  id: `${amount}-${paymentMethodId}`, type: 'expense', concept: 'x', amount, date: '2026-09-10',
  categoryId: null, paymentMethodId, status: 'paid', quincenaKey: null, createdAt: '', updatedAt: '', ...extra,
});

describe('spendByMethod', () => {
  it('splits expenses into debit, credit and cash', () => {
    expect(spendByMethod([tx(100, 'd'), tx(200, 'c'), tx(50, 'e')], methods)).toEqual({ debit: 100, credit: 200, cash: 50 });
  });
  it('transfers and no method count as debit', () => {
    expect(spendByMethod([tx(10, 't'), tx(5, null), tx(1, 'gone')], methods)).toEqual({ debit: 16, credit: 0, cash: 0 });
  });
  it('ignores income and cancelled', () => {
    expect(spendByMethod([tx(10, 'e', { type: 'income' }), tx(20, 'e', { status: 'cancelled' })], methods))
      .toEqual({ debit: 0, credit: 0, cash: 0 });
  });
});
