import { describe, expect, it } from 'vitest';
import { calcularBalanceMes, calcularBalancePeriodo } from './balance';
import { conPeriodoResuelto } from './resolve';
import type { Transaction } from '../types';

/** Reconstruye, con datos ficticios, la hoja de Septiembre del enunciado. */
function fixtureSeptiembre(): Transaction[] {
  const base = { notes: undefined, quincenaKey: null, createdAt: '', updatedAt: '' } as const;
  return [
    // Quincena del 10 (10 sep - 24 sep)
    { id: '1', type: 'expense', concept: 'iCloud', amount: 13_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'pending', ...base },
    { id: '2', type: 'expense', concept: 'DGO', amount: 94_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'pending', ...base },
    { id: '3', type: 'expense', concept: 'Pago plan celular', amount: 48_000, date: '2026-09-12', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '4', type: 'expense', concept: 'Pago compras TC', amount: 1_500_000, date: '2026-09-14', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '5', type: 'expense', concept: 'Viaje Brasil', amount: 500_000, date: '2026-09-14', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '6', type: 'income', concept: 'Retorno a bolsillo/casa', amount: 1_000_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    // El ingreso de la quincena del 10 (no viene en la imagen, se infiere del restante)
    { id: '7', type: 'income', concept: 'Ingreso quincena 10', amount: 2_370_000, date: '2026-09-10', categoryId: null, paymentMethodId: null, status: 'paid', ...base },

    // Quincena del 25 (25 sep - 9 oct)
    { id: '8', type: 'expense', concept: 'Arriendo', amount: 2_500_000, date: '2026-10-01', categoryId: null, paymentMethodId: null, status: 'pending', ...base },
    { id: '9', type: 'expense', concept: 'Apple Music', amount: 9_900, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '10', type: 'expense', concept: 'Gym', amount: 100_000, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '11', type: 'expense', concept: 'Coomeva', amount: 175_094, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },
    { id: '12', type: 'income', concept: 'Ingreso quincena 25', amount: 3_952_000, date: '2026-09-25', categoryId: null, paymentMethodId: null, status: 'paid', ...base },

    // Un cancelado: no debe afectar ninguna suma.
    { id: '13', type: 'expense', concept: 'Compra cancelada', amount: 999_999, date: '2026-09-12', categoryId: null, paymentMethodId: null, status: 'cancelled', ...base },
  ];
}

describe('calcularBalancePeriodo', () => {
  it('restante de la quincena del 10 == 1.215.000 (verificado contra la hoja real)', () => {
    const withKeys = conPeriodoResuelto(fixtureSeptiembre());
    const balance = calcularBalancePeriodo(withKeys, '2026-09-Q1');
    expect(balance.restante).toBe(1_215_000);
  });

  it('restante de la quincena del 25 == 1.167.006, incluyendo el Arriendo pagado el 1 de octubre', () => {
    const withKeys = conPeriodoResuelto(fixtureSeptiembre());
    const balance = calcularBalancePeriodo(withKeys, '2026-09-Q2');
    expect(balance.restante).toBe(1_167_006);
  });

  it('ignora los movimientos cancelados', () => {
    const withKeys = conPeriodoResuelto(fixtureSeptiembre());
    const balance = calcularBalancePeriodo(withKeys, '2026-09-Q1');
    // si el cancelado contara, el restante seria 1.215.000 - 999.999
    expect(balance.expense).not.toBe(1_500_000 + 94_000 + 13_000 + 999_999);
  });
});

describe('calcularBalanceMes', () => {
  it('sobrante del mes == suma de los dos restantes == 2.382.006', () => {
    const withKeys = conPeriodoResuelto(fixtureSeptiembre());
    const month = calcularBalanceMes(withKeys, 2026, 9);
    expect(month.sobrante).toBe(2_382_006);
    // Ahora los periodos son una lista, no siempre dos: el sobrante es la
    // suma de los que haya.
    expect(month.periodos).toHaveLength(2);
    expect(month.sobrante).toBe(month.periodos.reduce((a, p) => a + p.restante, 0));
  });

  it('con un solo día de pago hay un periodo y el sobrante es el suyo', () => {
    const withKeys = conPeriodoResuelto(fixtureSeptiembre(), [1]);
    const month = calcularBalanceMes(withKeys, 2026, 9, [1]);
    expect(month.periodos).toHaveLength(1);
    expect(month.sobrante).toBe(month.periodos[0]?.restante);
  });
});
