import { describe, expect, it } from 'vitest';
import { CLAIMABLE_STATUS, LIMITS, chunk, dueWindow, mapWithLimit, outOfTime, reminderPayload } from './policy';

describe('LIMITS (cost safety)', () => {
  it('are finite, positive and sized for a 10-minute cron', () => {
    expect(LIMITS.batchSize).toBe(500);
    expect(LIMITS.chunkSize).toBeGreaterThan(0);
    expect(LIMITS.chunkSize).toBeLessThanOrEqual(LIMITS.batchSize);
    expect(LIMITS.pushTimeoutMs).toBeGreaterThan(0);
    expect(LIMITS.pushTimeoutMs).toBeLessThanOrEqual(15_000);
    expect(LIMITS.pushConcurrency).toBeGreaterThan(0);
    // The run stops claiming well before the next tick (10 min) and before
    // the platform's wall-clock limit (150 s on the free plan).
    expect(LIMITS.runBudgetMs + LIMITS.pushTimeoutMs).toBeLessThan(150_000);
  });

  it('only scheduled reminders can be claimed', () => {
    expect(CLAIMABLE_STATUS).toBe('scheduled');
  });
});

describe('dueWindow', () => {
  const now = new Date('2026-09-30T14:00:00.000Z');

  it('ends now and starts maxLateness before', () => {
    expect(dueWindow(now)).toEqual({ from: '2026-09-29T14:00:00.000Z', to: '2026-09-30T14:00:00.000Z' });
    expect(dueWindow(now, 10 * 60_000)).toEqual({ from: '2026-09-30T13:50:00.000Z', to: '2026-09-30T14:00:00.000Z' });
  });

  it('is (from, to]: due now counts, exactly maxLateness late does not', () => {
    const { from, to } = dueWindow(now);
    const due = (remindAt: string) => remindAt > from && remindAt <= to;
    expect(due('2026-09-30T14:00:00.000Z')).toBe(true);
    expect(due('2026-09-30T13:55:00.000Z')).toBe(true); // since the previous run
    expect(due('2026-09-29T14:00:00.001Z')).toBe(true); // a missed run, still caught
    expect(due('2026-09-29T14:00:00.000Z')).toBe(false);
    expect(due('2026-09-30T14:00:00.001Z')).toBe(false); // future
  });

  it('crosses month and year boundaries', () => {
    expect(dueWindow(new Date('2027-01-01T03:00:00.000Z')).from).toBe('2026-12-31T03:00:00.000Z');
  });
});

describe('chunk', () => {
  it('splits keeping order, last one shorter', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
    expect(chunk(Array.from({ length: 500 }, (_, i) => i), LIMITS.chunkSize)).toHaveLength(Math.ceil(500 / LIMITS.chunkSize));
  });
  it('refuses a size that would loop forever', () => {
    expect(() => chunk([1], 0)).toThrow();
    expect(() => chunk([1], 1.5)).toThrow();
  });
});

describe('mapWithLimit', () => {
  it('keeps input order and never exceeds the limit in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapWithLimit([5, 1, 4, 2, 3, 0], 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, n));
      inFlight -= 1;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBe(2);
  });
  it('handles empty input and a limit larger than the input', async () => {
    expect(await mapWithLimit([], 10, async (n: number) => n)).toEqual([]);
    expect(await mapWithLimit([1, 2], 10, async (n) => n + 1)).toEqual([2, 3]);
  });
});

describe('outOfTime', () => {
  it('stops at the budget', () => {
    expect(outOfTime(0, LIMITS.runBudgetMs - 1)).toBe(false);
    expect(outOfTime(0, LIMITS.runBudgetMs)).toBe(true);
    expect(outOfTime(1000, 1500, 400)).toBe(true);
  });
});

describe('reminderPayload', () => {
  it('names the transaction and its amount', () => {
    const { title, body } = reminderPayload({ concept: 'GYM', amount: 100000 });
    expect(title).toBe('Step up');
    expect(body).toContain('GYM');
    expect(body).toMatch(/\$100[.\s ]?000/);
  });
  it('without the transaction, a generic line', () => {
    expect(reminderPayload(null).body).toBe('Tienes un pago próximo.');
  });
});
