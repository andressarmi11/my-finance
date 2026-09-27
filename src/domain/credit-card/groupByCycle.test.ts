import { describe, expect, it } from 'vitest';
import { groupByCard, groupByCycle } from './groupByCycle';
import type { PaymentMethod, Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-01', categoryId: null, paymentMethodId: 'pm-tc', status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('groupByCycle', () => {
  it('agrupa por fecha de pago y suma el total del ciclo', () => {
    const groups = groupByCycle([
      tx({ amount: 150_000, cyclePaymentDate: '2026-11-02' }),
      tx({ amount: 210_000, cyclePaymentDate: '2026-11-02' }),
      tx({ amount: 80_000, cyclePaymentDate: '2026-12-02' }),
    ]);
    expect(groups).toHaveLength(2);
    const nov = groups.find((g) => g.paymentDate === '2026-11-02')!;
    expect(nov.total).toBe(360_000);
    expect(nov.count).toBe(2);
  });

  it('ordena los ciclos del mas proximo al mas lejano', () => {
    const groups = groupByCycle([
      tx({ cyclePaymentDate: '2027-01-02' }),
      tx({ cyclePaymentDate: '2026-11-02' }),
    ]);
    expect(groups.map((g) => g.paymentDate)).toEqual(['2026-11-02', '2027-01-02']);
  });

  it('ignora canceladas y las que no tienen fecha de pago (no son TC)', () => {
    const groups = groupByCycle([
      tx({ cyclePaymentDate: '2026-11-02', status: 'cancelled' }),
      tx({ cyclePaymentDate: undefined }),
    ]);
    expect(groups).toEqual([]);
  });
});

describe('groupByCard', () => {
  const visa: PaymentMethod = {
    id: 'tc-1', type: 'credit', name: 'Visa', isDefault: false,
    cutoffDay: 15, paymentDay: 2, creditLimit: 3_000_000, updatedAt: '',
  };
  const amex: PaymentMethod = {
    id: 'tc-2', type: 'credit', name: 'Amex', isDefault: false,
    cutoffDay: 5, paymentDay: 20, updatedAt: '',
  };
  const debito: PaymentMethod = {
    id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '',
  };

  /* El caso que rompia la pantalla: dos tarjetas que pagan el MISMO dia.
     groupByCycle a secas las sumaba en una fila, y cada tarjeta se paga
     aparte. */
  it('no mezcla dos tarjetas que caen en la misma fecha de pago', () => {
    const cards = groupByCard([visa, amex], [
      tx({ paymentMethodId: 'tc-1', amount: 100_000, cyclePaymentDate: '2026-11-02' }),
      tx({ paymentMethodId: 'tc-2', amount: 700_000, cyclePaymentDate: '2026-11-02' }),
    ], '2026-09-26');

    expect(cards).toHaveLength(2);
    expect(cards[0]!.cycles[0]!.total).toBe(100_000);
    expect(cards[1]!.cycles[0]!.total).toBe(700_000);
  });

  it('trae el disponible de cada tarjeta, y null si no tiene cupo', () => {
    const cards = groupByCard([visa, amex], [
      tx({ paymentMethodId: 'tc-1', amount: 500_000, date: '2026-09-20', cyclePaymentDate: '2026-11-02' }),
    ], '2026-09-26');

    expect(cards[0]!.disponible).toEqual({ cupo: 3_000_000, usado: 500_000, disponible: 2_500_000 });
    expect(cards[1]!.disponible).toBeNull();
  });

  it('una tarjeta sin compras igual aparece: su cupo es informacion', () => {
    const cards = groupByCard([visa], [], '2026-09-26');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.cycles).toEqual([]);
    expect(cards[0]!.disponible!.disponible).toBe(3_000_000);
  });

  it('ignora los metodos que no son de credito', () => {
    expect(groupByCard([debito], [tx({ paymentMethodId: 'pm-debito' })], '2026-09-26')).toEqual([]);
  });
});
