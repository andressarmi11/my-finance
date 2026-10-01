import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Tope y Meta (PRESUPUESTOS-Y-AHORRO.md, part A): a savings category's
 * budget starts as a goal, a goal never turns red, and the headers read
 * "Gastos N% · Ahorro N%" with each part only when it exists.
 */
test.use({ viewport: { width: 390, height: 900 } });

/** Writes expenses straight into IndexedDB (dated today), then reloads. */
async function seedExpenses(page: Page, rows: Array<{ id: string; categoryId: string; amount: number }>) {
  await page.evaluate((rows) => new Promise<void>((resolve, reject) => {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const open = indexedDB.open('myfinance_v1');
    open.onsuccess = () => {
      const tx = open.result.transaction('transactions', 'readwrite');
      for (const r of rows) {
        tx.objectStore('transactions').put({
          id: r.id, type: 'expense', concept: `Prueba ${r.id}`, amount: r.amount, date, categoryId: r.categoryId,
          paymentMethodId: null, status: 'paid', quincenaKey: null, updatedAt: new Date().toISOString(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  }), rows);
  await page.reload();
}

async function defineBudget(page: Page, category: string, amount: string) {
  await page.getByRole('button', { name: `Definir presupuesto: ${category}` }).click();
  const sheet = page.getByRole('dialog', { name: `Presupuesto de ${category}` });
  await sheet.getByLabel('Presupuesto mensual').fill(amount);
  await sheet.getByRole('button', { name: 'Guardar en 1 mes' }).click();
  await expect(sheet).toBeHidden();
}

test('a savings budget is a goal, a goal never goes red, and Tope | Meta switches the reading', async ({ page }) => {
  await page.goto('ajustes/presupuestos');
  await seedExpenses(page, [
    { id: 'ahorro-1', categoryId: 'cat-ahorro', amount: 400_000 },
    { id: 'hogar-1', categoryId: 'cat-hogar', amount: 300_000 },
  ]);

  // The intro explains both.
  await expect(page.getByText('Lo máximo que quieres gastar.', { exact: false }).or(page.getByText(/lo máximo que quieres gastar\./))).toBeVisible();
  await expect(page.getByText(/lo que quieres llegar a ahorrar\./)).toBeVisible();

  // Ahorro (savings icon) is born a goal: past 100% is "meta cumplida", not "te pasaste".
  await defineBudget(page, 'Ahorro', '300000');
  const ahorro = page.getByTestId('budget-row-cat-ahorro');
  await expect(ahorro.getByRole('button', { name: 'Meta', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(ahorro).toContainText(/Ahorrado \$\s400\.000 de \$\s300\.000 · meta cumplida/);
  await expect(ahorro).not.toContainText('te pasaste');
  await expect(page.getByTestId('goal-tag')).toHaveText('✓ Meta');
  // Only savings exist: no "Gastos" stat.
  await expect(page.getByTestId('budget-stat-savings')).toContainText('133%');
  await expect(page.getByTestId('budget-stat-spending')).toHaveCount(0);

  // Hogar is a limit: past 100% it says so.
  await defineBudget(page, 'Hogar', '200000');
  const hogar = page.getByTestId('budget-row-cat-hogar');
  await expect(hogar.getByRole('button', { name: 'Tope', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(hogar).toContainText('te pasaste');
  await expect(page.getByTestId('budget-stat-spending')).toContainText('150%');
  await expect(page.getByText(/Gastaste 300K de 200K · Ahorraste 400K de 300K/)).toBeVisible();

  // Switched to Meta: the same numbers, read as savings.
  await hogar.getByRole('button', { name: 'Meta', exact: true }).click();
  await expect(hogar.getByRole('button', { name: 'Meta', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(hogar).not.toContainText('te pasaste');
  await expect(hogar).toContainText(/Ahorrado \$\s300\.000 de \$\s200\.000 · meta cumplida/);
  await expect(page.getByTestId('goal-tag')).toHaveCount(2);
  await expect(page.getByTestId('budget-stat-spending')).toHaveCount(0);

  // It survives a reload (saved, not just on screen).
  await page.reload();
  await expect(page.getByTestId('budget-row-cat-hogar').getByRole('button', { name: 'Meta', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Análisis: the card's header reads only the part that exists.
  await page.getByRole('link', { name: 'Análisis' }).click();
  const card = page.getByRole('button', { name: /Presupuestos/ }).filter({ hasText: 'Ahorro 140%' });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText('Gastos');

  // Back to Tope: the stat for spending comes back.
  await page.goto('ajustes/presupuestos');
  await page.getByTestId('budget-row-cat-hogar').getByRole('button', { name: 'Tope', exact: true }).click();
  await expect(page.getByTestId('budget-stat-spending')).toContainText('150%');
  await expect(page.getByTestId('goal-tag')).toHaveCount(1);
});

test('in English: Limit | Goal and the goal line', async ({ page }) => {
  await page.goto('ajustes/presupuestos');
  await seedExpenses(page, [{ id: 'ahorro-1', categoryId: 'cat-ahorro', amount: 100_000 }]);
  await defineBudget(page, 'Ahorro', '300000');
  const { switchLanguage } = await import('./fixtures');
  await switchLanguage(page, 'English');
  await page.goto('ajustes/presupuestos');
  const ahorro = page.getByTestId('budget-row-cat-ahorro');
  await expect(ahorro.getByRole('button', { name: 'Goal', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(ahorro.getByRole('button', { name: 'Limit', exact: true })).toBeVisible();
  await expect(ahorro).toContainText(/Saved \$\s100\.000 of \$\s300\.000 · \$\s200\.000 to go/);
  await expect(page.getByTestId('goal-tag')).toHaveText('Goal');
});
