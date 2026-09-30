import { describe, expect, it } from 'vitest';
import { budgetKey, reconcileBudgets } from './budgets';
import type { Budget } from '@/domain/types';

function p(over: Partial<Budget> = {}): Budget {
  return {
    id: 'b1', categoryId: 'cat-hogar', year: 2026, month: 9, amount: 500_000,
    updatedAt: '2026-09-18T10:00:00.000Z',
    ...over,
  };
}

describe('clavePresupuesto', () => {
  it('is category + year + month, which is what Postgres declares unique', () => {
    expect(budgetKey(p())).toBe('cat-hogar|2026|9');
  });

  it('distinguishes months and categories', () => {
    expect(budgetKey(p({ month: 10 }))).not.toBe(budgetKey(p()));
    expect(budgetKey(p({ categoryId: 'cat-salud' }))).not.toBe(budgetKey(p()));
  });
});

describe('conciliarPresupuestos — the basics', () => {
  it('with nothing on either side, does nothing', () => {
    expect(reconcileBudgets([], [])).toEqual({ saveLocal: [], subir: [], deleteLocal: [] });
  });

  it('what only exists in the cloud gets pulled down', () => {
    const remoteRow = p({ id: 'r1' });
    const plan = reconcileBudgets([], [remoteRow]);
    expect(plan.saveLocal).toEqual([remoteRow]);
    expect(plan.subir).toEqual([]);
  });

  it('what only exists here gets uploaded', () => {
    const local = p({ id: 'l1' });
    const plan = reconcileBudgets([local], []);
    expect(plan.subir).toEqual([local]);
    expect(plan.saveLocal).toEqual([]);
  });
});

describe('conciliarPresupuestos — who wins', () => {
  it('the newest wins even if it is in the cloud', () => {
    const local = p({ id: 'x', amount: 100, updatedAt: '2026-09-01T00:00:00.000Z' });
    const remoteRow = p({ id: 'x', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' });
    const plan = reconcileBudgets([local], [remoteRow]);
    expect(plan.saveLocal).toEqual([remoteRow]);
    expect(plan.subir).toEqual([]);
  });

  it('the newest wins even if it is the local one', () => {
    const local = p({ id: 'x', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' });
    const remoteRow = p({ id: 'x', amount: 100, updatedAt: '2026-09-01T00:00:00.000Z' });
    const plan = reconcileBudgets([local], [remoteRow]);
    expect(plan.subir).toEqual([local]);
    expect(plan.saveLocal).toEqual([]);
  });

  it('a local row with no date does not beat a real one', () => {
    const local = p({ id: 'x', amount: 1, updatedAt: '' });
    const remoteRow = p({ id: 'x', amount: 900 });
    expect(reconcileBudgets([local], [remoteRow]).saveLocal).toEqual([remoteRow]);
  });
});

/**
 * The case that forces pairing by category+month instead of by id: two
 * phones that set a budget for the same month without having synced
 * generate different ids for the SAME row. Uploading the second one by
 * its id wouldn't create another row, it would collide with
 * unique(user_id, category_id, year, month) and take down the whole sync.
 */
describe('conciliarPresupuestos — two devices, different ids', () => {
  const local = p({ id: 'id-del-telefono', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' });
  const remoteRow = p({ id: 'id-del-portatil', amount: 100, updatedAt: '2026-09-01T00:00:00.000Z' });

  it('are recognized as the same row despite the different id', () => {
    const plan = reconcileBudgets([local], [remoteRow]);
    // A single row, not two.
    expect(plan.subir).toHaveLength(1);
    expect(plan.saveLocal).toHaveLength(1);
  });

  it('the newest amount wins, but it travels with the cloud id', () => {
    const plan = reconcileBudgets([local], [remoteRow]);
    expect(plan.subir[0]).toMatchObject({ id: 'id-del-portatil', amount: 900 });
  });

  it('the orphaned local id gets deleted, so the row is not left duplicated here', () => {
    const plan = reconcileBudgets([local], [remoteRow]);
    expect(plan.deleteLocal).toEqual(['id-del-telefono']);
    expect(plan.saveLocal[0]).toMatchObject({ id: 'id-del-portatil', amount: 900 });
  });

  it('if the cloud wins, the extra local id also gets cleaned up', () => {
    const plan = reconcileBudgets(
      [p({ id: 'id-del-telefono', amount: 900, updatedAt: '2026-09-01T00:00:00.000Z' })],
      [p({ id: 'id-del-portatil', amount: 100, updatedAt: '2026-09-20T00:00:00.000Z' })],
    );
    expect(plan.saveLocal).toEqual([p({ id: 'id-del-portatil', amount: 100, updatedAt: '2026-09-20T00:00:00.000Z' })]);
    expect(plan.deleteLocal).toEqual(['id-del-telefono']);
  });

  it('with the same id nothing gets deleted', () => {
    const plan = reconcileBudgets(
      [p({ id: 'x', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' })],
      [p({ id: 'x', amount: 100 })],
    );
    expect(plan.deleteLocal).toEqual([]);
  });
});

describe('conciliarPresupuestos — several months and categories at once', () => {
  it('each month and each category is resolved separately', () => {
    const localRows = [
      p({ id: 'l1', categoryId: 'cat-hogar', month: 9, amount: 100, updatedAt: '2026-09-20T00:00:00.000Z' }),
      p({ id: 'l2', categoryId: 'cat-hogar', month: 10, amount: 200 }),
      p({ id: 'l3', categoryId: 'cat-salud', month: 9, amount: 300 }),
    ];
    const remoteRows = [
      p({ id: 'r1', categoryId: 'cat-hogar', month: 9, amount: 999, updatedAt: '2026-09-01T00:00:00.000Z' }),
    ];
    const plan = reconcileBudgets(localRows, remoteRows);

    // September for Hogar: the local one (newer) wins, with the remote id.
    expect(plan.subir).toContainEqual(expect.objectContaining({ id: 'r1', amount: 100 }));
    // The other two never traveled: they get uploaded as-is.
    expect(plan.subir).toContainEqual(localRows[1]);
    expect(plan.subir).toContainEqual(localRows[2]);
    expect(plan.subir).toHaveLength(3);
  });
});

describe('deleting = saving amount 0 (newest wins)', () => {
  it('a delete on device A beats an older edit on device B', () => {
    const remoteDeleted = p({ id: 'r1', amount: 0, updatedAt: '2026-09-20T10:00:00.000Z' });
    const localOlderEdit = p({ id: 'l1', amount: 700_000, updatedAt: '2026-09-19T10:00:00.000Z' });
    const plan = reconcileBudgets([localOlderEdit], [remoteDeleted]);
    expect(plan.saveLocal).toEqual([remoteDeleted]);
    expect(plan.subir).toEqual([]);
    expect(plan.deleteLocal).toEqual(['l1']);
  });

  it('a newer edit on device B beats an older delete', () => {
    const remoteDeleted = p({ id: 'r1', amount: 0, updatedAt: '2026-09-19T10:00:00.000Z' });
    const localNewer = p({ id: 'l1', amount: 700_000, updatedAt: '2026-09-20T10:00:00.000Z' });
    const plan = reconcileBudgets([localNewer], [remoteDeleted]);
    expect(plan.subir).toEqual([{ ...localNewer, id: 'r1' }]);
  });
});
