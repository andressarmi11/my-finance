import { describe, expect, it } from 'vitest';
import { goneWhileAway, isStale, since } from './syncService';
import type { Transaction } from '@/domain/types';

const tx = (id: string, updatedAt: string) => ({ id, updatedAt }) as Transaction;
const DAY = 24 * 60 * 60_000;

describe('a device that has not synced in months', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');

  it('is stale past 170 days, not before — and never without a cursor', () => {
    expect(isStale(new Date(now - 169 * DAY).toISOString(), now)).toBe(false);
    expect(isStale(new Date(now - 171 * DAY).toISOString(), now)).toBe(true);
    expect(isStale(null, now)).toBe(false);
  });

  it('drops what the cloud lost while it was away, keeps what it made offline', () => {
    const lastSync = '2026-03-01T00:00:00Z';
    const local = [
      tx('synced-then-deleted-elsewhere', '2026-02-10T00:00:00Z'),
      tx('generated-occurrence', '1970-01-01T00:00:00.000Z'),
      tx('made-offline', '2026-05-01T00:00:00Z'),
      tx('still-in-cloud', '2026-01-01T00:00:00Z'),
    ];
    expect(goneWhileAway(local, new Set(['still-in-cloud']), lastSync))
      .toEqual(['synced-then-deleted-elsewhere', 'generated-occurrence']);
  });
});

describe('where the next pull starts', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');

  it('re-reads the last two minutes while the cursor is fresh', () => {
    expect(since('2026-09-29T11:58:00.000Z', now)).toBe('2026-09-29T11:56:00.000Z');
  });

  it('reads exactly from an old cursor, so a batch at the cursor is not re-downloaded', () => {
    expect(since('2026-09-29T10:00:00.123456+00:00', now)).toBe('2026-09-29T10:00:00.123456+00:00');
  });

  it('downloads everything without a cursor', () => {
    expect(since(null, now)).toBeNull();
  });
});
