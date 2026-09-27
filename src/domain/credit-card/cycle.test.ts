import { describe, expect, it } from 'vitest';
import { calculateCreditCardCycle } from './cycle';
import { addDays, compareISO, parseISO, toISO } from '../dates';

/** The 10 exact cases from the spec, with cutoff=15 / payment=2. */
describe('calculateCreditCardCycle — spec cases (cutoff 15, payment 2)', () => {
  const cases: Array<[string, string, string]> = [
    ['2026-01-14', '2026-01-15', '2026-02-02'],
    ['2026-01-15', '2026-01-15', '2026-02-02'],
    ['2026-01-16', '2026-02-15', '2026-03-02'],
    ['2026-01-31', '2026-02-15', '2026-03-02'],
    ['2026-02-01', '2026-02-15', '2026-03-02'],
    ['2026-02-15', '2026-02-15', '2026-03-02'],
    ['2026-02-16', '2026-03-15', '2026-04-02'],
    ['2026-02-28', '2026-03-15', '2026-04-02'],
    ['2024-02-29', '2024-03-15', '2024-04-02'], // 29 Feb in a leap year
    ['2026-12-31', '2027-01-15', '2027-02-02'], // year boundary
  ];

  for (const [purchase, expectedCutoff, expectedPayment] of cases) {
    it(`purchase ${purchase} -> cutoff ${expectedCutoff} -> payment ${expectedPayment}`, () => {
      const result = calculateCreditCardCycle(purchase, 15, 2);
      expect(result.cycleCutoff).toBe(expectedCutoff);
      expect(result.paymentDate).toBe(expectedPayment);
    });
  }
});

describe('calculateCreditCardCycle — genericity (not hardcoded to 2026 or to 15/2)', () => {
  it('works the same in any year', () => {
    expect(calculateCreditCardCycle('2030-01-16', 15, 2).paymentDate).toBe('2030-03-02');
    expect(calculateCreditCardCycle('2019-01-16', 15, 2).paymentDate).toBe('2019-03-02');
  });

  it('respects a different cutoffDay/paymentDay', () => {
    // cutoff on day 5, payment on day 20
    expect(calculateCreditCardCycle('2026-09-04', 5, 20)).toEqual({
      cycleStart: '2026-08-06',
      cycleCutoff: '2026-09-05',
      paymentDate: '2026-10-20', // payment is the month AFTER the cutoff, not the same month
    });
    expect(calculateCreditCardCycle('2026-09-06', 5, 20).cycleCutoff).toBe('2026-10-05');
  });

  it('clamps cutoffDay=31 in short months (e.g. February)', () => {
    // purchase on 28 Feb (last possible day) with cutoff configured at 31
    const result = calculateCreditCardCycle('2026-02-28', 31, 5);
    expect(result.cycleCutoff).toBe('2026-02-28'); // clamped to the real last day
  });

  it('clamps paymentDay=31 in a payment month with fewer days', () => {
    // cutoff 15 January -> payment falls in February, which only has 28 days in 2026
    const result = calculateCreditCardCycle('2026-01-10', 15, 31);
    expect(result.paymentDate).toBe('2026-02-28');
  });
});

describe('calculateCreditCardCycle — invariants (property-based over a full year)', () => {
  it('the purchase date always falls within [cycleStart, cycleCutoff], and payment is always after the cutoff', () => {
    let cursor = parseISO('2026-01-01');
    for (let i = 0; i < 400; i++) {
      const purchase = toISO(cursor);
      const { cycleStart, cycleCutoff, paymentDate } = calculateCreditCardCycle(purchase, 15, 2);

      expect(compareISO(cycleStart, purchase)).toBeLessThanOrEqual(0);
      expect(compareISO(purchase, cycleCutoff)).toBeLessThanOrEqual(0);
      expect(compareISO(paymentDate, cycleCutoff)).toBeGreaterThan(0);

      cursor = addDays(cursor, 1);
    }
  });
});
