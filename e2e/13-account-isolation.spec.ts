import { test, expect } from '@playwright/test';

/**
 * With a real IndexedDB: when another account signs in on the same browser,
 * the previous account's data must NOT survive.
 *
 * This genuinely happened. The app is offline-first, so signing out cleared
 * the Supabase token but left Dexie intact; the next login picked up those
 * rows and uploaded them stamped with ITS user_id. It wasn't just seeing
 * someone else's data: it ended up copied into the other account's cloud.
 *
 * It runs in the 'isolation' project (dev server), because it imports source
 * modules the preview bundle doesn't expose. See playwright.config.ts.
 */

/** The bare minimum this test uses from a Dexie table. */
interface Tabla {
  name: string;
  clear(): Promise<void>;
  count(): Promise<number>;
  put(row: unknown): Promise<unknown>;
}
interface ModuloDb {
  db: { tables: Tabla[]; transactions: Tabla; categories: Tabla };
}
interface ModuloDueno {
  ensureOwner(entrante: string): Promise<boolean>;
  localOwner(): Promise<string | null>;
}

test('data does not cross between accounts', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto('./');

  const r = await page.evaluate(async () => {
    // Los especificadores van en variables a propósito: estos módulos los
    // resuelve el NAVEGADOR contra el dev server. Como literales,
    // TypeScript intentaría resolverlos en disco y no existen como esa
    // ruta.
    const rutaDb = '/step-up/src/data/db.ts';
    const rutaDueno = '/step-up/src/data/sync/owner.ts';
    const { db } = (await import(rutaDb)) as ModuloDb;
    const { ensureOwner, localOwner } = (await import(rutaDueno)) as ModuloDueno;

    const seed = async (concept: string) => {
      await db.transactions.put({
        id: 'tx-' + concept, type: 'expense', concept: concept, amount: 999, date: '2026-09-01',
        categoryId: null, paymentMethodId: null, status: 'paid',
        quincenaKey: null, createdAt: '', updatedAt: '2026-09-01T00:00:00Z',
      });
      await db.categories.put({
        id: 'cat-secreta', name: 'Terapia', icon: '*', color: '#000', kind: 'expense',
        updatedAt: '', isArchived: false, sortOrder: 1,
      });
    };

    // ── Case 1: started with no account and signs up. Their data MUST stay.
    await Promise.all(db.tables.map((t: Tabla) => t.clear()));
    await seed('gasto-de-ana');
    const limpio1 = await ensureOwner('ana');
    const adopta = await db.transactions.count();

    // ── Case 2: the same person signs in again. Nothing is touched.
    const limpio2 = await ensureOwner('ana');
    const sigue = await db.transactions.count();

    // ── Case 3: ANOTHER ACCOUNT SIGNS IN. Nothing of Ana's may remain.
    const limpio3 = await ensureOwner('beto');
    const counts = await Promise.all(
      db.tables.filter((t: Tabla) => t.name !== 'meta').map((t: Tabla) => t.count()),
    );
    const restos = {
      transacciones: await db.transactions.count(),
      cats: await db.categories.count(),
      // No table may be left with traces, tombstones included.
      total: counts.reduce((a: number, b: number) => a + b, 0),
    };
    const ownerNow = await localOwner();

    // ── Case 4: and whatever Beto saves afterwards is his and survives.
    await seed('gasto-de-beto');
    await ensureOwner('beto');
    const deBeto = await db.transactions.count();

    return { limpio1, adopta, limpio2, sigue, limpio3, restos, ownerNow, deBeto };
  });

  expect(errores, 'sin errores de página').toEqual([]);

  // Case 1: it adopts the data of someone who had no account.
  expect(r.limpio1).toBe(false);
  expect(r.adopta).toBe(1);
  // Case 2: the same user loses nothing.
  expect(r.limpio2).toBe(false);
  expect(r.sigue).toBe(1);
  // Case 3: switching accounts wipes EVERYTHING from before.
  expect(r.limpio3).toBe(true);
  expect(r.restos.transacciones).toBe(0);
  expect(r.restos.cats).toBe(0);
  expect(r.restos.total).toBe(0);
  expect(r.ownerNow).toBe('beto');
  // Case 4: and the new account does keep its own.
  expect(r.deBeto).toBe(1);
});

interface ModuloBorrado {
  clearLocalDevice(): Promise<void>;
}

/**
 * Ajustes → Cerrar sesión → "Borrar también de este teléfono" (redesign
 * §11 item 4): after signing out, the whole local database goes — owner
 * marker and tombstones included — and so do the device preferences in
 * localStorage. The database is opened again, empty and usable.
 */
test('"also erase it from this phone" leaves no data and no preferences', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto('./');

  const r = await page.evaluate(async () => {
    const rutaDb = '/step-up/src/data/db.ts';
    const rutaDueno = '/step-up/src/data/sync/owner.ts';
    const rutaBorrado = '/step-up/src/features/settings/clearLocalDevice.ts';
    const { db } = (await import(rutaDb)) as ModuloDb;
    const { ensureOwner } = (await import(rutaDueno)) as ModuloDueno;
    const { clearLocalDevice } = (await import(rutaBorrado)) as ModuloBorrado;

    await db.transactions.put({
      id: 'tx-privada', type: 'expense', concept: 'Privado', amount: 1, date: '2026-09-01',
      categoryId: null, paymentMethodId: null, status: 'paid',
      quincenaKey: null, createdAt: '', updatedAt: '2026-09-01T00:00:00Z',
    });
    await ensureOwner('ana');
    localStorage.setItem('step-up:language', 'en');
    localStorage.setItem('movimientos.collapsed', '["2026-09-Q1"]');
    localStorage.setItem('sb-fake-auth-token', 'left to supabase-js');

    await clearLocalDevice();

    // Per table. The app on the page re-seeds its defaults (settings,
    // categories, payment methods) as soon as the database reopens, and
    // that can land before this count: those are factory defaults, not the
    // account's data, so they don't count as "left behind".
    const SEEDED_BY_APP = new Set(['settings', 'categories', 'paymentMethods']);
    const counts = await Promise.all(
      db.tables.filter((t: Tabla) => !SEEDED_BY_APP.has(t.name)).map((t: Tabla) => t.count()),
    );
    // Still usable after the wipe: the app keeps its handle on `db`.
    await db.transactions.put({
      id: 'tx-nueva', type: 'expense', concept: 'Nueva', amount: 1, date: '2026-09-02',
      categoryId: null, paymentMethodId: null, status: 'paid',
      quincenaKey: null, createdAt: '', updatedAt: '2026-09-02T00:00:00Z',
    });
    return {
      total: counts.reduce((a: number, b: number) => a + b, 0),
      despues: await db.transactions.count(),
      keys: Object.keys(localStorage).sort(),
    };
  });

  expect(errores, 'sin errores de página').toEqual([]);
  expect(r.total).toBe(0);
  expect(r.despues).toBe(1);
  expect(r.keys).toEqual(['sb-fake-auth-token']);
});
