import { describe, expect, it } from 'vitest';
import { calculatePorPagar } from './porPagar';
import { calculateMonthFlow } from './available';
import type { Transaction } from '../types';

function tx(o: Partial<Transaction>): Transaction {
  return {
    id: o.id ?? Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-12', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...o,
  };
}

describe('calculatePorPagar', () => {
  it('EL BUG: un pendiente con tarjeta se contaba dos veces', () => {
    const conTarjeta = tx({ id: 'tc', amount: 210_000, status: 'pending', cyclePaymentDate: '2026-11-02' });
    const r = calculatePorPagar([conTarjeta]);

    expect(r.count).toBe(1);
    expect(r.monto).toBe(210_000);
    expect(r.enTarjeta).toHaveLength(1);
    expect(r.pendientes).toHaveLength(0); // antes caía acá TAMBIÉN
  });

  it('los tres conjuntos son disjuntos y suman el total', () => {
    const r = calculatePorPagar([
      tx({ id: 'a', amount: 100, status: 'pending' }),
      tx({ id: 'b', amount: 200, status: 'scheduled' }),
      tx({ id: 'c', amount: 300, status: 'pending', cyclePaymentDate: '2026-11-02' }),
      tx({ id: 'd', amount: 400, status: 'scheduled', cyclePaymentDate: '2026-11-02' }),
    ]);
    expect(r.pendientes.map((t) => t.id)).toEqual(['a']);
    expect(r.programados.map((t) => t.id)).toEqual(['b']);
    expect(r.enTarjeta.map((t) => t.id)).toEqual(['c', 'd']);
    expect(r.pendientes.length + r.programados.length + r.enTarjeta.length).toBe(r.count);
    expect(r.monto).toBe(1000);
  });

  it('el total SIEMPRE coincide con el "falta pagar" del hero', () => {
    // Es la contradicción que veía el usuario: el sheet decía más que el
    // número que lo abrió.
    const lista = [
      tx({ amount: 145_000, status: 'pending' }),
      tx({ amount: 210_000, status: 'pending', cyclePaymentDate: '2026-11-02' }),
      tx({ amount: 200_000, status: 'scheduled' }),
      tx({ amount: 999, status: 'paid' }),
      tx({ amount: 999, status: 'cancelled' }),
      tx({ amount: 999, type: 'income', status: 'pending' }),
    ];
    expect(calculatePorPagar(lista).monto).toBe(calculateMonthFlow(lista).porPagar);
  });

  it('ignora pagados, cancelados e ingresos', () => {
    const r = calculatePorPagar([
      tx({ status: 'paid', amount: 1 }),
      tx({ status: 'cancelled', amount: 1 }),
      tx({ type: 'income', status: 'pending', amount: 1 }),
    ]);
    expect(r.count).toBe(0);
    expect(r.monto).toBe(0);
  });

  it('sin nada pendiente da cero, no explota', () => {
    expect(calculatePorPagar([]).count).toBe(0);
  });
});
