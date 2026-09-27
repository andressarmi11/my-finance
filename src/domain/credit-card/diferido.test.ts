import { describe, expect, it } from 'vitest';
import { expandirDiferido } from './diferido';

describe('expandirDiferido — el reparto de la plata', () => {
  /* El caso que atrapa el error de redondeo. Si la suma de las cuotas deja
     de ser la compra, el cupo queda descuadrado por unos pesos que nadie
     sabria de donde salieron. */
  it('la suma de las cuotas es EXACTAMENTE el total', () => {
    for (const total of [1_000_000, 999_999, 1, 7, 1_234_567]) {
      for (const n of [1, 2, 3, 6, 12, 24, 36]) {
        const cuotas = expandirDiferido('2026-09-20', total, n, 15, 2);
        expect(cuotas.reduce((a, c) => a + c.amount, 0), `${total} a ${n}`).toBe(total);
      }
    }
  });

  it('el resto cae en la primera cuota', () => {
    const cuotas = expandirDiferido('2026-09-20', 1_000_000, 3, 15, 2);
    expect(cuotas.map((c) => c.amount)).toEqual([333_334, 333_333, 333_333]);
  });

  it('cuando divide exacto, todas valen lo mismo', () => {
    const cuotas = expandirDiferido('2026-09-20', 1_200_000, 12, 15, 2);
    expect(new Set(cuotas.map((c) => c.amount))).toEqual(new Set([100_000]));
  });

  it('numera las cuotas de 1 a N', () => {
    const cuotas = expandirDiferido('2026-09-20', 600_000, 6, 15, 2);
    expect(cuotas.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('expandirDiferido — las fechas', () => {
  it('las fechas de pago salen consecutivas, mes a mes', () => {
    const cuotas = expandirDiferido('2026-09-20', 300_000, 3, 15, 2);
    expect(cuotas.map((c) => c.date)).toEqual(['2026-09-20', '2026-10-20', '2026-11-20']);
    expect(cuotas.map((c) => c.cyclePaymentDate)).toEqual(['2026-11-02', '2026-12-02', '2027-01-02']);
  });

  it('una compra el 31 se clampea en los meses cortos', () => {
    const cuotas = expandirDiferido('2026-01-31', 300_000, 3, 15, 2);
    expect(cuotas.map((c) => c.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('cruza el cambio de año sin despeinarse', () => {
    const cuotas = expandirDiferido('2026-11-20', 200_000, 2, 15, 2);
    expect(cuotas.map((c) => c.date)).toEqual(['2026-11-20', '2026-12-20']);
    expect(cuotas[1]!.cyclePaymentDate).toBe('2027-02-02');
  });

  it('usa el corte y el pago de SU tarjeta, no unos genéricos', () => {
    const cuotas = expandirDiferido('2026-09-20', 200_000, 2, 5, 20);
    expect(cuotas.map((c) => c.cyclePaymentDate)).toEqual(['2026-11-20', '2026-12-20']);
  });
});

describe('expandirDiferido — el interés lo escribe el usuario', () => {
  it('con valorCuota, todas valen eso y la suma supera al total', () => {
    const cuotas = expandirDiferido('2026-09-20', 1_200_000, 12, 15, 2, 115_000);
    expect(new Set(cuotas.map((c) => c.amount))).toEqual(new Set([115_000]));
    expect(cuotas.reduce((a, c) => a + c.amount, 0)).toBe(1_380_000);
  });
});

describe('expandirDiferido — bordes', () => {
  it('una sola cuota no es un diferido: devuelve la compra entera', () => {
    const cuotas = expandirDiferido('2026-09-20', 500_000, 1, 15, 2);
    expect(cuotas).toHaveLength(1);
    expect(cuotas[0]!.amount).toBe(500_000);
    expect(cuotas[0]!.date).toBe('2026-09-20');
  });

  it('cero o negativo se trata como una sola cuota, no revienta', () => {
    expect(expandirDiferido('2026-09-20', 500_000, 0, 15, 2)).toHaveLength(1);
    expect(expandirDiferido('2026-09-20', 500_000, -3, 15, 2)).toHaveLength(1);
  });
});
