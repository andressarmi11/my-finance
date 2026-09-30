import { describe, expect, it } from 'vitest';
import { mergeVersions } from './syncService';

/**
 * Cost audit C1: the push compares against the versions this device knows
 * the cloud has, instead of downloading all of them every cycle. Merging a
 * new sighting must never move a row back to an older stamp.
 */
describe('mergeVersions', () => {
  it('adds unseen rows and keeps the newer stamp of a known one', () => {
    const known = new Map([['a', '2026-09-01T10:00:00.000Z'], ['b', '2026-09-02T10:00:00.000Z']]);
    const merged = mergeVersions(known, [
      ['a', '2026-09-03T10:00:00.000Z'], // newer: wins
      ['b', '2026-09-01T09:00:00.000Z'], // older: ignored
      ['c', '2026-09-04T10:00:00.000Z'], // new
    ]);
    expect(Object.fromEntries(merged)).toEqual({
      a: '2026-09-03T10:00:00.000Z',
      b: '2026-09-02T10:00:00.000Z',
      c: '2026-09-04T10:00:00.000Z',
    });
  });

  it('is what the push compares against: a local row equal to its known version does not go up', () => {
    const known = mergeVersions(new Map(), [['a', '2026-09-03T10:00:00.000Z']]);
    const local = [{ id: 'a', updatedAt: '2026-09-03T10:00:00.000Z' }, { id: 'n', updatedAt: '2026-09-05T00:00:00.000Z' }];
    const up = local.filter((t) => {
      const v = known.get(t.id);
      return v === undefined || Date.parse(t.updatedAt) > Date.parse(v);
    });
    expect(up.map((t) => t.id)).toEqual(['n']);
  });
});
