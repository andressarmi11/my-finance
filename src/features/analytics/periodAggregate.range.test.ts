import { describe, expect, it } from 'vitest';
import { filterByRange, rangeBounds } from './periodAggregate';
import type { Transaction } from '@/domain/types';

const HOY = '2026-09-26';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36), type: 'expense', concept: 'x', amount: 1000,
    date: '2026-09-20', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('rangeBounds — calendario para mes, trimestre y año', () => {
  it('mes va del 1 al último día', () => {
    expect(rangeBounds('mes', HOY, [10, 25])).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('trimestre es el trimestre de calendario que lo contiene', () => {
    expect(rangeBounds('trimestre', HOY, [10, 25])).toEqual({ from: '2026-07-01', to: '2026-09-30' });
  });

  it('año es el año de calendario', () => {
    expect(rangeBounds('año', HOY, [10, 25])).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('rangeBounds — quincena sale de TUS días de pago, no del calendario', () => {
  /* Es el unico de los cuatro que no es calendario. El 26 de septiembre
     cae en la quincena del 25, que va del 25 de sep al 9 de oct. */
  it('el 26 de septiembre cae en la quincena del 25, que cruza al mes siguiente', () => {
    expect(rangeBounds('quincena', HOY, [10, 25])).toEqual({ from: '2026-09-25', to: '2026-10-09' });
  });

  it('con otros días de pago, otra ventana', () => {
    expect(rangeBounds('quincena', HOY, [1, 16])).toEqual({ from: '2026-09-16', to: '2026-09-30' });
  });

  /* Si te pagan una vez al mes no hay media quincena: el periodo es el mes
     entero desde tu dia de pago. */
  it('en modo mensual devuelve el periodo completo, no media quincena', () => {
    expect(rangeBounds('quincena', HOY, [1])).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('filterByRange — cuenta por cuándo SALE la plata', () => {
  /* El bug que esta spec arregla: la compra se hizo el 20 de septiembre
     pero se paga el 2 de noviembre. Analisis la contaba en septiembre. */
  it('una compra con tarjeta cuenta en el mes en que se paga, no en el que se hizo', () => {
    const compra = tx({ date: '2026-09-20', cyclePaymentDate: '2026-11-02' });
    expect(filterByRange([compra], 'mes', HOY, [10, 25])).toEqual([]);
    expect(filterByRange([compra], 'mes', '2026-11-15', [10, 25])).toHaveLength(1);
  });

  it('un gasto sin tarjeta cuenta donde se hizo: nada cambia', () => {
    const gasto = tx({ date: '2026-09-20' });
    expect(filterByRange([gasto], 'mes', HOY, [10, 25])).toHaveLength(1);
  });

  it('las cuotas de un diferido caen cada una en el mes que se paga', () => {
    const cuotas = [
      tx({ date: '2026-09-20', cyclePaymentDate: '2026-11-02', purchaseDate: '2026-09-20' }),
      tx({ date: '2026-10-20', cyclePaymentDate: '2026-12-02', purchaseDate: '2026-09-20' }),
    ];
    expect(filterByRange(cuotas, 'mes', '2026-11-15', [10, 25])).toHaveLength(1);
    expect(filterByRange(cuotas, 'mes', '2026-12-15', [10, 25])).toHaveLength(1);
  });
});
