import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

test('shows the dashboard with sample data', async ({ page }) => {
  await page.goto('');
  await expect(page.getByText('Todavía no hay movimientos')).toBeVisible();

  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();

  // Redesign §3: one big number, introduced by the greeting line.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Te queda en');
  // The month's four components: none may read as negative.
  await expect(page.getByText('Ya recibiste')).toBeVisible();
  await expect(page.getByText('Falta pagar', { exact: true })).toBeVisible();
  // Upcoming transactions, bounded to the month, with a way to see them all.
  await expect(page.getByRole('heading', { name: 'Falta este mes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver todos', exact: true })).toBeVisible();
  // The old duplicated cards and the separate breakdown button are gone.
  await expect(page.getByText('Esperas recibir')).toHaveCount(0);
  await expect(page.getByText('Desglose de lo que falta pagar')).toHaveCount(0);
});

test('"Falta pagar" opens its breakdown', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await page.getByRole('button', { name: /^Falta pagar/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('"Ver todos" goes to Movimientos, which leads back to Inicio', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await page.getByRole('button', { name: 'Ver todos', exact: true }).click();
  await expect(page).toHaveURL(/\/movimientos$/);
  await page.getByRole('link', { name: 'Inicio' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Te queda en');
});

test('navigates to the previous month and back to today', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Te queda en');

  await page.getByRole('button', { name: 'Mes anterior' }).click();
  // Leaving the current month reveals the shortcut back.
  const goBack = page.getByRole('button', { name: 'Volver al mes actual' });
  await expect(goBack).toBeVisible();
  await goBack.click();
  await expect(goBack).toBeHidden();
});
