import { describe, expect, it } from 'vitest';
import { reconcileOccurrences } from './duplicateOccurrences';
import type { Transaction } from '@/domain/types';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 'x', type: 'expense', concept: 'Arriendo', amount: 1_500_000,
    date: '2026-09-01', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '2026-09-01T00:00:00.000Z', ...over,
  };
}

/**
 * The real failure reported in production:
 *
 *   transactions.bulkPut(): 13 of 150 operations failed.
 *   ConstraintError: Unable to add key to index '[recurringRuleId+periodKey]'
 *
 * The same recurring occurrence exists with TWO ids: the random UUID from
 * before 2026-09-18 (still in the cloud) and the deterministic one
 * materialize.ts creates now. Dexie's unique index rejects them, bulkPut
 * throws, and the whole sync cycle dies.
 */
describe('conciliarOcurrencias — two ids for the same occurrence', () => {
  const PAIR = { recurringRuleId: 'regla-1', periodKey: '2026-09' };

  it('does not let through the remote row that would collide with a local one from the same pair', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAIR })];
    const remoteRow = [tx({ id: 'uuid-viejo-aleatorio', ...PAIR })];

    const plan = reconcileOccurrences(remoteRow, local);
    expect(plan.toSave.map((t) => t.id)).not.toContain('uuid-viejo-aleatorio');
  });

  it('the deterministic id wins, because it is the one materialize will recreate', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAIR, amount: 100 })];
    const remoteRow = [tx({ id: 'uuid-viejo', ...PAIR, amount: 999, updatedAt: '2026-09-20T00:00:00.000Z' })];

    const plan = reconcileOccurrences(remoteRow, local);
    const winner = plan.toSave.find((t) => t.recurringRuleId === 'regla-1');
    expect(winner?.id).toBe('regla-1:2026-09');
    // ...but with the newer content, which came in the remote row.
    expect(winner?.amount).toBe(999);
  });

  it('the losing id gets marked for deletion, or it comes back on the next cycle', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAIR })];
    const remoteRow = [tx({ id: 'uuid-viejo', ...PAIR })];

    expect(reconcileOccurrences(remoteRow, local).toDelete).toEqual(['uuid-viejo']);
  });

  it('if the local one is newer, the local content is kept', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAIR, amount: 777, updatedAt: '2026-09-25T00:00:00.000Z' })];
    const remoteRow = [tx({ id: 'uuid-viejo', ...PAIR, amount: 111, updatedAt: '2026-09-01T00:00:00.000Z' })];

    const winner = reconcileOccurrences(remoteRow, local).toSave.find((t) => t.recurringRuleId === 'regla-1');
    expect(winner?.amount).toBe(777);
  });

  it('two remote rows from the same pair cannot pass through together either', () => {
    const plan = reconcileOccurrences(
      [tx({ id: 'a', ...PAIR }), tx({ id: 'b', ...PAIR, updatedAt: '2026-09-30T00:00:00.000Z' })],
      [],
    );
    const delPar = plan.toSave.filter((t) => t.recurringRuleId === 'regla-1');
    expect(delPar).toHaveLength(1);
    // Saved under the deterministic id, so BOTH old ones DIE: if either of
    // them survived, it would collide again on the next cycle.
    expect(delPar[0]!.id).toBe('regla-1:2026-09');
    expect(plan.toDelete.sort()).toEqual(['a', 'b']);
  });
});

describe('conciliarOcurrencias — what it must NOT touch', () => {
  it('normal transactions pass through intact, even a lot of them', () => {
    const remoteRow = Array.from({ length: 50 }, (_, i) => tx({ id: `n-${i}` }));
    const plan = reconcileOccurrences(remoteRow, []);
    expect(plan.toSave).toHaveLength(50);
    expect(plan.toDelete).toEqual([]);
  });

  /* In Postgres NULL != NULL, so a thousand transactions with no rule
     coexist fine under the unique constraint. In IndexedDB a composite
     key with undefined isn't indexed. Neither one collides — and this
     function must not invent a collision where there isn't one. */
  it('a thousand transactions with no rule are not considered duplicates of each other', () => {
    const remoteRow = Array.from({ length: 1000 }, (_, i) => tx({ id: `n-${i}` }));
    expect(reconcileOccurrences(remoteRow, []).toDelete).toEqual([]);
  });

  it('occurrences from different rules or periods do not overwrite each other', () => {
    const remoteRow = [
      tx({ id: 'r1:2026-09', recurringRuleId: 'r1', periodKey: '2026-09' }),
      tx({ id: 'r1:2026-10', recurringRuleId: 'r1', periodKey: '2026-10' }),
      tx({ id: 'r2:2026-09', recurringRuleId: 'r2', periodKey: '2026-09' }),
    ];
    const plan = reconcileOccurrences(remoteRow, []);
    expect(plan.toSave).toHaveLength(3);
    expect(plan.toDelete).toEqual([]);
  });

  it('a half-filled row (rule with no period) is not treated as an occurrence', () => {
    const remoteRow = [
      tx({ id: 'a', recurringRuleId: 'r1' }),
      tx({ id: 'b', recurringRuleId: 'r1' }),
    ];
    expect(reconcileOccurrences(remoteRow, []).toDelete).toEqual([]);
  });
});
