import { describe, expect, it } from 'vitest';
import { MAX_AHEAD_DAYS, withinHorizon } from './materialize';

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
