import { test, expect } from './fixtures';

/**
 * That the .xlsx is a real file, not an empty blob and not text.
 *
 * It's checked IN THE BROWSER rather than by reading the downloaded file
 * with node:fs, for two reasons: the e2e tsconfig doesn't bring Node's
 * types (and adding @types/node for one assert would be a dependency for a
 * single check), and here we test what actually matters — that the library
 * produces valid bytes in the same browser the PWA runs in.
 *
 * It runs against the dev server because it imports SOURCE modules.
 */
test('write-excel-file produces a valid zip with the seven sheets', async ({ page }) => {
  await page.goto('');

  const result = await page.evaluate(async () => {
    const rutaXlsx = '/step-up/node_modules/write-excel-file/browser/index.js';
    const rutaFilas = '/step-up/src/data/backup/xlsxRows.ts';

    const { default: writeXlsxFile } = (await import(rutaXlsx)) as {
      default: (sheets: unknown[]) => Promise<{ toBlob: () => Promise<Blob> }>;
    };
    const { SHEETS } = (await import(rutaFilas)) as {
      SHEETS: ReadonlyArray<{ name: string; rows: (b: unknown) => unknown[] }>;
    };

    const backupVacio = {
      schemaVersion: 1, exportedAt: '2026-09-26T00:00:00.000Z',
      settings: [{ displayName: 'Andrés', currency: 'COP', payDays: [10, 25], theme: 'system' }],
      categories: [{ id: 'c1', name: 'Hogar', icon: '🏠', kind: 'expense', isArchived: false }],
      paymentMethods: [{ id: 'm1', name: 'Visa', type: 'credit', cutoffDay: 15, paymentDay: 2, creditLimit: 5000000 }],
      transactions: [{
        id: 't1', type: 'expense', concept: 'Mercado', amount: 120000, date: '2026-09-20',
        categoryId: 'c1', paymentMethodId: 'm1', status: 'pending',
      }],
      recurringRules: [], budgets: [], reminders: [],
    };

    const { toBlob } = await writeXlsxFile(
      SHEETS.map((h) => ({ data: h.rows(backupVacio), sheet: h.name, stickyRowsCount: 1 })),
    );
    const blob = await toBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    return {
      sheets: SHEETS.map((h) => h.name),
      tamano: bytes.length,
      // An .xlsx is a zip: its first two bytes are 'P' and 'K'.
      firma: String.fromCharCode(bytes[0]!, bytes[1]!),
    };
  });

  expect(result.firma).toBe('PK');
  expect(result.tamano).toBeGreaterThan(1000);
  expect(result.sheets).toEqual([
    'Movimientos', 'Categorías', 'Métodos de pago',
    'Presupuestos', 'Recurrentes', 'Recordatorios', 'Configuración',
  ]);
});
