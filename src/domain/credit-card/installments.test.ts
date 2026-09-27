import { describe, expect, it } from 'vitest';
import { expandInstallments } from './installments';

describe('expandInstallments — splitting the money', () => {
  /* The case that catches the rounding bug. If the sum of the instalments
     no longer equals the purchase, the credit limit ends up off by a few
     pesos nobody could account for. */
  it('the sum of the instalments is EXACTLY the total', () => {
    for (const total of [1_000_000, 999_999, 1, 7, 1_234_567]) {
      for (const n of [1, 2, 3, 6, 12, 24, 36]) {
        const installments = expandInstallments('2026-09-20', total, n, 15, 2);
        expect(installments.reduce((a, c) => a + c.amount, 0), `${total} a ${n}`).toBe(total);
      }
    }
  });

  it('the remainder falls on the first instalment', () => {
    const installments = expandInstallments('2026-09-20', 1_000_000, 3, 15, 2);
    expect(installments.map((c) => c.amount)).toEqual([333_334, 333_333, 333_333]);
  });

  it('when it divides evenly, all instalments are worth the same', () => {
    const installments = expandInstallments('2026-09-20', 1_200_000, 12, 15, 2);
    expect(new Set(installments.map((c) => c.amount))).toEqual(new Set([100_000]));
  });

  it('numbers the instalments from 1 to N', () => {
    const installments = expandInstallments('2026-09-20', 600_000, 6, 15, 2);
    expect(installments.map((c) => c.toNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('expandInstallments — the dates', () => {
  it('payment dates come out consecutive, month by month', () => {
    const installments = expandInstallments('2026-09-20', 300_000, 3, 15, 2);
    expect(installments.map((c) => c.date)).toEqual(['2026-09-20', '2026-10-20', '2026-11-20']);
    expect(installments.map((c) => c.cyclePaymentDate)).toEqual(['2026-11-02', '2026-12-02', '2027-01-02']);
  });

  it('a purchase on the 31st gets clamped in short months', () => {
    const installments = expandInstallments('2026-01-31', 300_000, 3, 15, 2);
    expect(installments.map((c) => c.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('crosses a year boundary without a hitch', () => {
    const installments = expandInstallments('2026-11-20', 200_000, 2, 15, 2);
    expect(installments.map((c) => c.date)).toEqual(['2026-11-20', '2026-12-20']);
    expect(installments[1]!.cyclePaymentDate).toBe('2027-02-02');
  });

  it("uses ITS OWN card's cutoff and payment day, not generic ones", () => {
    const installments = expandInstallments('2026-09-20', 200_000, 2, 5, 20);
    expect(installments.map((c) => c.cyclePaymentDate)).toEqual(['2026-11-20', '2026-12-20']);
  });
});

describe('expandInstallments — interest is entered by the user', () => {
  it('with valorCuota, all instalments equal that and the sum exceeds the total', () => {
    const installments = expandInstallments('2026-09-20', 1_200_000, 12, 15, 2, 115_000);
    expect(new Set(installments.map((c) => c.amount))).toEqual(new Set([115_000]));
    expect(installments.reduce((a, c) => a + c.amount, 0)).toBe(1_380_000);
  });
});

describe('expandInstallments — edge cases', () => {
  it('a single instalment is not an instalment purchase: returns the whole purchase', () => {
    const installments = expandInstallments('2026-09-20', 500_000, 1, 15, 2);
    expect(installments).toHaveLength(1);
    expect(installments[0]!.amount).toBe(500_000);
    expect(installments[0]!.date).toBe('2026-09-20');
  });

  it('zero or negative is treated as a single instalment, does not blow up', () => {
    expect(expandInstallments('2026-09-20', 500_000, 0, 15, 2)).toHaveLength(1);
    expect(expandInstallments('2026-09-20', 500_000, -3, 15, 2)).toHaveLength(1);
  });
});
