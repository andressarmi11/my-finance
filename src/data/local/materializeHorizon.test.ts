import { describe, expect, it } from 'vitest';
import { MAX_AHEAD_DAYS, isCovered, rulesSignature, withinHorizon } from './materialize';
import type { RecurringRule } from '@/domain/types';

describe('how far ahead recurring payments are generated', () => {
  const today = '2026-09-29';

  it('leaves a range inside the next two years untouched', () => {
    expect(withinHorizon({ from: '2026-10-01', to: '2026-12-31' }, today))
      .toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });

  it('cuts a range that crosses the horizon at the horizon', () => {
    expect(MAX_AHEAD_DAYS).toBe(730);
    expect(withinHorizon({ from: '2028-01-01', to: '2028-12-31' }, today))
      .toEqual({ from: '2028-01-01', to: '2028-09-28' });
  });

  it('generates nothing for a range entirely past it — paging to 2200 writes no rows', () => {
    expect(withinHorizon({ from: '2200-01-01', to: '2200-12-31' }, today)).toBeNull();
  });

  it('never limits the past', () => {
    expect(withinHorizon({ from: '2020-01-01', to: '2020-12-31' }, today))
      .toEqual({ from: '2020-01-01', to: '2020-12-31' });
  });
});

describe('ranges already generated this session are not scanned again', () => {
  it('a range inside a done one is covered; one reaching past it is not', () => {
    const done = [{ from: '2026-09-01', to: '2026-12-31' }];
    expect(isCovered(done, { from: '2026-10-01', to: '2026-10-31' })).toBe(true);
    expect(isCovered(done, { from: '2026-09-01', to: '2026-12-31' })).toBe(true);
    expect(isCovered(done, { from: '2026-12-01', to: '2027-01-31' })).toBe(false);
    expect(isCovered([], { from: '2026-10-01', to: '2026-10-31' })).toBe(false);
  });

  it('any change to a rule changes the signature, so the memory is dropped', () => {
    const rule = { id: 'r1', updatedAt: '2026-09-01T00:00:00Z', isActive: true } as RecurringRule;
    const base = rulesSignature([rule]);
    expect(rulesSignature([{ ...rule, updatedAt: '2026-09-02T00:00:00Z' }])).not.toBe(base);
    expect(rulesSignature([{ ...rule, isActive: false }])).not.toBe(base);
    expect(rulesSignature([rule, { ...rule, id: 'r2' }])).not.toBe(base);
    // Order doesn't matter: the same rules read in another order are the same set.
    expect(rulesSignature([{ ...rule, id: 'r2' }, rule])).toBe(rulesSignature([rule, { ...rule, id: 'r2' }]));
  });
});
