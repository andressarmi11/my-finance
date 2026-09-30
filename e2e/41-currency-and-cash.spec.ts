import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Written against the phone layout (the + and its sheets, the Movimientos
// screen, the grouped Ajustes list). The default project is Desktop Chrome,
// which since phase 9 gets the desktop layout (§9g) — covered by
// 46-desktop-layout; this spec keeps checking the phone.
test.use({ viewport: { width: 390, height: 844 } });

/** The rates API, answered here: 1 COP = 0.00025 USD, so 1 USD = 4.000 COP. */
async function rates(page: Page) {
  await page.route('https://open.er-api.com/**', (route) => route.fulfill({
    json: { result: 'success', base_code: 'COP', rates: { COP: 1, USD: 0.00025, EUR: 0.000227, MXN: 0.0045 } },
  }));
}

/**
 * Redesign §9b: a transaction in another currency is stored converted (the
 * domain only ever sees the main currency) and remembers its original; the
 * method is Débito | Crédito | Efectivo.
 */
test('an expense in dollars, paid in cash, is stored converted at today\'s rate', async ({ page }) => {
  await rates(page);
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Libro de viaje');

  const currencies = dialog.getByRole('group', { name: 'Moneda' });
  await expect(currencies.getByRole('button', { name: /COP/ })).toHaveAttribute('aria-pressed', 'true');
  await currencies.getByRole('button', { name: /USD/ }).click();

  await dialog.getByLabel('Valor').fill('20');
  // The rate is fetched, not typed: there is no field for it.
  await expect(dialog.getByText('≈ $ 80.000 COP · tasa de hoy 4.000')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: /tasa/i })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Libro de viaje')).toBeVisible();
  await expect(page.getByText('$ 80.000').first()).toBeVisible();
  await expect(page.getByText(/20 USD · tasa 4\.000/)).toBeVisible();
});

test('offline with no rate yet, a foreign amount cannot be saved', async ({ page }) => {
  await page.route('https://open.er-api.com/**', (route) => route.abort());
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  await dialog.getByPlaceholder('Ej. Restaurante').fill('Algo');
  await dialog.getByRole('group', { name: 'Moneda' }).getByRole('button', { name: /USD/ }).click();
  await dialog.getByLabel('Valor').fill('20');
  await expect(dialog.getByText(/no pude traer la tasa de hoy/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

test('"Más" reveals the other currencies, and the one picked stays as a chip', async ({ page }) => {
  await page.goto('movimientos?nuevo=1');
  const dialog = page.getByRole('dialog', { name: 'Agregar movimiento' });
  const currencies = dialog.getByRole('group', { name: 'Moneda' });
  await expect(currencies.getByRole('button', { name: /MXN/ })).toHaveCount(0);
  await currencies.getByRole('button', { name: 'Más' }).click();
  await currencies.getByRole('button', { name: /MXN/ }).click();
  await expect(currencies.getByRole('button', { name: /MXN/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(currencies.getByRole('button', { name: 'Más' })).toBeVisible();
});

test('telling the app "20 dólares en efectivo" understands both', async ({ page }) => {
  await rates(page);
  await page.goto('');
  await page.getByRole('button', { name: 'Agregar movimiento' }).click();
  await page.getByRole('button', { name: /Contarle a la app/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Contale a la app' });
  await sheet.getByLabel('Qué pasó').fill('gasté 20 dólares en efectivo en un taxi');

  await expect(sheet.getByText('Entendí')).toBeVisible();
  await expect(sheet.getByRole('group', { name: 'Moneda' }).getByRole('button', { name: /USD/ }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByRole('button', { name: 'Efectivo', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await expect(sheet.getByText(/tasa de hoy 4\.000/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet.getByText(/Anotado: \$ 80\.000/)).toBeVisible();
});
