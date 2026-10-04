import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Paid once a month on the 30th, on October 4th (the bug report): Inicio
 * said "Sep 2026" with the salary of September 30th, and Análisis said
 * "Oct 2026" with "Ingresos $0", because its month was the calendar's.
 * Now the three screens show the same month, 30 Sep – 29 Oct, called
 * "Octubre" because almost all of it is October.
 */
test.use({ viewport: { width: 390, height: 900 } });

async function seed(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const tx = open.result.transaction(['settings', 'transactions'], 'readwrite');
      const settings = tx.objectStore('settings');
      const get = settings.get('singleton');
      get.onsuccess = () => settings.put({ ...get.result, payDays: [30], updatedAt: new Date().toISOString() });
      const rows = [
        { id: 'salario', type: 'income', concept: 'Salario', amount: 4_185_000, date: '2026-09-30' },
        { id: 'arriendo', type: 'expense', concept: 'Arriendo', amount: 1_000_000, date: '2026-10-01' },
        { id: 'antes', type: 'expense', concept: 'Mes anterior', amount: 50_000, date: '2026-09-20' },
      ];
      for (const r of rows) {
        tx.objectStore('transactions').put({
          ...r, categoryId: null, paymentMethodId: null, status: 'paid', quincenaKey: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
}

test('paid on the 30th, Inicio, Análisis and Movimientos show the same month, named October, with its real days', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00'));
  await page.goto('');
  await seed(page);

  // Inicio: the month is "Octubre", and the line under it says which days
  // and how many are left.
  await expect(page.getByText('Oct 2026', { exact: true })).toBeVisible();
  await expect(page.getByText(/Te queda en Octubre/)).toBeVisible();
  await expect(page.getByTestId('period-days')).toHaveText('Ahora: 30 Sep – 29 Oct · faltan 25 días');

  // Análisis: the same month, so the salary of the 30th is there.
  await page.getByRole('link', { name: 'Análisis' }).click();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText('Oct 2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Balance de Octubre' })).toBeVisible();
  await expect(page.getByTestId('range-days')).toHaveText('30 Sep – 29 Oct');
  await expect(page.getByText(/Ingresos\s*\$\s*4\.185\.000/)).toBeVisible();
  await expect(page.getByText(/Gastos\s*\$\s*1\.000\.000/).first()).toBeVisible();
  // Paid monthly, a "quincena" would be the month again: no such option.
  await expect(page.getByText('Quincena', { exact: true })).toHaveCount(0);

  // A month back is 30 Aug – 29 Sep, named September, with the expense of the 20th.
  await page.getByRole('button', { name: 'Período anterior' }).click();
  await expect(page.getByRole('heading', { name: 'Balance de Septiembre' })).toBeVisible();
  await expect(page.getByTestId('range-days')).toHaveText('30 Ago – 29 Sep');

  // Movimientos: the same name.
  await page.goto('movimientos');
  await expect(page.getByText('Oct 2026', { exact: true })).toBeVisible();
  await expect(page.getByTestId('period-now')).toHaveText('Ahora · faltan 25 días');
});

test('paid on the 10th and 25th, on October 4th Movimientos puts the running pay period first', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00'));
  await page.goto('');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const tx = open.result.transaction('transactions', 'readwrite');
      for (const [id, date] of [['q10', '2026-09-12'], ['q25', '2026-09-27']]) {
        tx.objectStore('transactions').put({
          id, type: 'expense', concept: id, amount: 1000, date, categoryId: null, paymentMethodId: null,
          status: 'paid', quincenaKey: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.goto('movimientos');

  // Still September's view (25 Sep – 9 Oct is the 25th's pay period of
  // September), but the one running now comes first and says so.
  await expect(page.getByText('Sep 2026', { exact: true })).toBeVisible();
  const headers = page.getByRole('button', { name: /Quincena del/ });
  await expect(headers.first()).toContainText('Quincena del 25');
  await expect(headers.first()).toContainText('Ahora · faltan 5 días');
  await expect(headers.nth(1)).toContainText('Quincena del 10');
  await expect(page.getByTestId('period-now')).toHaveCount(1);
});
