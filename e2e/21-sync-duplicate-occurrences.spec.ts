import { test, expect } from './fixtures';

/**
 * Reproduce en IndexedDB REAL el error de produccion:
 *
 *   transactions.bulkPut(): 13 of 150 operations failed.
 *   ConstraintError: Unable to add key to index '[recurringRuleId+periodKey]'
 *
 * La prueba unitaria cubre la decision (que fila gana, cual muere). Esta
 * cubre lo otro: que el indice unico de Dexie de verdad rechaza el par
 * repetido, que era el supuesto del que colgaba todo el diagnostico.
 */
test('el indice unico rechaza dos ids para la misma ocurrencia, y el plan lo evita', async ({ page }) => {
  await page.goto('');

  const resultado = await page.evaluate(async () => {
    // Las rutas van en variables, no como literales: quien las resuelve es
    // el NAVEGADOR contra el dev server. Como literales, TypeScript intenta
    // resolverlas en disco y no existen con esa ruta (mismo truco que
    // 13-aislamiento-de-cuentas).
    const rutaDb = '/step-up/src/data/db.ts';
    const rutaPlan = '/step-up/src/data/sync/ocurrenciasDuplicadas.ts';
    const { db } = (await import(rutaDb)) as {
      db: {
        transactions: {
          clear(): Promise<void>;
          put(fila: unknown): Promise<unknown>;
          bulkPut(filas: unknown[]): Promise<unknown>;
          bulkDelete(ids: string[]): Promise<void>;
          toArray(): Promise<Array<{ id: string }>>;
        };
      };
    };
    const { conciliarOcurrencias } = (await import(rutaPlan)) as {
      conciliarOcurrencias: (
        remotas: unknown[], locales: unknown[],
      ) => { aGuardar: unknown[]; aBorrar: string[] };
    };

    const base = {
      type: 'expense' as const, concept: 'Arriendo', amount: 1_500_000, date: '2026-09-01',
      categoryId: null, paymentMethodId: null, status: 'pending' as const, quincenaKey: null,
      recurringRuleId: 'regla-1', periodKey: '2026-09',
      createdAt: '', updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const viejaDeLaNube = { ...base, id: 'uuid-viejo-aleatorio' };
    const nuevaLocal = { ...base, id: 'regla-1:2026-09' };

    await db.transactions.clear();
    await db.transactions.put(nuevaLocal);

    // 1) Sin conciliar: el bulkPut del pull revienta. Ese ES el bug.
    let mensajeCrudo = '';
    try {
      await db.transactions.bulkPut([viejaDeLaNube]);
    } catch (e) {
      mensajeCrudo = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }

    // 2) Con el plan: entra una sola fila, bajo el id determinista.
    await db.transactions.clear();
    await db.transactions.put(nuevaLocal);
    const plan = conciliarOcurrencias([viejaDeLaNube], [nuevaLocal]);
    await db.transactions.bulkDelete(plan.aBorrar);
    await db.transactions.bulkPut(plan.aGuardar);

    const quedaron = await db.transactions.toArray();
    return {
      mensajeCrudo,
      ids: quedaron.map((t) => t.id),
      aBorrar: plan.aBorrar,
    };
  });

  // El supuesto del diagnostico, confirmado contra Dexie de verdad.
  expect(resultado.mensajeCrudo).toContain('ConstraintError');
  expect(resultado.mensajeCrudo).toContain('recurringRuleId+periodKey');

  // Y el arreglo: una sola fila, con el id que materialize va a recrear.
  expect(resultado.ids).toEqual(['regla-1:2026-09']);
  expect(resultado.aBorrar).toEqual(['uuid-viejo-aleatorio']);
});
