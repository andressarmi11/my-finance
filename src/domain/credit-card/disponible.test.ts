import { describe, expect, it } from 'vitest';
import { calcularDisponible, saldosSinPagar } from './disponible';
import type { PaymentMethod, Transaction } from '../types';

const HOY = '2026-09-26';

function tarjeta(over: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: 'tc-1', type: 'credit', name: 'Visa', isDefault: false,
    cutoffDay: 15, paymentDay: 2, creditLimit: 5_000_000, updatedAt: '', ...over,
  };
}

function gasto(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36), type: 'expense', concept: 'x', amount: 100_000,
    date: '2026-09-20', categoryId: null, paymentMethodId: 'tc-1', status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('calcularDisponible', () => {
  it('descuenta del cupo lo comprado y no pagado', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ amount: 1_200_000 })], HOY)!;
    expect(d).toEqual({ cupo: 5_000_000, usado: 1_200_000, disponible: 3_800_000 });
  });

  /* La gotera que motiva el filtro de fecha: materialize.ts siembra las
     recurrentes con status 'pending' hasta ~3 meses adelante. Sin esto, una
     suscripcion de diciembre te comeria cupo hoy. */
  it('una compra futura todavia no consume cupo', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ date: '2026-12-01', amount: 900_000 })], HOY)!;
    expect(d.usado).toBe(0);
    expect(d.disponible).toBe(5_000_000);
  });

  it('la compra de hoy si consume cupo', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ date: HOY, amount: 400_000 })], HOY)!;
    expect(d.usado).toBe(400_000);
  });

  it('marcar pagado libera el cupo', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ amount: 800_000, status: 'paid' })], HOY)!;
    expect(d.usado).toBe(0);
  });

  it('lo cancelado nunca conto', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ amount: 800_000, status: 'cancelled' })], HOY)!;
    expect(d.usado).toBe(0);
  });

  it('arrastra lo viejo sin pagar, aunque sea de otro ciclo', () => {
    const d = calcularDisponible(tarjeta(), [
      gasto({ date: '2026-06-10', amount: 300_000 }),
      gasto({ date: '2026-09-20', amount: 200_000 }),
    ], HOY)!;
    expect(d.usado).toBe(500_000);
  });

  it('el sobrecupo se muestra negativo, no recortado a cero', () => {
    const d = calcularDisponible(tarjeta({ creditLimit: 1_000_000 }), [gasto({ amount: 1_500_000 })], HOY)!;
    expect(d.disponible).toBe(-500_000);
  });

  it('sin cupo puesto devuelve null: no hay nada que mostrar', () => {
    expect(calcularDisponible(tarjeta({ creditLimit: undefined }), [gasto()], HOY)).toBeNull();
  });

  it('no cuenta lo de otra tarjeta', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ paymentMethodId: 'tc-2', amount: 999_999 })], HOY)!;
    expect(d.usado).toBe(0);
  });

  it('un ingreso a la tarjeta no consume cupo', () => {
    const d = calcularDisponible(tarjeta(), [gasto({ type: 'income', amount: 500_000 })], HOY)!;
    expect(d.usado).toBe(0);
  });
});

describe('saldosSinPagar', () => {
  const visa = tarjeta({ id: 'tc-1', name: 'Visa' });
  const amex = tarjeta({ id: 'tc-2', name: 'Amex' });

  it('lista los ciclos cuya fecha de pago ya paso y siguen sin pagar', () => {
    const saldos = saldosSinPagar([visa], [
      gasto({ amount: 300_000, cyclePaymentDate: '2026-08-02' }),
      gasto({ amount: 200_000, cyclePaymentDate: '2026-08-02' }),
    ], HOY);
    expect(saldos).toHaveLength(1);
    expect(saldos[0]).toMatchObject({ paymentDate: '2026-08-02', total: 500_000, count: 2 });
    expect(saldos[0]!.tarjeta.name).toBe('Visa');
  });

  it('un ciclo que todavia no vence no es un saldo vencido', () => {
    expect(saldosSinPagar([visa], [gasto({ cyclePaymentDate: '2026-11-02' })], HOY)).toEqual([]);
  });

  it('un ciclo ya pagado desaparece del aviso', () => {
    const saldos = saldosSinPagar([visa], [
      gasto({ cyclePaymentDate: '2026-08-02', status: 'paid' }),
    ], HOY);
    expect(saldos).toEqual([]);
  });

  it('separa por tarjeta aunque compartan fecha de pago', () => {
    const saldos = saldosSinPagar([visa, amex], [
      gasto({ paymentMethodId: 'tc-1', amount: 100_000, cyclePaymentDate: '2026-08-02' }),
      gasto({ paymentMethodId: 'tc-2', amount: 700_000, cyclePaymentDate: '2026-08-02' }),
    ], HOY);
    expect(saldos).toHaveLength(2);
    expect(saldos.map((s) => s.tarjeta.name).sort()).toEqual(['Amex', 'Visa']);
  });

  it('lo mas viejo primero: es lo que mas urge', () => {
    const saldos = saldosSinPagar([visa], [
      gasto({ cyclePaymentDate: '2026-09-02' }),
      gasto({ cyclePaymentDate: '2026-07-02' }),
      gasto({ cyclePaymentDate: '2026-08-02' }),
    ], HOY);
    expect(saldos.map((s) => s.paymentDate)).toEqual(['2026-07-02', '2026-08-02', '2026-09-02']);
  });
});
