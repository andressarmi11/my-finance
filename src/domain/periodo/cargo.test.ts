import { describe, expect, it } from 'vitest';
import { calcularPeriodo } from './periodo';
import { calcularBalanceMes, calcularBalancePeriodo } from './balance';
import { conPeriodoResuelto, resolverPeriodoDeCargo } from './resolve';
import { calculateCreditCardCycle } from '../credit-card/cycle';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36), type: 'expense', concept: 'x', amount: 0,
    date: '2026-09-20', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

/** Compra con TC el 20 de septiembre, corte 15 y pago 2 -> se paga el 2 de noviembre. */
function compraTC(amount: number): Transaction {
  const ciclo = calculateCreditCardCycle('2026-09-20', 15, 2);
  return tx({
    amount, date: '2026-09-20',
    cycleCutoffDate: ciclo.cycleCutoff, cyclePaymentDate: ciclo.paymentDate,
  });
}

describe('la quincena en la que cae una fecha de pago (lo que ya sabía el dominio)', () => {
  it('el 2 de noviembre se paga con la quincena del 25 de OCTUBRE, que va del 25 al 9', () => {
    const p = calcularPeriodo('2026-11-02', [10, 25]);
    expect(p.key).toBe('2026-10-Q2');
    expect(p.start).toBe('2026-10-25');
    expect(p.end).toBe('2026-11-09');
  });

  it('si te pagan una vez al mes, el 2 de noviembre cae en noviembre completo', () => {
    const p = calcularPeriodo('2026-11-02', [1]);
    expect(p.key).toBe('2026-11-Q1');
    expect(p.start).toBe('2026-11-01');
    expect(p.end).toBe('2026-11-30');
  });
});

describe('resolverPeriodoDeCargo — cuándo SALE la plata', () => {
  it('una compra con TC se carga en el periodo de su fecha de pago, no en el de la compra', () => {
    expect(resolverPeriodoDeCargo(compraTC(500_000), [10, 25])).toBe('2026-10-Q2');
  });

  it('un gasto sin tarjeta se carga donde se hizo: nada cambia', () => {
    expect(resolverPeriodoDeCargo(tx({ date: '2026-09-20' }), [10, 25])).toBe('2026-09-Q1');
  });

  it('si la moviste a mano, tu decisión manda sobre el ciclo de la tarjeta', () => {
    const movida = { ...compraTC(500_000), quincenaKey: '2026-09-Q2' };
    expect(resolverPeriodoDeCargo(movida, [10, 25])).toBe('2026-09-Q2');
  });
});

describe('el balance descuenta la compra con TC en la quincena en que se paga', () => {
  const movimientos = [
    tx({ type: 'income', amount: 3_000_000, date: '2026-09-10' }), // sueldo, Q1 de sept
    compraTC(500_000),                                            // compra 20 sep, paga 2 nov
  ];

  it('la quincena de la compra deja el registro pero NO el descuento', () => {
    const resueltos = conPeriodoResuelto(movimientos, [10, 25]);

    // El registro sigue en la quincena en que se compró.
    const compra = resueltos.find((t) => t.amount === 500_000)!;
    expect(compra.resolvedQuincenaKey).toBe('2026-09-Q1');

    // Pero la plata de esa quincena queda intacta.
    const q1 = calcularBalancePeriodo(resueltos, '2026-09-Q1');
    expect(q1.expense).toBe(0);
    expect(q1.restante).toBe(3_000_000);
  });

  it('la quincena en que se paga el extracto sí lo descuenta', () => {
    const resueltos = conPeriodoResuelto(movimientos, [10, 25]);
    const cargo = calcularBalancePeriodo(resueltos, '2026-10-Q2');
    expect(cargo.expense).toBe(500_000);
    expect(cargo.restante).toBe(-500_000);
  });

  it('septiembre entero no pierde la plata que todavía no sale', () => {
    const sept = calcularBalanceMes(conPeriodoResuelto(movimientos, [10, 25]), 2026, 9, [10, 25]);
    expect(sept.expense).toBe(0);
    expect(sept.sobrante).toBe(3_000_000);
  });

  it('en modo mensual el cargo cae en noviembre, no en septiembre', () => {
    const resueltos = conPeriodoResuelto(movimientos, [1]);
    expect(calcularBalanceMes(resueltos, 2026, 9, [1]).expense).toBe(0);
    expect(calcularBalanceMes(resueltos, 2026, 11, [1]).expense).toBe(500_000);
  });
});
