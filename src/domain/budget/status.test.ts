import { describe, expect, it } from 'vitest';
import { calculateBudgetStatus } from './status';

describe('calculateBudgetStatus', () => {
  it('is ok below 80%', () => {
    expect(calculateBudgetStatus(500_000, 1_000_000).state).toBe('ok');
  });

  it('warns from 80% onward', () => {
    expect(calculateBudgetStatus(800_000, 1_000_000).state).toBe('warning');
    expect(calculateBudgetStatus(799_999, 1_000_000).state).toBe('ok');
  });

  it('marks exceeded when spending passes the budget, but does not block (only informs)', () => {
    const status = calculateBudgetStatus(1_200_000, 1_000_000);
    expect(status.state).toBe('exceeded');
    expect(status.remaining).toBe(-200_000); // negative: informational, not an error
  });

  it('a zero budget with spending does not blow up the function', () => {
    expect(calculateBudgetStatus(0, 0).state).toBe('ok');
    expect(calculateBudgetStatus(50_000, 0).state).toBe('exceeded');
  });
});
