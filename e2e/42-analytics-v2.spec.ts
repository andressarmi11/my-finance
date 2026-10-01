import { test, expect } from './fixtures';

/**
 * Redesign §6/§9c: the balance is the hero, every card folds (and stays
 * folded), a category row opens its detail, "Ingresos vs. gastos" is gone,
 * and an empty budgets card offers "Definir".
 */
test.beforeEach(async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: /Cargar datos de ejemplo/ }).click();
  await page.waitForTimeout(600);
  await page.goto('analisis');
});

test('balance hero, no income-vs-expenses chart', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /^Balance de/ })).toBeVisible();
  // Income and expenses under the balance (prototype: two labelled amounts).
  await expect(page.getByText(/^Ingresos \$/)).toBeVisible();
  await expect(page.getByText(/^Gastos \$/)).toBeVisible();
  await expect(page.getByText(/Ingresos vs\. gastos/)).toHaveCount(0);
});

test('a card folds and stays folded after a reload', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Plegar o desplegar Por método de pago' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Plegar o desplegar Por método de pago' })).toHaveAttribute('aria-expanded', 'false');
});

test('tapping a category row opens its detail', async ({ page }) => {
  // Whichever category tops the month: the sample data is dated around
  // today, so on the 1st the month may only hold one or two of them.
  const row = page.getByRole('button', { name: /^.+ \$\s[\d.]+ \d+%$/ }).first();
  const name = (await row.getAttribute('aria-label') ?? await row.innerText()).split(' $')[0]!.split('\n')[0]!.trim();
  await row.click();
  await expect(page.getByRole('dialog', { name })).toBeVisible();
});

test('no budgets: "Definir" goes to the budgets screen', async ({ page }) => {
  await page.getByRole('button', { name: 'Definir' }).click();
  await expect(page).toHaveURL(/\/ajustes\/presupuestos$/);
});
