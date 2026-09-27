import { test, expect } from '@playwright/test';

/**
 * Con IndexedDB real: al entrar otra cuenta en el mismo navegador, lo de la
 * cuenta anterior NO puede sobrevivir.
 *
 * Esto pasaba de verdad. La app es offline-first, así que cerrar sesión
 * borraba el token de Supabase pero dejaba Dexie intacto; el siguiente
 * login tomaba esas filas y las subía estampadas con SU user_id. No era
 * solo ver lo ajeno: quedaba copiado en la nube de la otra cuenta.
 *
 * Corre en el proyecto 'aislamiento' (dev server), porque importa módulos
 * fuente que el bundle del preview no expone. Ver playwright.config.ts.
 */

/** Lo mínimo que este test usa de una tabla de Dexie. */
interface Tabla {
  name: string;
  clear(): Promise<void>;
  count(): Promise<number>;
  put(fila: unknown): Promise<unknown>;
}
interface ModuloDb {
  db: { tables: Tabla[]; transactions: Tabla; categories: Tabla };
}
interface ModuloDueno {
  asegurarDueno(entrante: string): Promise<boolean>;
  duenoLocal(): Promise<string | null>;
}

test('los datos no cruzan entre cuentas', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto('./');

  const r = await page.evaluate(async () => {
    // Los especificadores van en variables a propósito: estos módulos los
    // resuelve el NAVEGADOR contra el dev server. Como literales,
    // TypeScript intentaría resolverlos en disco y no existen como esa
    // ruta.
    const rutaDb = '/step-up/src/data/db.ts';
    const rutaDueno = '/step-up/src/data/sync/dueno.ts';
    const { db } = (await import(rutaDb)) as ModuloDb;
    const { asegurarDueno, duenoLocal } = (await import(rutaDueno)) as ModuloDueno;

    const sembrar = async (concepto: string) => {
      await db.transactions.put({
        id: 'tx-' + concepto, type: 'expense', concept: concepto, amount: 999, date: '2026-09-01',
        categoryId: null, paymentMethodId: null, status: 'paid',
        quincenaKey: null, createdAt: '', updatedAt: '2026-09-01T00:00:00Z',
      });
      await db.categories.put({
        id: 'cat-secreta', name: 'Terapia', icon: '*', color: '#000', kind: 'expense',
        updatedAt: '', isArchived: false, sortOrder: 1,
      });
    };

    // ── Caso 1: empezó sin cuenta y se registra. Sus datos DEBEN quedar.
    await Promise.all(db.tables.map((t: Tabla) => t.clear()));
    await sembrar('gasto-de-ana');
    const limpio1 = await asegurarDueno('ana');
    const adopta = await db.transactions.count();

    // ── Caso 2: la misma persona vuelve a entrar. Nada se toca.
    const limpio2 = await asegurarDueno('ana');
    const sigue = await db.transactions.count();

    // ── Caso 3: ENTRA OTRA CUENTA. Nada de Ana puede quedar.
    const limpio3 = await asegurarDueno('beto');
    const conteos = await Promise.all(
      db.tables.filter((t: Tabla) => t.name !== 'meta').map((t: Tabla) => t.count()),
    );
    const restos = {
      transacciones: await db.transactions.count(),
      categorias: await db.categories.count(),
      // Ninguna tabla puede quedar con rastros, ni las lápidas.
      total: conteos.reduce((a: number, b: number) => a + b, 0),
    };
    const duenoAhora = await duenoLocal();

    // ── Caso 4: y lo que Beto guarde después es suyo y sobrevive.
    await sembrar('gasto-de-beto');
    await asegurarDueno('beto');
    const deBeto = await db.transactions.count();

    return { limpio1, adopta, limpio2, sigue, limpio3, restos, duenoAhora, deBeto };
  });

  expect(errores, 'sin errores de página').toEqual([]);

  // Caso 1: adopta los datos de quien no tenía cuenta.
  expect(r.limpio1).toBe(false);
  expect(r.adopta).toBe(1);
  // Caso 2: el mismo usuario no pierde nada.
  expect(r.limpio2).toBe(false);
  expect(r.sigue).toBe(1);
  // Caso 3: el cambio de cuenta borra TODO lo anterior.
  expect(r.limpio3).toBe(true);
  expect(r.restos.transacciones).toBe(0);
  expect(r.restos.categorias).toBe(0);
  expect(r.restos.total).toBe(0);
  expect(r.duenoAhora).toBe('beto');
  // Caso 4: y la cuenta nueva sí conserva lo suyo.
  expect(r.deBeto).toBe(1);
});
