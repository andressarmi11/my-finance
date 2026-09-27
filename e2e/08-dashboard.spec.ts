import { test, expect } from './fixtures';

test('shows the dashboard with sample data', async ({ page }) => {
  await page.goto('');
  await expect(page.getByText('Todavía no hay movimientos')).toBeVisible();

  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();

  await expect(page.getByText('Te queda este mes')).toBeVisible();
  // The month's four components: none may read as negative.
  await expect(page.getByText('Ya recibiste')).toBeVisible();
  await expect(page.getByText('Falta pagar', { exact: true })).toBeVisible();
  // Upcoming transactions, bounded to the month and covering both directions.
  await expect(page.getByText('Esperas recibir')).toBeVisible();
  await expect(page.getByText('Esperas gastar')).toBeVisible();
});

test('navigates to the previous month and back to today', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByText('Te queda este mes')).toBeVisible();

  await page.getByRole('button', { name: 'Mes anterior' }).click();
  // Leaving the current month reveals the shortcut back.
  const goBack = page.getByRole('button', { name: 'Volver al mes actual' });
  await expect(goBack).toBeVisible();
  await goBack.click();
  await expect(goBack).toBeHidden();
});
