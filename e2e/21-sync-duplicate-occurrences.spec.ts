import { test, expect } from './fixtures';

/**
 * Reproduces the production error against a REAL IndexedDB:
 *
 *   transactions.bulkPut(): 13 of 150 operations failed.
 *   ConstraintError: Unable to add key to index '[recurringRuleId+periodKey]'
 *
 * The unit test covers the decision (which row wins, which one dies). This
 * one covers the other half: that Dexie's unique index really does reject
 * the repeated pair, which was the assumption the whole diagnosis hung on.
 */
test('the unique index rejects two ids for the same occurrence, and the plan avoids it', async ({ page }) => {
  await page.goto('');

  const result = await page.evaluate(async () => {
    // The paths are in variables, not literals: they're resolved by the
    // BROWSER against the dev server. As literals, TypeScript would try to
    // resolve them on disk and they don't exist at that path (same trick as
    // 13-account-isolation).
    const rutaDb = '/step-up/src/data/db.ts';
    const rutaPlan = '/step-up/src/data/sync/duplicateOccurrences.ts';
    const { db } = (await import(rutaDb)) as {
      db: {
        transactions: {
          clear(): Promise<void>;
          put(row: unknown): Promise<unknown>;
          bulkPut(rows: unknown[]): Promise<unknown>;
          bulkDelete(ids: string[]): Promise<void>;
          toArray(): Promise<Array<{ id: string }>>;
        };
      };
    };
    const { reconcileOccurrences } = (await import(rutaPlan)) as {
      reconcileOccurrences: (
        remotas: unknown[], localRows: unknown[],
      ) => { toSave: unknown[]; toDelete: string[] };
    };

    const base = {
      type: 'expense' as const, concept: 'Arriendo', amount: 1_500_000, date: '2026-09-01',
      categoryId: null, paymentMethodId: null, status: 'pending' as const, quincenaKey: null,
      recurringRuleId: 'regla-1', periodKey: '2026-09',
      createdAt: '', updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const viejaDeLaNube = { ...base, id: 'uuid-viejo-aleatorio' };
    const newLocal = { ...base, id: 'regla-1:2026-09' };

    await db.transactions.clear();
    await db.transactions.put(newLocal);

    // 1) Without reconciling: the pull's bulkPut blows up. That IS the bug.
    let rawMessage = '';
    try {
      await db.transactions.bulkPut([viejaDeLaNube]);
    } catch (e) {
      rawMessage = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }

    // 2) With the plan: a single row goes in, under the deterministic id.
    await db.transactions.clear();
    await db.transactions.put(newLocal);
    const plan = reconcileOccurrences([viejaDeLaNube], [newLocal]);
    await db.transactions.bulkDelete(plan.toDelete);
    await db.transactions.bulkPut(plan.toSave);

    const quedaron = await db.transactions.toArray();
    return {
      rawMessage,
      ids: quedaron.map((t) => t.id),
      toDelete: plan.toDelete,
    };
  });

  // The diagnosis's assumption, confirmed against a real Dexie.
  expect(result.rawMessage).toContain('ConstraintError');
  expect(result.rawMessage).toContain('recurringRuleId+periodKey');

  // And the fix: a single row, with the id materialize is going to recreate.
  expect(result.ids).toEqual(['regla-1:2026-09']);
  expect(result.toDelete).toEqual(['uuid-viejo-aleatorio']);
});
