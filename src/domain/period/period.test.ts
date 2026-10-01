import { describe, expect, it } from 'vitest';
import { calculatePeriod, isMonthly, normalizePayDays, periodMonthOf, periodsOfMonth, rangeFromKey } from './period';
import { addDays, clampDay, parseISO, shiftMonth, toISO } from '../dates';

/**
 * The pay-period algorithm EXACTLY AS IT WAS before being generalized,
 * copied here on purpose.
 *
 * It's the reference to compare against: if it lives in the test and nobody
 * can "fix" it without noticing, then comparing against it means something.
 * Importing it from production code would have meant any future change
 * moved both at once and the test stopped protecting anything.
 */
function calculateLegacyQuincena(date: string, startDays: [number, number]) {
  const [a, b] = startDays[0] < startDays[1] ? startDays : [startDays[1], startDays[0]];
  const { y, m, d } = parseISO(date);
  const aThis = clampDay(y, m, a);
  const bThis = clampDay(y, m, b);
  const key = (yy: number, mm: number, n: 1 | 2) =>
    `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-Q${n}`;

  if (d < aThis) {
    const prev = shiftMonth(y, m, -1);
    const bPrev = clampDay(prev.y, prev.m, b);
    return {
      key: key(prev.y, prev.m, 2),
      start: toISO({ ...prev, d: bPrev }),
      end: toISO(addDays({ y, m, d: aThis }, -1)),
    };
  }
  if (d < bThis) {
    return {
      key: key(y, m, 1),
      start: toISO({ y, m, d: aThis }),
      end: toISO(addDays({ y, m, d: bThis }, -1)),
    };
  }
  const next = shiftMonth(y, m, 1);
  const aNext = clampDay(next.y, next.m, a);
  return {
    key: key(y, m, 2),
    start: toISO({ y, m, d: bThis }),
    end: toISO(addDays({ ...next, d: aNext }, -1)),
  };
}

/** Every day between two dates, to sweep a whole year. */
function payDays(desde: string, hasta: string): string[] {
  const output: string[] = [];
  let d = parseISO(desde);
  const end = parseISO(hasta);
  while (toISO(d) <= toISO(end)) {
    output.push(toISO(d));
    d = addDays(d, 1);
  }
  return output;
}

/**
 * First and most important: generalizing must change nothing for anyone
 * already using the app. If with two pay days the result differs from the
 * old calculation by even one day, transactions would regroup themselves.
 */
describe('with two pay days it gives EXACTLY the same as before', () => {
  for (const payment of [[10, 25], [1, 16], [5, 20], [15, 30]] as Array<[number, number]>) {
    it(`días ${payment[0]} y ${payment[1]}: un año entero, día por día`, () => {
      for (const date of payDays('2026-01-01', '2026-12-31')) {
        const legacy = calculateLegacyQuincena(date, payment);
        const fresh = calculatePeriod(date, payment);
        expect({ key: fresh.key, start: fresh.start, end: fresh.end }, `difieren el ${date}`)
          .toEqual({ key: legacy.key, start: legacy.start, end: legacy.end });
      }
    });
  }

  it('also in a leap-year February, which is where the edges break', () => {
    for (const date of payDays('2024-02-01', '2024-03-05')) {
      expect(calculatePeriod(date, [15, 31]).key).toBe(calculateLegacyQuincena(date, [15, 31]).key);
    }
  });
});

describe('monthly — a single pay day', () => {
  it("with day 1 it's the calendar month", () => {
    const p = calculatePeriod('2026-09-20', [1]);
    expect(p).toEqual({ key: '2026-09-Q1', start: '2026-09-01', end: '2026-09-30', index: 1 });
  });

  it('the last day of the month still belongs to the same period', () => {
    expect(calculatePeriod('2026-09-30', [1]).key).toBe('2026-09-Q1');
    expect(calculatePeriod('2026-10-01', [1]).key).toBe('2026-10-Q1');
  });

  /**
   * The case of someone paid at the end of the month: their "month" runs
   * from the pay day to the day before the next payment, the same way the
   * 25th pay period crossed over.
   */
  it('with day 30, the period crosses the month boundary', () => {
    const p = calculatePeriod('2026-10-05', [30]);
    expect(p).toEqual({ key: '2026-09-Q1', start: '2026-09-30', end: '2026-10-29', index: 1 });
  });

  it('the pay day opens a new period', () => {
    expect(calculatePeriod('2026-10-29', [30]).key).toBe('2026-09-Q1');
    expect(calculatePeriod('2026-10-30', [30]).key).toBe('2026-10-Q1');
  });

  it("day 31 clamps in months that don't have one", () => {
    // February 2026 has no 31st: the payment lands on the 28th.
    const p = calculatePeriod('2026-03-01', [31]);
    expect(p.start).toBe('2026-02-28');
    expect(p.key).toBe('2026-02-Q1');
  });

  it("there is never a Q2 if there's only one pay day", () => {
    for (const date of payDays('2026-01-01', '2026-12-31')) {
      expect(calculatePeriod(date, [15]).key.endsWith('Q1')).toBe(true);
    }
  });
});

describe('isMonthly', () => {
  it('it tells them apart by how many pay days there are', () => {
    expect(isMonthly([1])).toBe(true);
    expect(isMonthly([30])).toBe(true);
    expect(isMonthly([10, 25])).toBe(false);
  });

  it('a repeated day is a single pay day', () => {
    expect(isMonthly([15, 15])).toBe(true);
  });
});

describe('normalizePayDays', () => {
  it('sorts, deduplicates and discards the impossible', () => {
    expect(normalizePayDays([25, 10])).toEqual([10, 25]);
    expect(normalizePayDays([10, 10, 25])).toEqual([10, 25]);
    expect(normalizePayDays([0, 10, 32, 25])).toEqual([10, 25]);
    expect(normalizePayDays([5.5, 10])).toEqual([10]);
  });

  it('an empty list falls back to the default instead of blowing up', () => {
    // Without this, working out a period from [] would give an out-of-range index.
    expect(normalizePayDays([])).toEqual([10, 25]);
    expect(normalizePayDays([0, 99])).toEqual([10, 25]);
  });
});

describe('rangeFromKey', () => {
  it('rebuilds the range without a transaction in hand', () => {
    expect(rangeFromKey('2026-09-Q2', [10, 25])).toEqual(calculatePeriod('2026-09-25', [10, 25]));
    expect(rangeFromKey('2026-09-Q1', [1])).toEqual(calculatePeriod('2026-09-01', [1]));
  });

  /**
   * Someone who was using biweekly periods and switches to monthly has Q2
   * keys stored. The screen can't blow up because of that.
   */
  it("an old Q2 key doesn't break someone now paid once a month", () => {
    expect(() => rangeFromKey('2026-09-Q2', [1])).not.toThrow();
    expect(rangeFromKey('2026-09-Q2', [1]).key).toBe('2026-09-Q1');
  });

  it('a garbage key does fail, and says so', () => {
    expect(() => rangeFromKey('septiembre', [10, 25])).toThrow(/Invalid period key/);
  });
});

describe('periodsOfMonth', () => {
  it('returns as many keys as there are pay days', () => {
    expect(periodsOfMonth(2026, 9, [10, 25])).toEqual(['2026-09-Q1', '2026-09-Q2']);
    expect(periodsOfMonth(2026, 9, [1])).toEqual(['2026-09-Q1']);
  });
});

/**
 * No date can be left without a period, or fall into two. It's the property
 * holding up every total in the app: if a day were counted twice, the
 * balances would lie.
 */
describe('coverage: every day falls in exactly one period', () => {
  for (const payment of [[10, 25], [1], [30], [1, 16], [5, 15, 25]]) {
    it(`días de pago ${JSON.stringify(payment)}`, () => {
      for (const date of payDays('2026-01-01', '2026-12-31')) {
        const p = calculatePeriod(date, payment);
        expect(p.start <= date, `${date} cae antes de su periodo ${p.key}`).toBe(true);
        expect(date <= p.end, `${date} cae después de su periodo ${p.key}`).toBe(true);
      }
    });
  }
});

describe('periodMonthOf', () => {
  it('before the first pay day, the month is still the previous one', () => {
    expect(periodMonthOf('2026-10-01', [10, 25])).toEqual({ y: 2026, m: 9 });
    expect(periodMonthOf('2026-10-09', [10, 25])).toEqual({ y: 2026, m: 9 });
    expect(periodMonthOf('2026-01-05', [10, 25])).toEqual({ y: 2025, m: 12 });
  });
  it('from the first pay day on, it is the calendar month', () => {
    expect(periodMonthOf('2026-10-10', [10, 25])).toEqual({ y: 2026, m: 10 });
    expect(periodMonthOf('2026-10-31', [10, 25])).toEqual({ y: 2026, m: 10 });
    expect(periodMonthOf('2026-10-01', [1])).toEqual({ y: 2026, m: 10 });
  });
});
