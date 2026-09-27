import { test, expect } from './fixtures';

/**
 * Que el .xlsx sea un archivo de verdad, no un blob vacio ni texto.
 *
 * Se comprueba EN EL NAVEGADOR y no leyendo el archivo descargado con
 * node:fs, por dos razones: el tsconfig de e2e no trae los tipos de Node
 * (y sumar @types/node para un assert seria una dependencia por un
 * chequeo), y acá se prueba lo que de verdad importa — que la libreria
 * produce bytes validos en el mismo navegador donde corre la PWA.
 *
 * Va contra el dev server porque importa modulos FUENTE.
 */
test('write-excel-file produce un zip válido con las siete hojas', async ({ page }) => {
  await page.goto('');

  const resultado = await page.evaluate(async () => {
    const rutaXlsx = '/step-up/node_modules/write-excel-file/browser/index.js';
    const rutaFilas = '/step-up/src/data/backup/xlsxRows.ts';

    const { default: writeXlsxFile } = (await import(rutaXlsx)) as {
      default: (hojas: unknown[]) => Promise<{ toBlob: () => Promise<Blob> }>;
    };
    const { HOJAS } = (await import(rutaFilas)) as {
      HOJAS: ReadonlyArray<{ nombre: string; filas: (b: unknown) => unknown[] }>;
    };

    const backupVacio = {
      schemaVersion: 1, exportedAt: '2026-09-26T00:00:00.000Z',
      settings: [{ displayName: 'Andrés', currency: 'COP', diasDePago: [10, 25], theme: 'system' }],
      categories: [{ id: 'c1', name: 'Hogar', icon: '🏠', kind: 'expense', isArchived: false }],
      paymentMethods: [{ id: 'm1', name: 'Visa', type: 'credit', cutoffDay: 15, paymentDay: 2, creditLimit: 5000000 }],
      transactions: [{
        id: 't1', type: 'expense', concept: 'Mercado', amount: 120000, date: '2026-09-20',
        categoryId: 'c1', paymentMethodId: 'm1', status: 'pending',
      }],
      recurringRules: [], budgets: [], reminders: [],
    };

    const { toBlob } = await writeXlsxFile(
      HOJAS.map((h) => ({ data: h.filas(backupVacio), sheet: h.nombre, stickyRowsCount: 1 })),
    );
    const blob = await toBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    return {
      hojas: HOJAS.map((h) => h.nombre),
      tamano: bytes.length,
      // Un .xlsx es un zip: sus dos primeros bytes son 'P' y 'K'.
      firma: String.fromCharCode(bytes[0]!, bytes[1]!),
    };
  });

  expect(resultado.firma).toBe('PK');
  expect(resultado.tamano).toBeGreaterThan(1000);
  expect(resultado.hojas).toEqual([
    'Movimientos', 'Categorías', 'Métodos de pago',
    'Presupuestos', 'Recurrentes', 'Recordatorios', 'Configuración',
  ]);
});
