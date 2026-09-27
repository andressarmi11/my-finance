import { describe, expect, it } from 'vitest';
import { deletedIdsOf, makeTombstone, mergeTombstones, tombstoneId } from './tombstones';

describe('tombstoneId', () => {
  it('is stable and idempotent', () => {
    expect(tombstoneId('transactions', 'abc')).toBe('transactions:abc');
    expect(makeTombstone('transactions', 'abc', '2026-01-01').id).toBe('transactions:abc');
  });

  it('does not mix entities with the same id', () => {
    expect(tombstoneId('categories', 'x')).not.toBe(tombstoneId('transactions', 'x'));
  });
});

describe('deletedIdsOf', () => {
  it('filters by entity', () => {
    const ts = [
      makeTombstone('transactions', 't1', '2026-01-01'),
      makeTombstone('categories', 'c1', '2026-01-01'),
      makeTombstone('transactions', 't2', '2026-01-01'),
    ];
    expect(deletedIdsOf(ts, 'transactions')).toEqual(new Set(['t1', 't2']));
    expect(deletedIdsOf(ts, 'categories')).toEqual(new Set(['c1']));
  });
});

describe('mergeTombstones', () => {
  it('keeps the original deletion date', () => {
    const old = makeTombstone('transactions', 't1', '2026-01-01T00:00:00Z');
    const copy = makeTombstone('transactions', 't1', '2026-05-05T00:00:00Z');
    expect(mergeTombstones([copy], [old])).toEqual([old]);
  });

  it('merges without duplicating', () => {
    const a = [makeTombstone('transactions', 't1', '2026-01-01')];
    const b = [makeTombstone('categories', 'c1', '2026-01-01')];
    expect(mergeTombstones(a, b)).toHaveLength(2);
  });
});
